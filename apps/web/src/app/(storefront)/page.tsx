import StorefrontClient from './StorefrontClient'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const FIELDS = '+metadata,+categories.id,+categories.name,+categories.handle,+images'

async function fetchProducts(url: string): Promise<any[]> {
  const res = await fetch(url, {
    headers: { 'x-publishable-api-key': PUB_KEY },
    next: { revalidate: 300 },
  })
  const data = await res.json()
  return data.products ?? []
}

export default async function StorefrontPage() {
  let trendingProducts: any[] = []

  try {
    // Attempt 1: fetch with region for calculated prices
    const regionRes = await fetch(`${BACKEND}/store/regions?limit=1`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const { regions } = await regionRes.json()
    const regionId = regions?.[0]?.id ?? ''

    trendingProducts = await fetchProducts(
      `${BACKEND}/store/products?limit=6${regionId ? `&region_id=${regionId}` : ''}&fields=${FIELDS}`
    )

    // Attempt 2: fallback without region if first attempt returned nothing
    if (trendingProducts.length === 0) {
      trendingProducts = await fetchProducts(
        `${BACKEND}/store/products?limit=6&fields=${FIELDS}`
      )
    }
  } catch {
    // Medusa unavailable — homepage still renders without products
  }

  return <StorefrontClient trendingProducts={trendingProducts} />
}
