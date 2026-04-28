export type PricingTier = 'standard' | 'reseller' | 'wholesale'

export interface B2BCustomer {
  customerId: string
  tier: PricingTier
  companyName: string | null
  vatNumber: string | null
}

export interface QuoteRequest {
  id: string
  customerId: string
  items: QuoteItem[]
  note: string | null
  status: 'pending' | 'quoted' | 'accepted' | 'rejected'
  createdAt: string
}

export interface QuoteItem {
  sku: string
  qty: number
  note?: string
}
