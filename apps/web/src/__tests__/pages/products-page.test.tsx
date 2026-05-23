import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartProvider } from '@/contexts/CartContext'
import { useSearchParams } from 'next/navigation'
import React, { Suspense } from 'react'

// Mock child client components to isolate server component logic
vi.mock('@/app/(storefront)/products/ProductFilters', () => ({
  ProductFilters: ({ categories }: { categories: any[] }) => (
    <aside data-testid="filters" data-category-count={categories.length} />
  ),
}))

vi.mock('@/app/(storefront)/products/AddToCartButton', () => ({
  AddToCartButton: ({ title, id }: { title: string; id: string }) => (
    <button data-testid={`atc-${id}`}>{title}</button>
  ),
}))

const makeProduct = (id: string, title: string, price?: number) => ({
  id,
  title,
  handle: id,
  variants: [{ sku: `SKU-${id}`, calculated_price: price ? { calculated_amount: price * 100 } : null }],
  categories: [{ id: 'cat_hp', name: 'HP', handle: 'hp' }],
  images: [],
  metadata: { cartridge_type: 'laser' },
})

function setupFetch(regionId: string, categories: any[], products: any[], count: number) {
  let call = 0
  vi.stubGlobal('fetch', vi.fn(() => {
    call++
    if (call === 1) return Promise.resolve({ json: () => Promise.resolve({ regions: regionId ? [{ id: regionId }] : [] }) })
    if (call === 2) return Promise.resolve({ json: () => Promise.resolve({ product_categories: categories }) })
    return Promise.resolve({ json: () => Promise.resolve({ products, count }) })
  }))
}

async function renderProductsPage(params: { category?: string; page?: string } = {}) {
  const { default: ProductsPage } = await import('@/app/(storefront)/products/page')
  const jsx = await ProductsPage({ searchParams: Promise.resolve(params) })
  return render(
    <CartProvider>
      <Suspense fallback={<div>loading</div>}>{jsx}</Suspense>
    </CartProvider>,
  )
}

beforeEach(() => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as any)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('ProductsPage', () => {
  it('renders page heading "All cartridges" when no category selected', async () => {
    setupFetch('reg_01', [], [], 0)
    await renderProductsPage()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('cartridges')).toBeInTheDocument()
  })

  it('renders active category name in heading when category is selected', async () => {
    const cats = [{ id: 'cat_hp', name: 'HP', handle: 'hp', parent_category: null }]
    setupFetch('reg_01', cats, [], 0)
    await renderProductsPage({ category: 'cat_hp' })
    expect(screen.getByText('HP')).toBeInTheDocument()
  })

  it('shows product count', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123')], 1)
    await renderProductsPage()
    expect(screen.getByText('1 products')).toBeInTheDocument()
  })

  it('renders product cards', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123'), makeProduct('p2', 'Canon 737')], 2)
    await renderProductsPage()
    expect(screen.getByRole('heading', { name: 'HP 123' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Canon 737' })).toBeInTheDocument()
  })

  it('shows "No products found" when empty', async () => {
    setupFetch('reg_01', [], [], 0)
    await renderProductsPage()
    expect(screen.getByText('No products found.')).toBeInTheDocument()
  })

  it('shows formatted price', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123', 300)], 1)
    await renderProductsPage()
    expect(screen.getByText('R300')).toBeInTheDocument()
  })

  it('shows "POA" for products without price', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123')], 1)
    await renderProductsPage()
    expect(screen.getByText('POA')).toBeInTheDocument()
  })

  it('shows SKU on product card', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123')], 1)
    await renderProductsPage()
    expect(screen.getByText('SKU SKU-p1')).toBeInTheDocument()
  })

  it('renders product image when URL is provided', async () => {
    const product = { ...makeProduct('p1', 'HP 123'), images: [{ url: 'https://r2.dev/hp123.jpg' }] }
    setupFetch('reg_01', [], [product], 1)
    await renderProductsPage()
    expect(screen.getByAltText('HP 123')).toHaveAttribute('src', 'https://r2.dev/hp123.jpg')
  })

  it('renders gradient placeholder when no image', async () => {
    setupFetch('reg_01', [], [makeProduct('p1', 'HP 123')], 1)
    await renderProductsPage()
    expect(screen.queryByAltText('HP 123')).not.toBeInTheDocument()
  })

  it('renders filters sidebar with categories', async () => {
    const cats = [{ id: 'cat_hp', name: 'HP', handle: 'hp', parent_category: null }]
    setupFetch('reg_01', cats, [], 0)
    await renderProductsPage()
    expect(screen.getByTestId('filters')).toHaveAttribute('data-category-count', '1')
  })

  it('does not render pagination when only 1 page', async () => {
    const products = Array.from({ length: 5 }, (_, i) => makeProduct(`p${i}`, `Product ${i}`))
    setupFetch('reg_01', [], products, 5)
    await renderProductsPage()
    expect(screen.queryByText(/Prev/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument()
  })

  it('shows "Next →" link on page 1 when more pages exist', async () => {
    const products = Array.from({ length: 24 }, (_, i) => makeProduct(`p${i}`, `Prod ${i}`))
    setupFetch('reg_01', [], products, 25)
    await renderProductsPage({ page: '1' })
    expect(screen.getByText('Next →')).toBeInTheDocument()
    expect(screen.queryByText('← Prev')).not.toBeInTheDocument()
  })

  it('shows "← Prev" link on page 2', async () => {
    const products = Array.from({ length: 24 }, (_, i) => makeProduct(`p${i}`, `Prod ${i}`))
    setupFetch('reg_01', [], products, 48)
    await renderProductsPage({ page: '2' })
    expect(screen.getByText('← Prev')).toBeInTheDocument()
  })

  it('shows both prev and next on middle page', async () => {
    const products = Array.from({ length: 24 }, (_, i) => makeProduct(`p${i}`, `Prod ${i}`))
    setupFetch('reg_01', [], products, 72)
    await renderProductsPage({ page: '2' })
    expect(screen.getByText('← Prev')).toBeInTheDocument()
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  it('shows page indicator text', async () => {
    const products = Array.from({ length: 24 }, (_, i) => makeProduct(`p${i}`, `Prod ${i}`))
    setupFetch('reg_01', [], products, 48)
    await renderProductsPage({ page: '1' })
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('handles invalid page param gracefully (defaults to page 1)', async () => {
    setupFetch('reg_01', [], [], 0)
    await renderProductsPage({ page: 'invalid' })
    expect(screen.getByText('0 products')).toBeInTheDocument()
  })

  it('renders nav header with Shop link', async () => {
    setupFetch('reg_01', [], [], 0)
    await renderProductsPage()
    expect(screen.getByText('Shop')).toBeInTheDocument()
  })

  it('renders "← Home" back link', async () => {
    setupFetch('reg_01', [], [], 0)
    await renderProductsPage()
    expect(screen.getByText('← Home')).toBeInTheDocument()
  })
})
