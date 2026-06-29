// Client-side helpers that drive a real Medusa cart. The Medusa cart is the
// source of truth for line items, prices, shipping options and totals for the
// whole storefront session — the browser only persists the `cart_id`. The
// PayFast amount is later recomputed server-side from the cart so the client
// can't tamper with it. All calls use the public store API + publishable key,
// matching the rest of the storefront.

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
  /** 'calculated' = priced live from the courier (Courier Guy); 'flat' = fixed admin price (e.g. Collect). */
  priceType: 'flat' | 'calculated'
}

export type CartTotals = {
  id: string
  item_total: number // cents
  shipping_total: number // cents
  total: number // cents
}

// A Medusa store cart line item (default store response shape). Product/variant
// fields are denormalised onto the line, so a single cart fetch renders the UI.
export type MedusaLineItem = {
  id: string
  title?: string
  product_title?: string
  variant_sku?: string
  thumbnail?: string | null
  unit_price: number // cents
  quantity: number
  variant_id?: string
  product_id?: string
}

export type MedusaCart = {
  id: string
  email?: string | null
  item_total?: number // cents
  total?: number // cents
  items?: MedusaLineItem[]
}

// Minimal shape the storefront needs to add a product to the cart. PDP/listing
// adds carry the variant directly; search adds carry only the product id + SKU.
export type AddItemInput = {
  id: string
  title: string
  sku?: string
  variantId?: string
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

// Resolve an add-to-cart item to a Medusa variant id. PDP/listing items already
// encode it; search-added items only carry the product id + SKU, so we fetch the
// product and match by SKU (falling back to the first variant).
async function resolveVariantId(item: AddItemInput): Promise<string> {
  const direct = item.variantId ?? variantFromCartId(item.id)
  if (direct) return direct

  const params = new URLSearchParams({ limit: '1' })
  params.append('id[]', item.id)
  params.append('fields', 'id,variants.id,variants.sku')
  const { products } = await api<{ products: Array<{ id: string; variants?: Array<{ id: string; sku?: string }> }> }>(
    `/store/products?${params.toString()}`,
  )
  const variants = products?.[0]?.variants ?? []
  const match = variants.find((v) => v.sku && v.sku === item.sku) ?? variants[0]
  if (!match?.id) throw new Error(`Could not find a purchasable variant for "${item.title}" (SKU ${item.sku ?? '—'}).`)
  return match.id
}

// ─── Session cart operations ──────────────────────────────────────────────────

export async function createEmptyCart(): Promise<MedusaCart> {
  const region_id = await getRegionId()
  const { cart } = await api<{ cart: MedusaCart }>(`/store/carts`, {
    method: 'POST',
    body: JSON.stringify({ region_id }),
  })
  return cart
}

// Fetch a cart by id. Returns null if it no longer exists or is completed (so
// the caller can recreate it), rather than throwing.
export async function getCart(cartId: string): Promise<MedusaCart | null> {
  try {
    const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}`)
    return cart ?? null
  } catch {
    return null
  }
}

export async function addLineItem(cartId: string, item: AddItemInput, quantity = 1): Promise<MedusaCart> {
  const variant_id = await resolveVariantId(item)
  const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}/line-items`, {
    method: 'POST',
    body: JSON.stringify({ variant_id, quantity }),
  })
  return cart
}

