import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout'
import ProductDetail from './ProductDetail'
import { TYPE_CATEGORY_NAMES as TYPE_CATS } from '@/lib/taxonomy'
import { organizationRef } from '@/lib/structured-data'
import { htmlToPlainText } from '@/lib/html-text'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const FIELDS   = '+images,+categories.id,+categories.name,+categories.handle,+variants.calculated_price,+variants.title,+variants.options,+options,+metadata'

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
  const plain = product.description ? htmlToPlainText(product.description) : ''
  const title = product.title
  const description = plain ? plain.slice(0, 160) : `Quality generic ${product.title} — TSE Online`
  const url = `https://tse-cartridges.co.za/products/${handle}`
  const image = product.images?.[0]?.url
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image] }),
    },
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

  const canonical = `https://tse-cartridges.co.za/products/${handle}`

  // One Offer per variant. The Merchant Center feed submits every variant as its
  // own item against this single landing page, so publishing only variants[0]'s
  // price made Google compare (say) hp-216a's R900 black against three colours
  // fed at R1,000 — a price mismatch, which is a disapproval. Black-vs-colour and
  // yield-tier splits are normal pricing here, not data errors.
  const offers = (product.variants ?? [])
    .filter((v: any) => typeof v.calculated_price?.calculated_amount === 'number')
    .map((v: any) => ({
      '@type': 'Offer',
      ...(v.sku && { sku: v.sku }),
      price: v.calculated_price.calculated_amount,
      priceCurrency: (v.calculated_price.currency_code ?? 'zar').toUpperCase(),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: canonical,
      seller: organizationRef,
    }))
  const prices = offers.map((o: any) => o.price)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    // Only meaningful as a product-level identifier when there's a single variant;
    // otherwise each SKU is declared on its own Offer.
    ...(offers.length === 1 && offers[0].sku && { sku: offers[0].sku }),
    description: product.description ? htmlToPlainText(product.description) : '',
    brand: { '@type': 'Brand', name: brandCategory?.name ?? 'TSE' },
    image: product.images?.[0]?.url,
    ...(offers.length === 1 && { offers: offers[0] }),
    ...(offers.length > 1 && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: offers[0].priceCurrency,
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: offers.length,
        offers,
      },
    }),
  }

  const breadcrumbItems = [
    { name: 'Home', url: 'https://tse-cartridges.co.za' },
    { name: 'Products', url: 'https://tse-cartridges.co.za/products' },
    ...(brandCategory
      ? [{ name: brandCategory.name, url: `https://tse-cartridges.co.za/products?brand=${encodeURIComponent(brandCategory.name)}` }]
      : []),
    { name: product.title, url: `https://tse-cartridges.co.za/products/${handle}` },
  ]
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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
