// ShipLogic (The Courier Guy) API + provider types.
// API contract verified against the ShipLogic REST API (the platform that
// powers The Courier Guy). Base URL: https://api.shiplogic.com/

/** Service levels exposed by ShipLogic. We offer ECO + OVN at checkout. */
export type ShipLogicServiceCode = 'ECO' | 'OVN' | 'OVNX' | 'ECOX' | 'LSE' | 'CTC'

export type ShipLogicAddressType =
  | 'residential'
  | 'business'
  | 'counter'
  | 'locker'
  | 'unknown'

export type ShipLogicAddress = {
  street_address: string
  local_area?: string
  city: string
  zone: string // province
  country: string // 2-letter ISO, e.g. "ZA"
  code: string // postal code
  type?: ShipLogicAddressType
  company?: string
  lat?: number
  lng?: number
}

export type ShipLogicContact = {
  name: string
  mobile_number?: string
  email?: string
}

export type ShipLogicParcel = {
  submitted_length_cm: number
  submitted_width_cm: number
  submitted_height_cm: number
  submitted_weight_kg: number
  parcel_description?: string
}

export type ShipLogicRateRequest = {
  collection_address: ShipLogicAddress
  delivery_address: ShipLogicAddress
  parcels: ShipLogicParcel[]
  declared_value?: number
}

export type ShipLogicRate = {
  rate: number
  service_level: {
    id: number
    code: string
    name: string
    delivery_date_from?: string
    delivery_date_to?: string
    collection_date?: string
  }
}

export type ShipLogicRatesResponse = {
  rates?: ShipLogicRate[]
}

export type ShipLogicShipmentRequest = {
  collection_address: ShipLogicAddress
  collection_contact: ShipLogicContact
  delivery_address: ShipLogicAddress
  delivery_contact: ShipLogicContact
  parcels: ShipLogicParcel[]
  service_level_code: ShipLogicServiceCode
  declared_value?: number
  customer_reference?: string
  special_instructions_collection?: string
  special_instructions_delivery?: string
  mute_notifications?: boolean
}

export type ShipLogicShipmentResponse = {
  id: number
  short_tracking_reference?: string
  custom_tracking_reference?: string
  status?: string
  service_level_code?: string
  rate?: number
  time_created?: string
}

/** Options passed to the provider from medusa-config.ts. */
export type ShipLogicOptions = {
  apiKey: string
  /** Override the API base URL (defaults to https://api.shiplogic.com). */
  baseUrl?: string
  /** Warehouse / collection address goods ship from. */
  collectionAddress: ShipLogicAddress
  /** Contact at the collection address (shown to the driver). */
  collectionContact: ShipLogicContact
  /** Fallback parcel used when a variant has no weight/dimensions. */
  defaultParcel: ShipLogicParcel
  /**
   * Whether ShipLogic rates already include VAT. When true, Medusa infers
   * tax from the rate instead of adding it on top. Verify against the TCG
   * account's VAT configuration. Defaults to true.
   */
  rateIsTaxInclusive: boolean
  /** Template for the public tracking URL; `{ref}` is replaced. */
  trackingUrlTemplate: string
}

/** Stored on the shipping option's `data` (from getFulfillmentOptions). */
export type ShipLogicOptionData = {
  id: string
  service_level_code: ShipLogicServiceCode
  name: string
}

/** Stored on the fulfillment's `data` after a waybill is created. */
export type ShipLogicFulfillmentData = {
  shipment_id: number
  tracking_reference: string
  service_level_code: string
  label_url?: string
}
