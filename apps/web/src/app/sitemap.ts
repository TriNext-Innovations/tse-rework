import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'
import { CATEGORIES } from '@/lib/categories'
import { fetchPrinterModels, printerSlug } from '@/lib/printers'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const BASE = SITE_URL

// lastmod must mean "this page changed then". A value that is always the build
// time teaches Google to ignore the field for the whole sitemap (#525). Pages
// we have no honest date for (printer models, contact, legal) omit it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: SitemapProduct[] = []
  try {
    products = await fetchAllProducts()
  } catch {
    // Fall through with no products: static pages only, no dates.
  }

  // Category handle → newest product change in it. A key with no date still
  // marks the category as stocked.
  const stocked = new Map<string, Date | undefined>()
  let newest: Date | undefined
  for (const p of products) {
    const d = p.updated_at ? new Date(p.updated_at) : undefined
    const valid = d && !Number.isNaN(d.getTime()) ? d : undefined
    if (valid && (!newest || valid > newest)) newest = valid
    for (const c of p.categories ?? []) {
      if (!c.handle) continue
      const cur = stocked.get(c.handle)
      stocked.set(c.handle, valid && (!cur || valid > cur) ? valid : cur)
    }
  }
  // Listing pages change when any product does.
  const catalogue = newest ? { lastModified: newest } : {}

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, ...catalogue, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/products`, ...catalogue, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/compatibility`, ...catalogue, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/printers`, ...catalogue, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/legal/returns`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/legal/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/legal/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/legal/cookies`, changeFrequency: 'monthly', priority: 0.2 },
  ]
  if (products.length === 0) return staticPages

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE}/products/${p.handle}`,
    ...(p.updated_at ? { lastModified: new Date(p.updated_at) } : {}),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Only categories that actually hold stock. The category page 404s when it
  // is empty, so listing one here would submit a known-404 to Google — and an
  // empty category page is thin content we do not want indexed anyway.
  const categoryPages: MetadataRoute.Sitemap = CATEGORIES
    .filter((c) => stocked.has(c.medusaHandle))
    .map((c) => {
      const d = stocked.get(c.medusaHandle)
      return {
        url: `${BASE}/cartridges/${c.slug}`,
        ...(d ? { lastModified: d } : {}),
        changeFrequency: 'daily' as const,
        // Above product pages (0.7): these are the pages the legacy site ranks
        // on and the ones the cutover redirects will land against.
        priority: 0.8,
      }
    })

  // Printer-model pages. Every one of the 903 models was checked against the
  // live compatibility lookup on 21 Aug and all returned at least one
  // cartridge, so none of these is a known 404 — but the page still 404s on
  // an empty result, so if that ever changes the sitemap is the thing to
  // re-audit. The compatibility data carries no timestamps, so no lastmod.
  const printerPages: MetadataRoute.Sitemap = (await fetchPrinterModels()).map((m) => ({
    url: `${BASE}/printers/${printerSlug(m.brand, m.model)}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...categoryPages, ...printerPages, ...productPages]
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
