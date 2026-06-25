export interface TCGAddress {
  type: 'business' | 'residential'
  company?: string
  street_address: string
  local_area: string   // suburb
  city: string
  zone: string         // province code e.g. "GP"
  country: string      // "ZA"
  code: string         // postal code
}

export interface TCGContact {
  name: string
  mobile_number: string
  email?: string
}

export interface TCGParcel {
  submitted_length_cm: number
  submitted_width_cm: number
  submitted_height_cm: number
  submitted_weight_kg: number
  description?: string
}

export interface TCGServiceLevel {
  code: string         // "ECO", "OVN", "LOX", etc.
  name: string
  transit_days?: number
}

export interface TCGRate {
  service_level: TCGServiceLevel
  rate: number
  tax_rate: number
  tax_amount: number
  total: number
}

export interface TCGRateRequest {
  collection_address: TCGAddress
  delivery_address: TCGAddress
  parcels: TCGParcel[]
  declared_value?: number
}

export interface TCGRateResponse {
  rates: TCGRate[]
}

export interface TCGShipmentRequest {
  service_level_code: string
  collection_address: TCGAddress
  delivery_address: TCGAddress
  collection_contact: TCGContact
  delivery_contact: TCGContact
  parcels: TCGParcel[]
  declared_value?: number
  special_instructions_collection?: string
  special_instructions_delivery?: string
  require_waybill_number?: boolean
  customer_reference?: string
}

export interface TCGShipment {
  id: string
  tracking_reference: string
  short_tracking_reference: string
  waybill_number?: string
  status: string
  service_level_code: string
  collection_address: TCGAddress
  delivery_address: TCGAddress
}

export interface TCGPickupPoint {
  id: string
  name: string
  type: 'locker' | 'counter'
  address: TCGAddress
  lat?: number
  lng?: number
  opening_hours?: string
}
