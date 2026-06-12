import { Suspense } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout'
import { ProductFilters } from './ProductFilters'
import { AddToCartButton } from './AddToCartButton'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const MEILI_HOST = process.env.MEILISEARCH_HOST ?? process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? ''
const MEILI_KEY = process.env.MEILISEARCH_API_KEY ?? process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY ?? ''
const PAGE_SIZE = 24

type SearchParams = Promise<{ category?: string; page?: string; q?: string }>

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

type MeiliHit = {
  id: string
  title: string
  handle: string
  sku: string | null
  brand: string | null
  cartridge_type: string | null
  price_zar: number | null
  image_url: string | null
}

async function searchMeilisearch(query: string, offset: number): Promise<{ hits: MeiliHit[]; total: number }> {
  if (!MEILI_HOST || !MEILI_KEY) return { hits: [], total: 0 }
  try {
    const res = await fetch(
      `${MEILI_HOST}/indexes/products/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MEILI_KEY}` },
        body: JSON.stringify({ q: query, limit: PAGE_SIZE, offset }),
        next: { revalidate: 0 },
      }
    )
    if (!res.ok) return { hits: [], total: 0 }
    const data = await res.json()
    return { hits: data.hits ?? [], total: data.estimatedTotalHits ?? data.totalHits ?? 0 }
  } catch {
    return { hits: [], total: 0 }
  }
}

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

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const { category = '', page: pageParam = '1', q = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const isSearch = q.trim().length > 0
  const categoryIds = category ? category.split(',').filter(Boolean) : []

  const allCategories = await getCategories()

  let products: any[] = []
  let total = 0

  if (isSearch) {
    const { hits, total: t } = await searchMeilisearch(q.trim(), offset)
    total = t
    products = hits.map((h) => ({
      id: h.id,
      handle: h.handle,
      title: h.title,
      metadata: { cartridge_type: h.cartridge_type },
      images: h.image_url ? [{ url: h.image_url }] : [],
      variants: [{ sku: h.sku, calculated_price: h.price_zar ? { calculated_amount: h.price_zar * 100 } : null }],
    }))
  } else {
    const regionId = await getRegionId()
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (regionId) params.append('region_id', regionId)
    for (const id of categoryIds) params.append('category_id[]', id)
    params.append('fields', '+metadata,+categories.id,+categories.name,+categories.handle,+images')

    try {
      const data = await fetch(`${BACKEND}/store/products?${params}`, {
        headers: { 'x-publishable-api-key': PUB_KEY },
        next: { revalidate: 60 },
      }).then((r) => r.json())
      products = data.products ?? []
      total = data.count ?? 0
    } catch {
      // Medusa offline — page renders empty with filters still usable
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const activeCategoryName = !isSearch && categoryIds.length > 0
    ? (allCategories.find((c: any) => categoryIds.includes(c.id))?.name ?? '')
    : ''

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827] font-[var(--font-inter)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <Navbar categories={allCategories} />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-28 pb-10">
        {/* Page heading */}
        <div className="mb-8">
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            {isSearch ? (
              <>Results for <span className="font-display-italic">&ldquo;{q}&rdquo;</span></>
            ) : activeCategoryName ? (
              <span className="font-display-italic">{activeCategoryName}</span>
            ) : (
              <>All <span className="font-display-italic">cartridges</span></>
            )}
          </h1>
          <p className="mt-2 text-sm text-[#6B6B66]">{total} {total === 1 ? 'product' : 'products'}</p>
        </div>

        <div className="flex gap-8 lg:gap-12">
          {/* Sidebar — hidden during search, category filters don't apply */}
          {!isSearch && (
            <div className="hidden md:block w-44 flex-shrink-0">
              <Suspense fallback={null}>
                <ProductFilters categories={allCategories} />
              </Suspense>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {products.length === 0 ? (
              <div className="text-center py-24 text-[#6B6B66]">
                {isSearch ? `No results for "${q}".` : 'No products found.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {products.map((p: any, i: number) => {
                  const variant = p.variants?.[0]
                  const sku = variant?.sku ?? '—'
                  const amount = variant?.calculated_price?.calculated_amount
                  const priceZar = amount ? Math.round(amount / 100) : null
                  const type = p.metadata?.cartridge_type === 'inkjet' ? 'Inkjet' : 'Laser'

                  const imageUrl = p.images?.[0]?.url

                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.handle}`}
                      className="group relative bg-white rounded-[16px] p-4 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
                    >
                      {/* Product image */}
                      <div className="relative h-28 flex items-end justify-center mb-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={p.title}
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
                            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                              <span className="font-display text-white text-[9px] leading-none">TSE</span>
                              <span className="w-2 h-2 rounded-full border border-white/40" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-[9px] uppercase tracking-[0.16em] text-[#6B6B66] mb-1">{type}</div>
                      <h2 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{p.title}</h2>
                      <div className="text-[10px] text-[#9ca3af] mb-3">SKU {sku}</div>

                      <div className="flex items-end justify-between">
                        <div className="font-display text-lg">
                          {priceZar ? `R${priceZar}` : <span className="text-[#9ca3af] text-sm">POA</span>}
                        </div>
                        <AddToCartButton id={p.id} title={p.title} sku={sku} price={priceZar} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/products?${new URLSearchParams({ ...(isSearch ? { q } : category ? { category } : {}), page: String(page - 1) })}`}
                    className="px-4 py-2 rounded-full border border-black/15 text-sm hover:border-black/40 transition-colors"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-sm text-[#6B6B66] px-2">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/products?${new URLSearchParams({ ...(isSearch ? { q } : category ? { category } : {}), page: String(page + 1) })}`}
                    className="px-4 py-2 rounded-full border border-black/15 text-sm hover:border-black/40 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
