import type { MetadataRoute } from 'next'
import { CATEGORIES } from '@/lib/categories'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const BASE = 'https://tse-cartridges.co.za'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/compatibility`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/legal/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/legal/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/legal/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/legal/cookies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  try {
    const products = await fetchAllProducts()
    const productPages: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${BASE}/products/${p.handle}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    // Only categories that actually hold stock. The category page 404s when it
    // is empty, so listing one here would submit a known-404 to Google — and an
    // empty category page is thin content we do not want indexed anyway.
    const stocked = new Set<string>()
    for (const p of products) {
      for (const c of p.categories ?? []) if (c.handle) stocked.add(c.handle)
    }
    const categoryPages: MetadataRoute.Sitemap = CATEGORIES
      .filter((c) => stocked.has(c.medusaHandle))
      .map((c) => ({
        url: `${BASE}/cartridges/${c.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        // Above product pages (0.7): these are the pages the legacy site ranks
        // on and the ones the cutover redirects will land against.
        priority: 0.8,
      }))

    return [...staticPages, ...categoryPages, ...productPages]
  } catch {
    return staticPages
  }
}

// A single capped fetch silently truncates once the catalog outgrows the
// page size (hit this at exactly 300/500 published products) — page through
// the full result set instead.
type SitemapProduct = {
  handle: string
  updated_at?: string
  categories?: { handle?: string }[]
}

async function fetchAllProducts(): Promise<SitemapProduct[]> {
  const PAGE_SIZE = 200
  const all: SitemapProduct[] = []
  let offset = 0
  for (;;) {
    const res = await fetch(
      `${BACKEND}/store/products?limit=${PAGE_SIZE}&offset=${offset}&fields=handle,updated_at,+categories.handle`,
      { headers: { 'x-publishable-api-key': PUB_KEY }, next: { revalidate: 3600 } },
    )
    const { products = [], count = 0 } = await res.json()
    all.push(...products)
    offset += PAGE_SIZE
    if (offset >= count || products.length === 0) break
  }
  return all
}