export async function updateLineItem(cartId: string, lineId: string, quantity: number): Promise<MedusaCart> {
  const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}/line-items/${lineId}`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  })
  return cart
}

export async function removeLineItem(cartId: string, lineId: string): Promise<MedusaCart> {
  // DELETE returns { id, object, deleted, parent: <cart> }.
  const { parent } = await api<{ parent: MedusaCart }>(`/store/carts/${cartId}/line-items/${lineId}`, {
    method: 'DELETE',
  })
  return parent
}

// Set the customer email + shipping/billing address on the existing session
// cart (used at checkout, before listing shipping options).
export async function setCartContact(cartId: string, email: string, address: ShippingAddressInput): Promise<void> {
  await api(`/store/carts/${cartId}`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      shipping_address: { ...address, country_code: 'za' },
      billing_address: { ...address, country_code: 'za' },
    }),
  })
}

// ─── Shipping ─────────────────────────────────────────────────────────────────

export async function listShippingOptions(cartId: string): Promise<ShippingOption[]> {
  const { shipping_options } = await api<{
    shipping_options: Array<{ id: string; name: string; amount?: number; price_type?: string; calculated_price?: { calculated_amount?: number } }>
  }>(`/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`)

  // The list endpoint only resolves prices for flat-rate options. Calculated
  // options (Courier Guy ECO/OVN) come back with calculated_price = null — their
  // live rate must be fetched per-option from the calculate endpoint, otherwise
  // they fall back to 0 and render as "Free". Quote them in parallel; drop any
  // option we can't price (e.g. courier returns no rate for the address).
  const results = await Promise.allSettled(
    shipping_options.map(async (o): Promise<ShippingOption> => {
      const priceType: ShippingOption['priceType'] = o.price_type === 'calculated' ? 'calculated' : 'flat'

      if (priceType === 'flat') {
        return { id: o.id, name: o.name, amount: o.calculated_price?.calculated_amount ?? o.amount ?? 0, priceType }
      }

      const { shipping_option } = await api<{ shipping_option: { calculated_price?: { calculated_amount?: number } } }>(
        `/store/shipping-options/${encodeURIComponent(o.id)}/calculate`,
        { method: 'POST', body: JSON.stringify({ cart_id: cartId, data: {} }) },
      )
      const amount = shipping_option?.calculated_price?.calculated_amount
      if (amount == null) throw new Error(`No live rate for shipping option ${o.id}`)
      return { id: o.id, name: o.name, amount, priceType }
    }),
  )

  return results.filter((r): r is PromiseFulfilledResult<ShippingOption> => r.status === 'fulfilled').map((r) => r.value)
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

// ─── Canonical PayFast flow (Medusa payment provider, #130) ───────────────────
// Gated behind NEXT_PUBLIC_PAYFAST_PROVIDER on the storefront — when off, the
// legacy /api/payfast/initiate path is used instead.

export const PAYFAST_PROVIDER_ENABLED = process.env.NEXT_PUBLIC_PAYFAST_PROVIDER === 'true'
// Medusa payment-provider id: `pp_<config-id>_<service-identifier>` = payfast/payfast.
const PAYFAST_PROVIDER_ID = 'pp_payfast_payfast'

export type PayfastRedirect = { url: string; params: Record<string, string> }

// Create a payment collection for the cart, initialise the PayFast session
// (Medusa calls the provider's initiatePayment, which signs the redirect
// params), and return them for the browser to POST to PayFast.
export async function initPayfastSession(cartId: string): Promise<PayfastRedirect> {
  const { payment_collection } = await api<{ payment_collection: { id: string } }>(
    `/store/payment-collections`,
    { method: 'POST', body: JSON.stringify({ cart_id: cartId }) },
  )
  const { payment_collection: pc } = await api<{
    payment_collection: { payment_sessions?: Array<{ provider_id: string; data?: Record<string, unknown> }> }
  }>(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    method: 'POST',
    body: JSON.stringify({ provider_id: PAYFAST_PROVIDER_ID }),
  })

  const session = pc.payment_sessions?.find((s) => s.provider_id === PAYFAST_PROVIDER_ID)
  const data = session?.data as { url?: string; params?: Record<string, string> } | undefined
  if (!data?.url || !data?.params) {
    throw new Error('PayFast session did not return redirect params — is the provider enabled on the region?')
  }
  return { url: data.url, params: data.params }
}

// Complete the cart → order. Idempotent-ish: once completed it returns the order.
// On the redirect-return the ITN may not have authorised the session yet, so the
// caller polls (see the confirmed page).
export async function completeCart(
  cartId: string,
): Promise<{ type: 'order' | 'cart'; order?: { id: string; display_id?: number }; error?: string }> {
  try {
    const res = await api<{ type: 'order' | 'cart'; order?: any }>(`/store/carts/${cartId}/complete`, {
      method: 'POST',
    })
    return res
  } catch (err: any) {
    return { type: 'cart', error: err?.message ?? 'complete failed' }
  }
}
