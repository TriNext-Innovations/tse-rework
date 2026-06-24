import type { MetadataRoute } from 'next'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const BASE = 'https://tse-cartridges.co.za'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/compatibility`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/cart`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/legal/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/legal/cookies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  try {
    const res = await fetch(
      `${BACKEND}/store/products?limit=500&fields=handle,updated_at`,
      { headers: { 'x-publishable-api-key': PUB_KEY }, next: { revalidate: 3600 } },
    )
    const { products = [] } = await res.json()
    const productPages: MetadataRoute.Sitemap = products.map((p: { handle: string; updated_at?: string }) => ({
      url: `${BASE}/products/${p.handle}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
    return [...staticPages, ...productPages]
  } catch {
    return staticPages
  }
}
