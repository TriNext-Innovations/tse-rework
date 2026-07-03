import StorefrontClient, { type HeroProduct } from './StorefrontClient'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const FIELDS = '+metadata,+categories.id,+categories.name,+categories.handle,+images'

// The product behind the hero "Bestseller" card. Resolved server-side so the
// hero add-to-cart targets a real purchasable variant.
const HERO_HANDLE = 'canon-ca737'

async function fetchProducts(url: string): Promise<any[]> {
  const res = await fetch(url, {
    headers: { 'x-publishable-api-key': PUB_KEY },
    next: { revalidate: 300 },
  })
  const data = await res.json()
  return data.products ?? []
}

async function fetchCompatModels(): Promise<Array<{ brand: string; model: string; cartridge_count: number }>> {
  try {
    const res = await fetch(`${BACKEND}/store/compatibility/models`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return d.models ?? []
  } catch {
    return []
  }
}

async function fetchHeroProduct(regionId: string): Promise<HeroProduct | null> {
  try {
    const products = await fetchProducts(
      `${BACKEND}/store/products?handle=${HERO_HANDLE}${regionId ? `&region_id=${regionId}` : ''}&fields=id,title,handle,+images.url,variants.id,variants.sku,variants.calculated_price.calculated_amount`
    )
    const p = products[0]
    const v = p?.variants?.[0]
    if (!p || !v?.id) return null
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      sku: v.sku ?? '',
      variantId: v.id,
      price: v.calculated_price?.calculated_amount ?? null,
      image: p.images?.[0]?.url ?? null,
    }
  } catch {
    return null
  }
}

export default async function StorefrontPage() {
  let trendingProducts: any[] = []
  let heroProduct: HeroProduct | null = null
  const compatModels = await fetchCompatModels()

  try {
    // Attempt 1: fetch with region for calculated prices
    const regionRes = await fetch(`${BACKEND}/store/regions?limit=1`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const { regions } = await regionRes.json()
    const regionId = regions?.[0]?.id ?? ''

    ;[trendingProducts, heroProduct] = await Promise.all([
      fetchProducts(
        `${BACKEND}/store/products?limit=6${regionId ? `&region_id=${regionId}` : ''}&fields=${FIELDS}`
      ),
      fetchHeroProduct(regionId),
    ])

    // Attempt 2: fallback without region if first attempt returned nothing
    if (trendingProducts.length === 0) {
      trendingProducts = await fetchProducts(
        `${BACKEND}/store/products?limit=6&fields=${FIELDS}`
      )
    }
  } catch {
    // Medusa unavailable — homepage still renders without products
  }

  return (
    <StorefrontClient
      trendingProducts={trendingProducts}
      compatModels={compatModels}
      heroProduct={heroProduct}
    />
  )
}
