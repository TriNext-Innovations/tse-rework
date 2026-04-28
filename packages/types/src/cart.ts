export interface CartItem {
  id: string
  variantId: string
  productId: string
  title: string
  thumbnail: string | null
  sku: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Cart {
  id: string
  items: CartItem[]
  subtotal: number
  shippingTotal: number
  taxTotal: number
  total: number
  currencyCode: string
  regionId: string
}
