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

export function installCartMock() {
  let cart: { id: string; email: string | null; item_total: number; total: number; items: Line[] } | null = null
  let seq = 0

  const recompute = () => {
    if (!cart) return
    cart.item_total = cart.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    cart.total = cart.item_total
  }

  // Return a fresh copy each time (the real API returns new JSON), so React sees
  // a new object reference and re-renders.
  const snapshot = () => (cart ? { ...cart, items: cart.items.map((i) => ({ ...i })) } : cart)

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
  const notFound = () => ({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' })

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
      cart = { id: `cart_${++seq}`, email: null, item_total: 0, total: 0, items: [] }
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
