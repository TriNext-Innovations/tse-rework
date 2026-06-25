import { AbstractFulfillmentProviderService } from '@medusajs/framework/utils'
import { CourierGuyClient } from './client'
import type { TCGAddress, TCGParcel } from './types'

// TSE warehouse — Kya Sands, Johannesburg
const COLLECTION_ADDRESS: TCGAddress = {
  type: 'business',
  company: 'The Stationery Exchange',
  street_address: process.env.TCG_ORIGIN_STREET ?? 'Kya Sands',
  local_area: process.env.TCG_ORIGIN_SUBURB ?? 'Kya Sands',
  city: process.env.TCG_ORIGIN_CITY ?? 'Johannesburg',
  zone: process.env.TCG_ORIGIN_PROVINCE ?? 'GP',
  country: 'ZA',
  code: process.env.TCG_ORIGIN_POSTAL_CODE ?? '2163',
}

const COLLECTION_CONTACT = {
  name: process.env.TCG_CONTACT_NAME ?? 'TSE Dispatch',
  mobile_number: process.env.TCG_CONTACT_PHONE ?? '0115551234',
  email: process.env.TCG_CONTACT_EMAIL ?? 'dispatch@tse.co.za',
}

type FulfillmentOption = { id: string; name: string; service_level_code: string }

// Offer economy + overnight as the two standard options.
// Service codes: ECO = Economy (3-4 days), OVN = Overnight (next day)
const FULFILLMENT_OPTIONS: FulfillmentOption[] = [
  { id: 'tcg-eco', name: 'Economy Courier (3–4 days)', service_level_code: 'ECO' },
  { id: 'tcg-ovn', name: 'Overnight Courier (next business day)', service_level_code: 'OVN' },
]

const OPTION_MAP = new Map(FULFILLMENT_OPTIONS.map((o) => [o.id, o]))

type MedusaShippingAddress = {
  address_1?: string
  address_2?: string
  city?: string
  country_code?: string
  postal_code?: string
  province?: string
  phone?: string
  first_name?: string
  last_name?: string
  company?: string
}

type MedusaCartItem = {
  quantity: number
  variant?: { weight?: number; metadata?: Record<string, unknown> }
  product?: { weight?: number }
}

function addressToTCG(addr: MedusaShippingAddress): TCGAddress {
  return {
    type: addr.company ? 'business' : 'residential',
    company: addr.company,
    street_address: addr.address_1 ?? '',
    local_area: addr.address_2 ?? addr.city ?? '',
    city: addr.city ?? '',
    zone: addr.province ?? '',
    country: (addr.country_code ?? 'ZA').toUpperCase(),
    code: addr.postal_code ?? '',
  }
}

function buildParcels(items: MedusaCartItem[]): TCGParcel[] {
  // Cartridges/toners default to 300g each if weight not set on product.
  // TSE ships in a standard flyer/box: 20×15×5 cm.
  const totalWeightKg = items.reduce((sum, item) => {
    const grams =
      (item.variant?.weight as number | undefined) ??
      (item.product?.weight as number | undefined) ??
      (item.variant?.metadata?.weight_g as number | undefined) ??
      300
    return sum + (grams / 1000) * item.quantity
  }, 0)

  return [
    {
      submitted_length_cm: 30,
      submitted_width_cm: 20,
      submitted_height_cm: 10,
      submitted_weight_kg: Math.max(0.1, parseFloat(totalWeightKg.toFixed(2))),
      description: 'Printer Cartridges / Toner',
    },
  ]
}

