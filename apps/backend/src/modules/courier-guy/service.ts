import { AbstractFulfillmentProviderService } from '@medusajs/framework/utils'
import { MedusaError } from '@medusajs/framework/utils'
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from '@medusajs/framework/types'
import { CourierGuyClient } from './client'
import type {
  CourierGuyAddress,
  CourierGuyContact,
  CourierGuyFulfillmentData,
  CourierGuyOptionData,
  CourierGuyOptions,
  CourierGuyParcel,
  CourierGuyServiceCode,
} from './types'

type InjectedDependencies = {
  logger: Logger
}

/** Service levels we expose at checkout. */
const SERVICE_LEVELS: { code: CourierGuyServiceCode; name: string }[] = [
  { code: 'ECO', name: 'The Courier Guy — Economy' },
  { code: 'OVN', name: 'The Courier Guy — Overnight' },
]

// The Courier Guy returns route-specific service codes, not a fixed ECO/OVN:
//   metro     → ECO  (economy 3–4d), OVN  (overnight)
//   regional  → ECOR (economy 3–5d), OVNR (overnight 2–3d)
//   local     → LOF/LOX (local overnight), LSE (local same-day)
//   any       → SDX (same-day express)
// So we map each checkout tier to the family of codes that represents it and
// pick the cheapest, excluding same-day services. This makes quoting + booking
// work on every route instead of only metro→metro.
const SAME_DAY_CODES = new Set(['SDX', 'LSX', 'LSE'])
const OVERNIGHT_CODES = new Set(['OVN', 'OVNR', 'LOF', 'LOX'])
const ECONOMY_CODES = new Set(['ECO', 'ECOR'])

function selectRate(rates: any[], tier: string): any | undefined {
  const usable = rates.filter(
    (r) => r?.service_level?.code && !SAME_DAY_CODES.has(r.service_level.code),
  )
  if (!usable.length) return undefined
  const family = tier === 'OVN' ? OVERNIGHT_CODES : ECONOMY_CODES
  const inFamily = usable.filter((r) => family.has(r.service_level.code))
  // Fall back to any deliverable rate when the exact family isn't offered (e.g.
  // local routes have no multi-day economy — use the cheapest next-day instead).
  const pool = inFamily.length ? inFamily : usable
  return [...pool].sort((a, b) => a.rate - b.rate)[0]
}

class CourierGuyFulfillmentProviderService extends AbstractFulfillmentProviderService {
  // ⚠️ DO NOT rename. This identifier composes the persisted fulfillment
  // provider id (`shiplogic_shiplogic`) that prod shipping options and booked
  // waybills reference. The module was renamed to "courier-guy" for clarity
  // (#TCG-rename), but changing this string would orphan existing DB rows
  // without a data migration. Keep it `shiplogic`.
  static override identifier = 'shiplogic'

  protected readonly logger_: Logger
  protected readonly options_: CourierGuyOptions
  protected readonly client_: CourierGuyClient

  constructor({ logger }: InjectedDependencies, options: CourierGuyOptions) {
    super()
    this.logger_ = logger
    this.options_ = options

    if (!options?.apiKey) {
      this.logger_.warn(
        '[courier-guy] no apiKey configured — rate quoting and shipment creation will fail',
      )
    }

    this.client_ = new CourierGuyClient(options.apiKey, options.baseUrl)
  }

