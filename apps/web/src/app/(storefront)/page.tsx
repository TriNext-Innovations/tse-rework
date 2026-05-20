import StorefrontClient from './StorefrontClient'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export default async function StorefrontPage() {
  let trendingProducts: any[] = []

  try {
    const regionRes = await fetch(`${BACKEND}/store/regions?limit=1`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const { regions } = await regionRes.json()
    const regionId = regions?.[0]?.id ?? ''

    const productsRes = await fetch(
      `${BACKEND}/store/products?limit=6&region_id=${regionId}&fields=+metadata,+categories.id,+categories.name,+categories.handle`,
      {
        headers: { 'x-publishable-api-key': PUB_KEY },
        next: { revalidate: 300 },
      }
    )
    const data = await productsRes.json()
    trendingProducts = data.products ?? []
  } catch {
    // Medusa unavailable — homepage still renders without products
  }

  return <StorefrontClient trendingProducts={trendingProducts} />
}