export class CourierGuyFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = 'courier-guy'

  private client: CourierGuyClient

  constructor() {
    super()
    this.client = new CourierGuyClient(process.env.TCG_API_KEY ?? '')
  }

  async getFulfillmentOptions(): Promise<Record<string, unknown>[]> {
    return FULFILLMENT_OPTIONS
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return OPTION_MAP.has(data.id as string)
  }

  async canCalculate(_data: Record<string, unknown>): Promise<boolean> {
    return Boolean(process.env.TCG_API_KEY)
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return { ...data, option_id: optionData.id }
  }

  async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<{ calculated_amount: number; is_calculated_price_tax_inclusive: boolean }> {
    const option = OPTION_MAP.get(optionData.id as string)
    if (!option) throw new Error(`Unknown TCG option: ${optionData.id}`)

    const shippingAddress = (
      (context.shipping_address ?? (context.cart as any)?.shipping_address)
    ) as MedusaShippingAddress | undefined

    const items = ((context.cart as any)?.items ?? []) as MedusaCartItem[]

    const deliveryAddress: TCGAddress = shippingAddress
      ? addressToTCG(shippingAddress)
      : { type: 'residential', street_address: '', local_area: '', city: '', zone: '', country: 'ZA', code: '' }

    const { rates } = await this.client.getRates({
      collection_address: COLLECTION_ADDRESS,
      delivery_address: deliveryAddress,
      parcels: buildParcels(items),
    })

    const match = rates.find((r) => r.service_level.code === option.service_level_code)
    if (!match) throw new Error(`TCG rate for ${option.service_level_code} not available for this address`)

    // Medusa stores prices as integers in smallest unit (ZAR cents)
    return {
      calculated_amount: Math.round(match.total * 100),
      is_calculated_price_tax_inclusive: true,  // TCG returns VAT-inclusive totals
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Record<string, unknown>[],
    order: Record<string, unknown>,
    _fulfillment: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const option = OPTION_MAP.get(data.option_id as string)
    if (!option) throw new Error(`Unknown TCG option: ${data.option_id}`)

    const shippingAddress = (order as any).shipping_address as MedusaShippingAddress | undefined
    if (!shippingAddress) throw new Error('Order is missing a shipping address')

    const cartItems = items.map((i: any) => ({
      quantity: i.quantity,
      variant: i.variant ?? i.line_item?.variant,
      product: i.product ?? i.line_item?.product,
    })) as MedusaCartItem[]

    const shipment = await this.client.createShipment({
      service_level_code: option.service_level_code,
      collection_address: COLLECTION_ADDRESS,
      delivery_address: addressToTCG(shippingAddress),
      collection_contact: COLLECTION_CONTACT,
      delivery_contact: {
        name: [shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(' ') || 'Customer',
        mobile_number: shippingAddress.phone ?? '0000000000',
      },
      parcels: buildParcels(cartItems),
      declared_value: ((order as any).total ?? 0) / 100,
      customer_reference: String((order as any).id ?? ''),
      require_waybill_number: true,
    })

    return {
      tracking_reference: shipment.tracking_reference,
      waybill_number: shipment.waybill_number ?? null,
      shipment_id: shipment.id,
      service_level_code: shipment.service_level_code,
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (data.shipment_id) {
      await this.client.cancelShipment(data.shipment_id as string)
    }
    return {}
  }

  async createReturn(returnOrder: Record<string, unknown>): Promise<Record<string, unknown>> {
    const shippingAddress = (returnOrder as any).shipping_address as MedusaShippingAddress | undefined
    if (!shippingAddress) return { error: 'No return address provided' }

    const shipment = await this.client.createShipment({
      service_level_code: 'ECO',
      collection_address: addressToTCG(shippingAddress),
      delivery_address: COLLECTION_ADDRESS,
      collection_contact: {
        name: [shippingAddress.first_name, shippingAddress.last_name].filter(Boolean).join(' ') || 'Customer',
        mobile_number: shippingAddress.phone ?? '0000000000',
      },
      delivery_contact: COLLECTION_CONTACT,
      parcels: [{ submitted_length_cm: 30, submitted_width_cm: 20, submitted_height_cm: 10, submitted_weight_kg: 0.5, description: 'Return - Printer Cartridges / Toner' }],
      customer_reference: `RETURN-${(returnOrder as any).id ?? Date.now()}`,
      require_waybill_number: true,
    })

    return {
      tracking_reference: shipment.tracking_reference,
      waybill_number: shipment.waybill_number ?? null,
      shipment_id: shipment.id,
    }
  }

  async retrieveDocuments(data: Record<string, unknown>, documentType: 'invoice' | 'label'): Promise<never> {
    throw new Error(`TCG: document type "${documentType}" not supported via API — download from portal.thecourierguy.co.za`)
  }
}

export default CourierGuyFulfillmentService
