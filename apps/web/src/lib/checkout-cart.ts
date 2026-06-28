// Client-side helpers that drive a real Medusa cart during checkout. The cart is
// the source of truth for shipping options (admin-configured) and totals; the
// PayFast amount is later recomputed server-side from the cart so the client
// can't tamper with it. All calls use the public store API + publishable key,
// matching the rest of the storefront.

import type { CartItem } from '@/contexts/CartContext'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const HEADERS = {
  'Content-Type': 'application/json',
  'x-publishable-api-key': PUB_KEY,
}

export type ShippingAddressInput = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
}

export type ShippingOption = {
  id: string
  name: string
  amount: number // cents
}

export type CartTotals = {
  id: string
  item_total: number // cents
  shipping_total: number // cents
  total: number // cents
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers: { ...HEADERS, ...(init?.headers ?? {}) } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Medusa ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// Mirror of the backend splitCartId: a cart id "prod_x-variant_y" encodes the
// variant. Returns the variant id when present.
function variantFromCartId(id?: string): string | undefined {
  if (!id) return undefined
  const idx = id.indexOf('-variant_')
  if (idx !== -1) return id.slice(idx + 1)
  if (id.startsWith('variant_')) return id
  return undefined
}

let cachedRegionId: string | null = null
async function getRegionId(): Promise<string> {
  if (cachedRegionId) return cachedRegionId
  const { regions } = await api<{ regions: Array<{ id: string }> }>(`/store/regions?limit=1`)
  cachedRegionId = regions?.[0]?.id ?? ''
  return cachedRegionId
}

// Resolve every cart item to a Medusa variant id. PDP/listing items already
// encode it; search-added items only carry the product id + SKU, so we fetch
// those products and match by SKU (falling back to the first variant).
async function resolveLineItems(items: CartItem[]): Promise<Array<{ variant_id: string; quantity: number }>> {
  const lines: Array<{ variant_id: string; quantity: number }> = []
  const unresolved: CartItem[] = []

  for (const item of items) {
    const variantId = item.variantId ?? variantFromCartId(item.id)
    if (variantId) lines.push({ variant_id: variantId, quantity: item.qty })
    else unresolved.push(item)
  }

  if (unresolved.length) {
    // For unresolved items `id` is the product id (Meilisearch hit). Batch-fetch.
    const params = new URLSearchParams({ limit: String(unresolved.length || 1) })
    for (const it of unresolved) params.append('id[]', it.id)
    params.append('fields', 'id,variants.id,variants.sku')
    const { products } = await api<{ products: Array<{ id: string; variants?: Array<{ id: string; sku?: string }> }> }>(
      `/store/products?${params.toString()}`,
    )
    const byProduct = new Map(products.map((p) => [p.id, p.variants ?? []]))

    for (const it of unresolved) {
      const variants = byProduct.get(it.id) ?? []
      const match = variants.find((v) => v.sku && v.sku === it.sku) ?? variants[0]
      if (!match?.id) {
        throw new Error(`Could not find a purchasable variant for "${it.title}" (SKU ${it.sku}).`)
      }
      lines.push({ variant_id: match.id, quantity: it.qty })
    }
  }

  return lines
}

// Create a Medusa cart from the local cart and set the shipping address + email.
export async function createCartWithAddress(
  items: CartItem[],
  email: string,
  address: ShippingAddressInput,
): Promise<string> {
  const region_id = await getRegionId()
  const line_items = await resolveLineItems(items)

  const { cart } = await api<{ cart: { id: string } }>(`/store/carts`, {
    method: 'POST',
    body: JSON.stringify({ region_id, email, items: line_items }),
  })

  await api(`/store/carts/${cart.id}`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      shipping_address: { ...address, country_code: 'za' },
      billing_address: { ...address, country_code: 'za' },
    }),
  })

  return cart.id
}

export async function listShippingOptions(cartId: string): Promise<ShippingOption[]> {
  const { shipping_options } = await api<{
    shipping_options: Array<{ id: string; name: string; amount?: number; calculated_price?: { calculated_amount?: number } }>
  }>(`/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`)

  return shipping_options.map((o) => ({
    id: o.id,
    name: o.name,
    amount: o.calculated_price?.calculated_amount ?? o.amount ?? 0,
  }))
}

export async function selectShippingMethod(cartId: string, optionId: string): Promise<CartTotals> {
  const { cart } = await api<{ cart: CartTotals }>(`/store/carts/${cartId}/shipping-methods`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  })
  return {
    id: cart.id,
    item_total: cart.item_total ?? 0,
    shipping_total: cart.shipping_total ?? 0,
    total: cart.total ?? 0,
  }
}