  override async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return SERVICE_LEVELS.map(
      (s): FulfillmentOption => ({
        // Kept as `shiplogic-*` (not renamed): this id is persisted in existing
        // prod shipping options' `data`. Only `service_level_code` is read back,
        // so the prefix is cosmetic — but renaming buys nothing and risks a mismatch.
        id: `shiplogic-${s.code.toLowerCase()}`,
        service_level_code: s.code,
        name: s.name,
      }),
    )
  }

  override async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Persist the service level onto the shipping method so createFulfillment
    // knows which CourierGuy service to book.
    return {
      ...data,
      service_level_code: optionData.service_level_code,
    }
  }

  override async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return typeof data?.service_level_code === 'string'
  }

  override async canCalculate(): Promise<boolean> {
    // Prices are always quoted live from CourierGuy.
    return true
  }

  override async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO['optionData'],
    _data: CalculateShippingOptionPriceDTO['data'],
    context: CalculateShippingOptionPriceDTO['context'],
  ): Promise<CalculatedShippingOptionPrice> {
    const serviceCode = (optionData as CourierGuyOptionData)?.service_level_code
    const address = (context as any)?.shipping_address
    const items = ((context as any)?.items ?? []) as any[]

    if (!serviceCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[courier-guy] shipping option is missing service_level_code',
      )
    }
    if (!address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[courier-guy] cannot quote a rate without a shipping address',
      )
    }

    const parcels = this.buildParcels(items)
    let rates
    try {
      const res = await this.client_.getRates({
        collection_address: this.options_.collectionAddress,
        delivery_address: this.toCourierGuyAddress(address),
        parcels,
      })
      rates = res.rates ?? []
    } catch (err: any) {
      this.logger_.error(`[courier-guy] rate request failed: ${err?.message ?? err}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'Could not retrieve a Courier Guy shipping rate. Please try again.',
      )
    }

    const match = selectRate(rates, serviceCode)
    if (!match) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `[courier-guy] no deliverable Courier Guy rate for this delivery address`,
      )
    }

    return {
      // Prices are in rands, matching the rest of the catalogue.
      calculated_amount: match.rate,
      is_calculated_price_tax_inclusive: this.options_.rateIsTaxInclusive,
    }
  }

  override async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, 'fulfillment'>>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Record<string, unknown>,
  ): Promise<CreateFulfillmentResult> {
    const serviceCode = (data?.service_level_code as CourierGuyServiceCode) ?? 'ECO'
    const address = (order as any)?.shipping_address

    if (!address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[courier-guy] cannot create a shipment without a shipping address',
      )
    }

    const deliveryContact: CourierGuyContact = {
      name:
        [address.first_name, address.last_name].filter(Boolean).join(' ') ||
        'Customer',
      mobile_number: address.phone ?? (order as any)?.shipping_address?.phone ?? '',
      email: (order as any)?.email ?? '',
    }

    const parcels = this.buildParcels(
      items.map((i) => ({ quantity: i.quantity ?? 1 })),
    )

    // The stored code is the checkout tier (ECO/OVN). Resolve it to the actual
    // route-specific code The Courier Guy offers for this address before booking.
    let bookingCode: string = serviceCode
    try {
      const { rates } = await this.client_.getRates({
        collection_address: this.options_.collectionAddress,
        delivery_address: this.toCourierGuyAddress(address),
        parcels,
      })
      const picked = selectRate(rates ?? [], serviceCode)
      if (picked?.service_level?.code) bookingCode = picked.service_level.code
    } catch (err: any) {
      this.logger_.warn(
        `[courier-guy] could not resolve service code at fulfillment, using ${serviceCode}: ${err?.message ?? err}`,
      )
    }

    const shipment = await this.client_.createShipment({
      collection_address: this.options_.collectionAddress,
      collection_contact: this.options_.collectionContact,
      delivery_address: this.toCourierGuyAddress(address),
      delivery_contact: deliveryContact,
      parcels,
      service_level_code: bookingCode as CourierGuyServiceCode,
      customer_reference: (order as any)?.display_id
        ? `TSE-${(order as any).display_id}`
        : undefined,
    })

    const trackingReference =
      shipment.short_tracking_reference ?? shipment.custom_tracking_reference ?? ''

    // Label is best-effort — a failure here must not roll back the booked waybill.
    let labelUrl: string | null = null
    try {
      labelUrl = await this.client_.getLabelUrl(shipment.id)
    } catch (err: any) {
      this.logger_.warn(
        `[courier-guy] could not fetch label for shipment ${shipment.id}: ${err?.message ?? err}`,
      )
    }

    const fulfillmentData: CourierGuyFulfillmentData = {
      shipment_id: shipment.id,
      tracking_reference: trackingReference,
      service_level_code: bookingCode as CourierGuyServiceCode,
      label_url: labelUrl ?? undefined,
    }

    return {
      data: fulfillmentData as unknown as Record<string, unknown>,
      labels: trackingReference
        ? [
            {
              tracking_number: trackingReference,
              tracking_url: this.trackingUrl(trackingReference),
              label_url: labelUrl ?? '',
            },
          ]
        : [],
    }
  }

  override async cancelFulfillment(data: Record<string, unknown>): Promise<any> {
    const trackingReference = (data as CourierGuyFulfillmentData)?.tracking_reference
    if (!trackingReference) return {}

    try {
      await this.client_.cancelShipment(trackingReference)
    } catch (err: any) {
      this.logger_.error(
        `[courier-guy] failed to cancel shipment ${trackingReference}: ${err?.message ?? err}`,
      )
      throw err
    }
    return {}
  }

  override async getFulfillmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    void data
    return []
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private toCourierGuyAddress(addr: any): CourierGuyAddress {
    const street = [addr.address_1, addr.address_2].filter(Boolean).join(', ')
    return {
      street_address: street || addr.address_1 || '',
      local_area: addr.province ?? '',
      city: addr.city ?? '',
      zone: addr.province ?? '',
      country: (addr.country_code ?? 'za').toUpperCase(),
      code: addr.postal_code ?? '',
      type: 'residential',
      company: addr.company || undefined,
    }
  }

  /**
   * Build one parcel per unit. Variant weight/dimensions are used when present
   * (Medusa stores weight in grams), otherwise the configured default parcel —
   * cartridges rarely carry dimensions, so the default covers most carts.
   */
  private buildParcels(items: any[]): CourierGuyParcel[] {
    const def = this.options_.defaultParcel
    const parcels: CourierGuyParcel[] = []

    for (const item of items) {
      const qty = Math.max(1, Number(item?.quantity ?? 1))
      const variant = item?.variant ?? {}

      const weightKg =
        variant.weight > 0 ? variant.weight / 1000 : def.submitted_weight_kg
      const length = variant.length > 0 ? variant.length : def.submitted_length_cm
      const width = variant.width > 0 ? variant.width : def.submitted_width_cm
      const height = variant.height > 0 ? variant.height : def.submitted_height_cm

      for (let i = 0; i < qty; i++) {
        parcels.push({
          submitted_length_cm: length,
          submitted_width_cm: width,
          submitted_height_cm: height,
          submitted_weight_kg: weightKg,
          parcel_description: item?.title ?? def.parcel_description,
        })
      }
    }

    return parcels.length > 0 ? parcels : [def]
  }

  private trackingUrl(ref: string): string {
    return this.options_.trackingUrlTemplate.replace('{ref}', encodeURIComponent(ref))
  }
}

export default CourierGuyFulfillmentProviderService
