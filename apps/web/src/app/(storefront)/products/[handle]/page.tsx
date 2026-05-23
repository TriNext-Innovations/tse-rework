import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout'
import ProductDetail from './ProductDetail'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const FIELDS   = '+images,+categories.id,+categories.name,+categories.handle,+variants.calculated_price,+metadata'
const TYPE_CATS = new Set(['Inkjet Cartridges', 'Laser Cartridges'])

async function getCategories(): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND}/store/product-categories?limit=50&include_descendants_tree=true`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return (d.product_categories ?? []) as any[]
  } catch {
    return []
  }
}

async function getRegionId(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND}/store/regions?limit=1`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return d.regions?.[0]?.id ?? ''
  } catch {
    return ''
  }
}

async function getProduct(handle: string, regionId: string) {
  try {
    const params = new URLSearchParams({ handle, fields: FIELDS, limit: '1' })
    if (regionId) params.set('region_id', regionId)
    const res = await fetch(`${BACKEND}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 60 },
    })
    const d = await res.json()
    return (d.products?.[0] ?? null) as any
  } catch {
    return null
  }
}

async function getRelated(categoryId: string, excludeId: string, regionId: string) {
  try {
    const params = new URLSearchParams({
      'category_id[]': categoryId,
      limit: '5',
      fields: '+images,+categories.id,+categories.name,+variants.calculated_price,+metadata',
    })
    if (regionId) params.set('region_id', regionId)
    const res = await fetch(`${BACKEND}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 300 },
    })
    const d = await res.json()
    return ((d.products ?? []) as any[]).filter((p) => p.id !== excludeId).slice(0, 4)
  } catch {
    return []
  }
}

type Props = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const regionId = await getRegionId()
  const product  = await getProduct(handle, regionId)
  if (!product) return {}
  return {
    title: product.title,
    description: product.description ?? `Quality generic ${product.title} — TSE Online`,
  }
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params
  const [regionId, allCategories] = await Promise.all([getRegionId(), getCategories()])
  const product    = await getProduct(handle, regionId)

  if (!product) notFound()

  const brandCategory = (product.categories ?? []).find((c: any) => !TYPE_CATS.has(c.name))
  const typeCategory  = (product.categories ?? []).find((c: any) =>  TYPE_CATS.has(c.name))

  const related = brandCategory
    ? await getRelated(brandCategory.id, product.id, regionId)
    : []

  const variant  = product.variants?.[0]
  const sku      = variant?.sku ?? ''
  const priceZar = variant?.calculated_price?.calculated_amount
    ? Math.round(variant.calculated_price.calculated_amount / 100)
    : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku,
    description: product.description ?? '',
    brand: { '@type': 'Brand', name: brandCategory?.name ?? 'TSE' },
    image: product.images?.[0]?.url,
    ...(priceZar && {
      offers: {
        '@type': 'Offer',
        price: priceZar,
        priceCurrency: 'ZAR',
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'TSE Online' },
      },
    }),
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar categories={allCategories} />
      <ProductDetail
        product={product}
        related={related}
        brandCategory={brandCategory ?? null}
        typeCategory={typeCategory ?? null}
      />
    </div>
  )
}
