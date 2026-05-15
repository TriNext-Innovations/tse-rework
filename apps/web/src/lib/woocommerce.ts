export interface WCProduct {
  id: number
  name: string
  sku: string
  status: string
  type: string
  price: string
  regular_price: string
  sale_price: string
  stock_status: string
  stock_quantity: number | null
  description: string
  short_description: string
  categories: { id: number; name: string; slug: string }[]
  tags: { id: number; name: string; slug: string }[]
  attributes: { id: number; name: string; options: string[] }[]
  images: { id: number; src: string; alt: string }[]
  variations: number[]
}

export interface WCVariation {
  id: number
  sku: string
  price: string
  stock_status: string
  stock_quantity: number | null
  attributes: { name: string; option: string }[]
}

export interface ProductExport {
  total: number
  totalPages: number
  missingSkuCount: number
  missingSku: { id: number; name: string }[]
  products: (WCProduct & { variationData?: WCVariation[] })[]
}

function authHeader(): string {
  const key = process.env.WC_CONSUMER_KEY
  const secret = process.env.WC_CONSUMER_SECRET
  if (!key || !secret) throw new Error('WC_CONSUMER_KEY and WC_CONSUMER_SECRET must be set')
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

const WC_BASE = `${process.env.WC_STORE_URL ?? 'https://tse.co.za'}/wp-json/wc/v3`

async function wcFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<{ data: T; headers: Headers }> {
  const url = new URL(`${WC_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader() },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WooCommerce API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as T
  return { data, headers: res.headers }
}

export async function fetchAllProducts(): Promise<ProductExport> {
  const PER_PAGE = 100
  const products: WCProduct[] = []

  // Fetch first page to get totals
  const first = await wcFetch<WCProduct[]>('/products', { per_page: PER_PAGE, page: 1 })
  const total = parseInt(first.headers.get('X-WP-Total') ?? '0', 10)
  const totalPages = parseInt(first.headers.get('X-WP-TotalPages') ?? '1', 10)
  products.push(...first.data)

  // Fetch remaining pages in parallel (batched to avoid hammering the server)
  const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  for (let i = 0; i < remaining.length; i += 5) {
    const batch = remaining.slice(i, i + 5)
    const results = await Promise.all(
      batch.map((page) => wcFetch<WCProduct[]>('/products', { per_page: PER_PAGE, page }))
    )
    results.forEach((r) => products.push(...r.data))
  }

  // Fetch variations for variable products
  const variable = products.filter((p) => p.type === 'variable' && p.variations.length > 0)
  const variationMap = new Map<number, WCVariation[]>()

  for (let i = 0; i < variable.length; i += 5) {
    const batch = variable.slice(i, i + 5)
    const results = await Promise.all(
      batch.map((p) => wcFetch<WCVariation[]>(`/products/${p.id}/variations`, { per_page: 100 }))
    )
    batch.forEach((p, idx) => variationMap.set(p.id, results[idx].data))
  }

  const enriched = products.map((p) => ({
    ...p,
    ...(variationMap.has(p.id) ? { variationData: variationMap.get(p.id) } : {}),
  }))

  const missingSku = enriched
    .filter((p) => !p.sku || p.sku.trim() === '')
    .map((p) => ({ id: p.id, name: p.name }))

  return {
    total,
    totalPages,
    missingSkuCount: missingSku.length,
    missingSku,
    products: enriched,
  }
}

export async function fetchProductPage(page: number, perPage = 100): Promise<{ data: WCProduct[]; total: number; totalPages: number }> {
  const { data, headers } = await wcFetch<WCProduct[]>('/products', { per_page: perPage, page })
  return {
    data,
    total: parseInt(headers.get('X-WP-Total') ?? '0', 10),
    totalPages: parseInt(headers.get('X-WP-TotalPages') ?? '1', 10),
  }
}
