import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'

// Stateful mock of the Medusa store API — just enough surface for the E2E
// suite: regions, categories, products (handle/id filters), compatibility
// models, and full cart CRUD in the same response shapes the storefront's
// checkout-cart.ts expects. Deterministic by design: no DB, no network.

type Variant = { id: string; sku: string; calculated_price: { calculated_amount: number } }
type Product = {
  id: string
  title: string
  handle: string
  variants: Variant[]
  categories: Array<{ id: string; name: string; handle: string }>
  images: Array<{ url: string }>
  metadata: Record<string, string>
}

const CATEGORIES = [
  { id: 'cat_hp', name: 'HP', handle: 'hp', parent_category: null },
  { id: 'cat_canon', name: 'Canon', handle: 'canon', parent_category: null },
]

function product(n: number, title: string, handle: string, cat: number, price: number): Product {
  return {
    id: `prod_${n}`,
    title,
    handle,
    variants: [{ id: `variant_${n}`, sku: `SKU-${n}`, calculated_price: { calculated_amount: price } }],
    categories: [CATEGORIES[cat]],
    images: [],
    metadata: { cartridge_type: 'toner' },
  }
}

const PRODUCTS: Product[] = [
  // The homepage hero product — handle must match HERO_HANDLE in page.tsx.
  {
    ...product(1, 'Canon 737 Black Toner', 'canon-ca737', 1, 300),
    variants: [{ id: 'variant_1', sku: 'CAN-737', calculated_price: { calculated_amount: 300 } }],
  },
  product(2, 'HP 123 Black Inkjet', 'hp-123-black', 0, 399),
  product(3, 'HP 26A Black Toner', 'hp-26a', 0, 549),
  product(4, 'Canon PG-445 Black', 'canon-pg445', 1, 289),
  product(5, 'HP 305 Tri-colour', 'hp-305-colour', 0, 449),
  product(6, 'Canon CL-446 Colour', 'canon-cl446', 1, 329),
]

const COMPAT_MODELS = [
  { brand: 'Canon', model: 'PIXMA MX494', cartridge_count: 4 },
  { brand: 'HP', model: 'LaserJet Pro M404dn', cartridge_count: 3 },
]

// ── Stateful carts ────────────────────────────────────────────────────────────
type Line = {
  id: string
  title: string
  product_title: string
  variant_sku: string
  thumbnail: null
  unit_price: number
  quantity: number
  variant_id: string
}
type Cart = { id: string; items: Line[]; item_total: number; total: number }

const carts = new Map<string, Cart>()
let cartSeq = 0
let lineSeq = 0

function recompute(cart: Cart) {
  cart.item_total = cart.items.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  cart.total = cart.item_total
}

function addLine(cart: Cart, variantId: string, quantity: number) {
  const existing = cart.items.find((l) => l.variant_id === variantId)
  if (existing) {
    existing.quantity += quantity
  } else {
    const p = PRODUCTS.find((pr) => pr.variants.some((v) => v.id === variantId))
    const v = p?.variants.find((vv) => vv.id === variantId)
    cart.items.push({
      id: `line_${++lineSeq}`,
      title: p?.title ?? 'Product',
      product_title: p?.title ?? 'Product',
      variant_sku: v?.sku ?? '',
      thumbnail: null,
      unit_price: v?.calculated_price.calculated_amount ?? 0,
      quantity,
      variant_id: variantId,
    })
  }
  recompute(cart)
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
  })
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost:9001')
  const path = url.pathname
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', '*')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  const send = (status: number, body: unknown) => { res.writeHead(status); res.end(JSON.stringify(body)) }

  // Cart line-item routes (most specific first)
  const lineMatch = path.match(/^\/store\/carts\/([^/]+)\/line-items(?:\/([^/]+))?$/)
  if (lineMatch) {
    const cart = carts.get(lineMatch[1])
    if (!cart) return send(404, { error: 'cart not found' })
    if (req.method === 'POST' && !lineMatch[2]) {
      const body = await readBody(req)
      addLine(cart, body.variant_id, body.quantity ?? 1)
      return send(200, { cart })
    }
    if (req.method === 'POST' && lineMatch[2]) {
      const body = await readBody(req)
      const line = cart.items.find((l) => l.id === lineMatch[2])
      if (line) line.quantity = body.quantity
      recompute(cart)
      return send(200, { cart })
    }
    if (req.method === 'DELETE' && lineMatch[2]) {
      cart.items = cart.items.filter((l) => l.id !== lineMatch[2])
      recompute(cart)
      return send(200, { id: lineMatch[2], object: 'line-item', deleted: true, parent: cart })
    }
  }

  const cartMatch = path.match(/^\/store\/carts(?:\/([^/]+))?$/)
  if (cartMatch) {
    if (req.method === 'POST' && !cartMatch[1]) {
      const cart: Cart = { id: `cart_${++cartSeq}`, items: [], item_total: 0, total: 0 }
      carts.set(cart.id, cart)
      return send(200, { cart })
    }
    if (cartMatch[1]) {
      const cart = carts.get(cartMatch[1])
      if (!cart) return send(404, { error: 'cart not found' })
      if (req.method === 'POST') { await readBody(req); return send(200, { cart }) }
      return send(200, { cart })
    }
  }

  if (path.includes('/store/regions')) {
    return send(200, { regions: [{ id: 'reg_01', name: 'South Africa', currency_code: 'zar' }] })
  }
  if (path.includes('/store/product-categories')) {
    return send(200, { product_categories: CATEGORIES })
  }
  if (path.includes('/store/compatibility/models')) {
    return send(200, { models: COMPAT_MODELS })
  }
  if (path.includes('/store/products')) {
    let list = PRODUCTS
    const handle = url.searchParams.get('handle')
    if (handle) list = list.filter((p) => p.handle === handle)
    const ids = url.searchParams.getAll('id[]')
    if (ids.length) list = list.filter((p) => ids.includes(p.id))
    const category = url.searchParams.getAll('category_id[]')
    if (category.length) list = list.filter((p) => p.categories.some((c) => category.includes(c.id)))
    return send(200, { products: list, count: list.length })
  }
  if (path.includes('/health')) return send(200, { status: 'ok' })

  return send(404, { error: `no mock for ${req.method} ${path}` })
}

let server: http.Server

export default async function globalSetup() {
  server = http.createServer((req, res) => { void handler(req, res) })
  await new Promise<void>((resolve) => server.listen(9001, resolve))
  console.log('Mock Medusa API running on :9001')

  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
