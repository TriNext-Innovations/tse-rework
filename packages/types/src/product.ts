export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'
export type CartridgeType = 'oem' | 'compatible'

export interface Product {
  id: string
  handle: string
  title: string
  description: string | null
  thumbnail: string | null
  variants: ProductVariant[]
  categories: ProductCategory[]
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  sku: string
  title: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  stockStatus: StockStatus
  cartridgeType: CartridgeType
}

export interface ProductCategory {
  id: string
  handle: string
  name: string
}
