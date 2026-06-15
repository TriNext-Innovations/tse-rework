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
import { ShipLogicClient } from './client'
import type {
  ShipLogicAddress,
  ShipLogicContact,
  ShipLogicFulfillmentData,
  ShipLogicOptionData,
  ShipLogicOptions,
  ShipLogicParcel,
  ShipLogicServiceCode,
} from './types'

type InjectedDependencies = {
  logger: Logger
}

/** Service levels we expose at checkout. */
const SERVICE_LEVELS: { code: ShipLogicServiceCode; name: string }[] = [
  { code: 'ECO', name: 'The Courier Guy — Economy' },
  { code: 'OVN', name: 'The Courier Guy — Overnight' },
]

class ShipLogicFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static override identifier = 'shiplogic'

  protected readonly logger_: Logger
  protected readonly options_: ShipLogicOptions
  protected readonly client_: ShipLogicClient

  constructor({ logger }: InjectedDependencies, options: ShipLogicOptions) {
    super()
    this.logger_ = logger
    this.options_ = options

    if (!options?.apiKey) {
      this.logger_.warn(
        '[shiplogic] no apiKey configured — rate quoting and shipment creation will fail',
      )
    }

    this.client_ = new ShipLogicClient(options.apiKey, options.baseUrl)
  }

  override async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return SERVICE_LEVELS.map(
      (s): FulfillmentOption => ({
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
    // knows which ShipLogic service to book.
    return {
      ...data,
      service_level_code: optionData.service_level_code,
    }
  }

  override async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return typeof data?.service_level_code === 'string'
  }

  override async canCalculate(): Promise<boolean> {
    // Prices are always quoted live from ShipLogic.
    return true
  }

  override async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO['optionData'],
    _data: CalculateShippingOptionPriceDTO['data'],
    context: CalculateShippingOptionPriceDTO['context'],
  ): Promise<CalculatedShippingOptionPrice> {
    const serviceCode = (optionData as ShipLogicOptionData)?.service_level_code
    const address = (context as any)?.shipping_address
    const items = ((context as any)?.items ?? []) as any[]

    if (!serviceCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[shiplogic] shipping option is missing service_level_code',
      )
    }
    if (!address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[shiplogic] cannot quote a rate without a shipping address',
      )
    }

    const parcels = this.buildParcels(items)
    let rates
    try {
      const res = await this.client_.getRates({
        collection_address: this.options_.collectionAddress,
        delivery_address: this.toShipLogicAddress(address),
        parcels,
      })
      rates = res.rates ?? []
    } catch (err: any) {
      this.logger_.error(`[shiplogic] rate request failed: ${err?.message ?? err}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'Could not retrieve a Courier Guy shipping rate. Please try again.',
      )
    }

    const match = rates.find((r) => r.service_level?.code === serviceCode)
    if (!match) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `[shiplogic] no '${serviceCode}' rate available for this delivery address`,
      )
    }

    return {
      // Store prices in cents to match the rest of the catalogue.
      calculated_amount: Math.round(match.rate * 100),
      is_calculated_price_tax_inclusive: this.options_.rateIsTaxInclusive,
    }
  }

  override async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, 'fulfillment'>>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Record<string, unknown>,
  ): Promise<CreateFulfillmentResult> {
    const serviceCode = (data?.service_level_code as ShipLogicServiceCode) ?? 'ECO'
    const address = (order as any)?.shipping_address

    if (!address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        '[shiplogic] cannot create a shipment without a shipping address',
      )
    }

    const deliveryContact: ShipLogicContact = {
      name:
        [address.first_name, address.last_name].filter(Boolean).join(' ') ||
        'Customer',
      mobile_number: address.phone ?? (order as any)?.shipping_address?.phone ?? '',
      email: (order as any)?.email ?? '',
    }

    const parcels = this.buildParcels(
      items.map((i) => ({ quantity: i.quantity ?? 1 })),
    )

    const shipment = await this.client_.createShipment({
      collection_address: this.options_.collectionAddress,
      collection_contact: this.options_.collectionContact,
      delivery_address: this.toShipLogicAddress(address),
      delivery_contact: deliveryContact,
      parcels,
      service_level_code: serviceCode,
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
        `[shiplogic] could not fetch label for shipment ${shipment.id}: ${err?.message ?? err}`,
      )
    }

    const fulfillmentData: ShipLogicFulfillmentData = {
      shipment_id: shipment.id,
      tracking_reference: trackingReference,
      service_level_code: serviceCode,
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
    const trackingReference = (data as ShipLogicFulfillmentData)?.tracking_reference
    if (!trackingReference) return {}

    try {
      await this.client_.cancelShipment(trackingReference)
    } catch (err: any) {
      this.logger_.error(
        `[shiplogic] failed to cancel shipment ${trackingReference}: ${err?.message ?? err}`,
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

  private toShipLogicAddress(addr: any): ShipLogicAddress {
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
  private buildParcels(items: any[]): ShipLogicParcel[] {
    const def = this.options_.defaultParcel
    const parcels: ShipLogicParcel[] = []

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

export default ShipLogicFulfillmentProviderService
