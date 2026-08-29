import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout'
import { AddToCartButton } from '../../products/AddToCartButton'
import { CATEGORIES, categoryBySlug, type Category } from '@/lib/categories'
import { websiteRef } from '@/lib/structured-data'
import { cartridgeTypeLabel } from '@/lib/taxonomy'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const BASE = 'https://tse-cartridges.co.za'
// The largest category (HP laser) is ~111 products. Fetch the category whole so
// the page can list every model as a crawlable link — pagination here would
// hide most of the catalogue from Google behind a query string.
const FETCH_ALL = 400

type Props = { params: Promise<{ slug: string }> }

type Product = {
  id: string
  handle: string
  title: string
  images?: { url: string }[]
  metadata?: { cartridge_type?: unknown }
  variants?: {
    id: string
    sku?: string | null
    calculated_price?: { calculated_amount?: number } | null
  }[]
}

// Deliberately NO generateStaticParams.
//
// Prerendering these at build time would resolve every category against the
// Medusa API during the build — and CI builds the image with no backend
// reachable, so every fetch would fall to its catch, every page would hit the
// empty-category notFound(), and all fifteen would ship as statically cached
// 404s. The product pages are on-demand for the same reason. Freshness comes
// from the per-fetch `revalidate` instead.

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

async function getCategoryId(handle: string): Promise<string> {
  try {
    const res = await fetch(
      `${BACKEND}/store/product-categories?handle=${encodeURIComponent(handle)}&limit=1&fields=id,handle`,
      { headers: { 'x-publishable-api-key': PUB_KEY }, next: { revalidate: 3600 } },
    )
    const d = await res.json()
    return d.product_categories?.[0]?.id ?? ''
  } catch {
    return ''
  }
}

