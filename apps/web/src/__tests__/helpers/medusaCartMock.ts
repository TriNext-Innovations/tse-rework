import { vi } from 'vitest'

// A stateful in-memory fake of the Medusa store cart API, enough to drive the
// CartContext (create cart, resolve variant by product id, add/update/remove
// line items, fetch cart). Prices are in rands, matching Medusa.

type Variant = { id: string; sku: string; title: string; price: number }

const CATALOG: Record<string, Variant> = {
  prod_1: { id: 'v_1', sku: 'HP-123', title: 'HP 123', price: 300 },
  prod_2: { id: 'v_2', sku: 'CAN-737', title: 'Canon 737', price: 450 },
  p1: { id: 'v_1', sku: 'HP-123', title: 'HP 123', price: 300 },
}

const BY_VARIANT: Record<string, Variant & { product_id: string }> = {}
for (const [pid, v] of Object.entries(CATALOG)) BY_VARIANT[v.id] = { ...v, product_id: pid }

type Line = {
  id: string
  variant_id: string
  product_id?: string
  product_title?: string
  title?: string
  variant_sku?: string
  unit_price: number
  quantity: number
  thumbnail: string | null
}

type Promotion = { id: string; code: string; is_automatic: boolean }

// Codes the fake backend recognises, and what each takes off. Matching is
// case-SENSITIVE on purpose: verified against production on 14 Aug 2026, a
// promotion created as "TSETESTC" rejects "tsetestc" and "TseTestC" with a 400.
const KNOWN_CODES: Record<string, number> = { SAVE10: 10, WELCOME: 25 }

// A promotion still in `draft`. Medusa accepts it with a 200 and then silently
// does not apply it — no discount, no error. This is the nastier of the two
// failure modes and the reason a 200 alone is never treated as success.
const DRAFT_CODES = new Set(['DRAFTONLY'])

export function installCartMock() {
  let cart:
    | {
        id: string
        email: string | null
        item_total: number
        discount_total: number
        total: number
        items: Line[]
        promotions: Promotion[]
      }
    | null = null
  let seq = 0

  const recompute = () => {
    if (!cart) return
    const goods = cart.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    // Drop any code whose discount the cart can no longer cover, mirroring
    // Medusa removing a promotion once the order stops qualifying.
    cart.promotions = cart.promotions.filter((p) => p.is_automatic || (KNOWN_CODES[p.code] ?? 0) <= goods)
    cart.discount_total = cart.promotions.reduce((s, p) => s + (KNOWN_CODES[p.code] ?? 0), 0)
    cart.item_total = goods
    cart.total = goods - cart.discount_total
  }

  // Return a fresh copy each time (the real API returns new JSON), so React sees
  // a new object reference and re-renders.
  const snapshot = () =>
    cart ? { ...cart, items: cart.items.map((i) => ({ ...i })), promotions: cart.promotions.map((p) => ({ ...p })) } : cart

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
  const notFound = () => ({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' })
  const badRequest = (message: string) => ({
    ok: false,
    status: 400,
    json: async () => ({ type: 'invalid_data', message }),
    text: async () => JSON.stringify({ type: 'invalid_data', message }),
  })

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const u = new URL(url, 'http://x')
    const path = u.pathname
    const body = init?.body ? JSON.parse(init.body as string) : {}

    if (path === '/store/regions') return ok({ regions: [{ id: 'reg_1' }] })

    if (path === '/store/products') {
      const ids = u.searchParams.getAll('id[]')
      const products = ids.map((id) => {
        const v = CATALOG[id]
        // Unknown ids get a synthetic variant so any add-to-cart resolves.
        return { id, variants: v ? [{ id: v.id, sku: v.sku }] : [{ id: `v_${id}`, sku: `SKU_${id}` }] }
      })
      return ok({ products })
    }

    if (path === '/store/carts' && method === 'POST') {
      cart = { id: `cart_${++seq}`, email: null, item_total: 0, discount_total: 0, total: 0, items: [], promotions: [] }
      return ok({ cart: snapshot() })
    }

    // POST/DELETE /store/carts/:id/promotions
    const promo = path.match(/^\/store\/carts\/([^/]+)\/promotions$/)
    if (promo) {
      if (!cart) return notFound()
      const codes: string[] = body.promo_codes ?? []
      if (method === 'POST') {
        for (const raw of codes) {
          const code = String(raw)
          // Draft promotion: 200, but nothing applied.
          if (DRAFT_CODES.has(code)) continue
          if (!(code in KNOWN_CODES)) return badRequest(`The promotion code ${code} is invalid`)
          if (cart.promotions.some((p) => p.code === code)) continue
          cart.promotions.push({ id: `promo_${code}`, code, is_automatic: false })
        }
      } else if (method === 'DELETE') {
        const drop = codes.map((c) => String(c))
        cart.promotions = cart.promotions.filter((p) => !drop.includes(p.code))
      }
      recompute()
      return ok({ cart: snapshot() })
    }

    const m = path.match(/^\/store\/carts\/([^/]+)(\/line-items(?:\/([^/]+))?)?$/)
    if (m) {
      if (!cart) return notFound()
      const lineId = m[3]

      // /store/carts/:id  (GET fetch, or POST set email/address)
      if (!m[2]) {
        if (method === 'GET') return ok({ cart: snapshot() })
        if (body.email) cart.email = body.email
        return ok({ cart: snapshot() })
      }

      // POST /store/carts/:id/line-items  (add)
      if (method === 'POST' && !lineId) {
        const { variant_id, quantity } = body
        const v = BY_VARIANT[variant_id]
        const existing = cart.items.find((i) => i.variant_id === variant_id)
        if (existing) existing.quantity += quantity
        else
          cart.items.push({
            id: `li_${variant_id}`,
            variant_id,
            product_id: v?.product_id,
            product_title: v?.title,
            title: v?.title,
            variant_sku: v?.sku,
            unit_price: v?.price ?? 0,
            quantity,
            thumbnail: null,
          })
        recompute()
        return ok({ cart: snapshot() })
      }

      // POST /store/carts/:id/line-items/:lineId  (update qty)
      if (method === 'POST' && lineId) {
        const li = cart.items.find((i) => i.id === lineId)
        if (li) li.quantity = body.quantity
        recompute()
        return ok({ cart: snapshot() })
      }

      // DELETE /store/carts/:id/line-items/:lineId  (remove)
      if (method === 'DELETE' && lineId) {
        cart.items = cart.items.filter((i) => i.id !== lineId)
        recompute()
        return ok({ parent: snapshot() })
      }
    }

    return notFound()
  })

  global.fetch = fetchMock as unknown as typeof fetch

  return {
    fetchMock,
    get cart() {
      return cart
    },
    reset() {
      cart = null
    },
  }
}
