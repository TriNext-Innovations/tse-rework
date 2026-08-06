// Client-side helpers that drive a real Medusa cart. The Medusa cart is the
// source of truth for line items, prices, shipping options and totals for the
// whole storefront session — the browser only persists the `cart_id`. The
// PayFast amount is later recomputed server-side from the cart so the client
// can't tamper with it. All calls use the public store API + publishable key,
// matching the rest of the storefront.

import * as Sentry from '@sentry/nextjs'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

// Owned here rather than in AuthContext so this module stays importable from
// AuthContext (which calls transferCartToCustomer on sign-in) without a cycle.
export const AUTH_TOKEN_KEY = 'tse_auth_token'

// Sign-in/sign-out broadcast. Lives here, not in AuthContext, so the cart can
// react to auth without importing it — CartProvider is nested inside
// AuthProvider, and a back-reference would make the two mutually dependent.
export const AUTH_CHANGED_EVENT = 'tse:auth-changed'

export function announceAuthChange(): void {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
  } catch {}
}

function authToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

// Cart calls MUST carry the customer's JWT when they have one. Medusa resolves
// `customer.groups.id` from the cart's associated customer at promotion-
// evaluation time, so an unauthenticated cart is a guest cart and the B2B
// threshold promotions (which are gated on group membership) silently never
// apply — the shopper is quietly charged full price. See `@tse/types`/b2b.
function headers(): Record<string, string> {
  const tok = authToken()
  return {
    'Content-Type': 'application/json',
    'x-publishable-api-key': PUB_KEY,
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  }
}

export type ShippingAddressInput = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  // Complex / building / hotel room — printed on the courier waybill.
  company: string
  city: string
  province: string
  postal_code: string
}

export type ShippingOption = {
  id: string
  name: string
  amount: number // rands
  /** 'calculated' = priced live from the courier (Courier Guy); 'flat' = fixed admin price (e.g. Collect). */
  priceType: 'flat' | 'calculated'
}

export type CartTotals = {
  id: string
  item_total: number // rands — goods AFTER discount, excl shipping
  /** Goods total BEFORE discount — the basis the B2B thresholds are measured on. */
  original_item_total: number // rands
  /** Sum of all applied promotions, incl. the automatic B2B threshold discount. */
  discount_total: number // rands
  shipping_total: number // rands
  total: number // rands
}

// A Medusa store cart line item (default store response shape). Product/variant
// fields are denormalised onto the line, so a single cart fetch renders the UI.
export type MedusaLineItem = {
  id: string
  title?: string
  product_title?: string
  variant_sku?: string
  thumbnail?: string | null
  unit_price: number // rands
  quantity: number
  variant_id?: string
  product_id?: string
}