async function getProducts(categoryId: string, regionId: string): Promise<Product[]> {
  if (!categoryId) return []
  try {
    const params = new URLSearchParams({ limit: String(FETCH_ALL) })
    params.append('category_id[]', categoryId)
    if (regionId) params.set('region_id', regionId)
    params.append(
      'fields',
      '+metadata,+images,+variants.id,+variants.sku,*variants.calculated_price',
    )
    const res = await fetch(`${BACKEND}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 300 },
    })
    const d = await res.json()
    return (d.products ?? []) as Product[]
  } catch {
    // Medusa offline. Returning [] makes the page 404 rather than publishing an
    // empty category — see the notFound() below.
    return []
  }
}

function priceOf(p: Product): number | null {
  const amt = p.variants?.[0]?.calculated_price?.calculated_amount
  return typeof amt === 'number' ? amt : null
}

/**
 * The lede is derived entirely from catalogue data — model count and real price
 * range — rather than written as marketing copy. Two reasons: it stays true as
 * the catalogue changes, and this site has twice shipped published claims it
 * could not honour (PR #388, #389). A number read from the database cannot
 * become a false promise.
 */
function lede(category: Category, products: Product[]): string {
  const prices = products.map(priceOf).filter((n): n is number => n !== null)
  const typeWord = cartridgeTypeLabel(category.type)?.toLowerCase() ?? category.type
  const count = products.length
  const noun = count === 1 ? 'cartridge' : 'cartridges'
  if (prices.length === 0) {
    return `${count} generic ${category.brand} ${typeWord} ${noun} in the TSE catalogue.`
  }
  const low = Math.round(Math.min(...prices))
  const high = Math.round(Math.max(...prices))
  const range = low === high ? `R${low}` : `R${low} to R${high}`
  return `${count} generic ${category.brand} ${typeWord} ${noun} in the TSE catalogue, ${range}.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = categoryBySlug(slug)
  if (!category) return {}

  const [regionId, categoryId] = await Promise.all([getRegionId(), getCategoryId(category.medusaHandle)])
  const products = await getProducts(categoryId, regionId)
  if (products.length === 0) return {}

  const url = `${BASE}/cartridges/${category.slug}`
  const title = category.title
  const description = `${lede(category, products)} Compatible replacements, delivered across South Africa.`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description },
    twitter: { card: 'summary', title, description },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const category = categoryBySlug(slug)
  if (!category) notFound()

  const [regionId, categoryId] = await Promise.all([getRegionId(), getCategoryId(category.medusaHandle)])
  const products = await getProducts(categoryId, regionId)

  // An empty category page is worse than no page — it is thin content, and at
  // cutover it would receive a ranking legacy URL and throw the ranking away.
  // 404 instead, and the page reappears by itself once stock is imported.
  if (products.length === 0) notFound()

  const sorted = [...products].sort((a, b) => a.title.localeCompare(b.title, 'en'))
  const url = `${BASE}/cartridges/${category.slug}`
  const siblings = CATEGORIES.filter((c) => c.slug !== category.slug)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'Home', item: BASE },
      { name: 'Products', item: `${BASE}/products` },
      { name: category.title, item: url },
    ].map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.item })),
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.title,
    url,
    description: lede(category, products),
    isPartOf: websiteRef,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: sorted.length,
      itemListElement: sorted.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.title,
        url: `${BASE}/products/${p.handle}`,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-[var(--font-inter)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-32 pb-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[var(--muted)]">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-[var(--ink)] transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/products" className="hover:text-[var(--ink)] transition-colors">Products</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--ink)]">{category.title}</li>
          </ol>
        </nav>

        <header className="mb-10 max-w-2xl">
          {/* Renders `category.title` verbatim so the <h1> and the <title> state
              the same phrase. Rebuilding it from the type label drifted: the
              title said "HP LaserJet Cartridges" while the heading said "HP
              Laser cartridges". The per-brand wording matters — "LaserJet" is
              HP's product line, so Brother's page is titled "Brother Laser
              Cartridges" even though the legacy slug says laserjet. */}
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            {category.brand}{' '}
            <span className="font-display-italic">
              {category.title.slice(category.brand.length).trim()}
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
            {lede(category, products)}
          </p>
          {/* TODO(claus): a human-written paragraph per brand would outrank a
              derived one. Deliberately not invented here — every claim on this
              site has to be verifiable, and the catalogue is the only source
              currently under our control. */}
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {sorted.map((p, i) => {
            const variant = p.variants?.[0]
            const sku = variant?.sku ?? '—'
            const amount = priceOf(p)
            const priceZar = amount ? Math.round(amount) : null
            const typeLabel = cartridgeTypeLabel(p.metadata?.cartridge_type) ?? cartridgeTypeLabel(category.type) ?? 'Laser'
            const imageUrl = p.images?.[0]?.url

            return (
              <Link
                key={p.id}
                href={`/products/${p.handle}`}
                className="group relative bg-[var(--surface)] rounded-[16px] p-4 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
              >
                <div className="relative h-28 flex items-end justify-center mb-3">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={p.title}
                      width={180}
                      height={220}
                      sizes="180px"
                      className="h-31 w-auto object-contain"
                    />
                  ) : (
                    <div
                      className={`w-16 h-24 rounded-[6px] shadow-[0_12px_24px_-12px_rgba(10,10,10,0.35)] relative overflow-hidden ${
                        i % 4 === 0 ? 'bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A]' :
                        i % 4 === 1 ? 'bg-gradient-to-br from-[#41e0f5] to-[#0fb8d4]' :
                        i % 4 === 2 ? 'bg-gradient-to-br from-[#1a1a2e] to-[#3a3a5c]' :
                        'bg-gradient-to-br from-[#2d1a0e] to-[#5a3520]'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/25" />
                    </div>
                  )}
                </div>

                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] mb-1">{typeLabel}</div>
                <h2 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{p.title}</h2>
                <div className="text-[10px] text-[var(--muted-2)] mb-3">SKU {sku}</div>

                <div className="flex items-end justify-between">
                  <div className="font-display text-lg">
                    {priceZar ? `R${priceZar}` : <span className="text-[var(--muted-2)] text-sm">POA</span>}
                  </div>
                  <AddToCartButton
                    id={p.id}
                    title={p.title}
                    sku={sku}
                    price={priceZar}
                    variantId={variant?.id}
                    thumbnail={imageUrl}
                  />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Every model as a plain crawlable link. The grid above is the same set,
            but this block keeps the full list in the HTML as text — which is what
            a search engine matches a "brother tn-2130 toner" query against. */}
        <section className="mt-16 border-t border-[var(--line-4)] pt-8">
          <h2 className="font-display text-xl mb-4">All {category.brand} {cartridgeTypeLabel(category.type)?.toLowerCase()} models</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
            {sorted.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.handle}`} className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-[var(--line-4)]">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 border-t border-[var(--line-4)] pt-8">
          <h2 className="font-display text-xl mb-4">Other cartridge ranges</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
            {siblings.map((c) => (
              <li key={c.slug}>
                <Link href={`/cartridges/${c.slug}`} className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-[var(--line-4)]">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