export type MedusaCart = {
  id: string
  email?: string | null
  completed_at?: string | null
  /** Null while the cart is a guest cart — no customer, so no B2B discount. */
  customer_id?: string | null
  item_total?: number // rands — goods AFTER discount, excl shipping
  original_item_total?: number // rands — goods BEFORE discount
  discount_total?: number // rands
  shipping_total?: number // rands
  total?: number // rands
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
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
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
// the caller can recreate it), rather than throwing. The completed check must
// be explicit: Medusa returns completed carts with 200 + their line items, so
// without it the paid cart "ghosts" back into the drawer after the PayFast
// redirect (the provider flow keeps cart_id through the redirect on purpose).
export async function getCart(cartId: string): Promise<MedusaCart | null> {
  try {
    const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}`)
    if (!cart || cart.completed_at) return null
    return cart
  } catch {
    return null
  }
}

// Associate an existing (guest-created) cart with the now signed-in customer.
// A cart created before sign-in has customer_id = null, and Medusa evaluates
// promotion rules against the cart's customer — so without this the B2B group
// rule fails and the shopper keeps paying list price for the rest of the
// session. Called on login/register; safe to call when already associated.
export async function transferCartToCustomer(cartId: string): Promise<MedusaCart | null> {
  if (!authToken()) return null
  try {
    const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}/customer`, {
      method: 'POST',
    })
    return cart
  } catch {
    // Non-fatal: the shopper still has a working cart, just no group pricing.
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

export type ShippingOptionsResult = {
  options: ShippingOption[]
  /** Names of enabled options dropped because their live rate could not be quoted. */
  unavailable: string[]
}

export async function listShippingOptions(cartId: string): Promise<ShippingOptionsResult> {
  const { shipping_options } = await api<{
    shipping_options: Array<{ id: string; name: string; amount?: number; price_type?: string; calculated_price?: { calculated_amount?: number } }>
  }>(`/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`)

  // The list endpoint only resolves prices for flat-rate options. Calculated
  // options (Courier Guy ECO/OVN) come back with calculated_price = null — their
  // live rate must be fetched per-option from the calculate endpoint, otherwise
  // they fall back to 0 and render as "Free". Quote them in parallel; an option
  // we can't price (e.g. courier returns no rate for the address) is excluded
  // from the result, reported to error monitoring, and named in `unavailable`
  // so the customer sees why it's missing.
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

  const options: ShippingOption[] = []
  const unavailable: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      options.push(r.value)
      return
    }
    const failed = shipping_options[i]
    if (!failed) return
    unavailable.push(failed.name)
    Sentry.captureException(r.reason instanceof Error ? r.reason : new Error(String(r.reason)), {
      tags: { checkout: 'shipping-quote' },
      extra: { shipping_option_id: failed.id, shipping_option_name: failed.name, cart_id: cartId },
    })
  })

  return { options, unavailable }
}

export async function selectShippingMethod(cartId: string, optionId: string): Promise<CartTotals> {
  const { cart } = await api<{ cart: MedusaCart }>(`/store/carts/${cartId}/shipping-methods`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  })
  return toTotals(cart)
}

// Medusa omits a zero total from some responses, so every field defaults to 0.
export function toTotals(cart: Partial<CartTotals> & { id: string }): CartTotals {
  const item_total = cart.item_total ?? 0
  const discount_total = cart.discount_total ?? 0
  return {
    id: cart.id,
    item_total,
    // Fall back to reconstructing the pre-discount goods total, so the checkout
    // summary still balances if the field is absent.
    original_item_total: cart.original_item_total ?? item_total + discount_total,
    discount_total,
    shipping_total: cart.shipping_total ?? 0,
    total: cart.total ?? 0,
  }
}

// ─── PayFast flow (Medusa payment provider, #130) ─────────────────────────────
// The provider is the only payment path — the legacy storefront initiate/ITN
// routes were removed after the prod cutover.

// Medusa payment-provider id: `pp_<config-id>_<service-identifier>` = payfast/payfast.
const PAYFAST_PROVIDER_ID = 'pp_payfast_payfast'

export type PayfastRedirect = { url: string; params: Record<string, string> }

// Create a payment collection for the cart, initialise the PayFast session
// (Medusa calls the provider's initiatePayment, which signs the redirect
// params), and return them for the browser to POST to PayFast.
export async function initPayfastSession(
  cartId: string,
  contact?: { email?: string | null; name?: string | null },
): Promise<PayfastRedirect> {
  const { payment_collection } = await api<{ payment_collection: { id: string } }>(
    `/store/payment-collections`,
    { method: 'POST', body: JSON.stringify({ cart_id: cartId }) },
  )
  // Guest carts have no authenticated customer, so Medusa can't populate the
  // provider's context.customer. Pass the buyer's contact through the session
  // `data` so the PayFast page pre-fills their name + email.
  const sessionData: Record<string, string> = {}
  if (contact?.email) sessionData.email = contact.email
  if (contact?.name) {
    const parts = contact.name.trim().split(/\s+/)
    sessionData.name_first = parts[0] ?? contact.name
    const last = parts.slice(1).join(' ')
    if (last) sessionData.name_last = last
  }
  const { payment_collection: pc } = await api<{
    payment_collection: { payment_sessions?: Array<{ provider_id: string; data?: Record<string, unknown> }> }
  }>(`/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    method: 'POST',
    body: JSON.stringify({ provider_id: PAYFAST_PROVIDER_ID, data: sessionData }),
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
