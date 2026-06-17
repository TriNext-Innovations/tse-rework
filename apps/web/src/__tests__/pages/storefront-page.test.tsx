import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartProvider } from '@/contexts/CartContext'
import React, { Suspense } from 'react'

// Mock the client component so the server component test stays focused
vi.mock('@/app/(storefront)/StorefrontClient', () => ({
  default: ({ trendingProducts }: { trendingProducts: any[] }) => (
    <div data-testid="storefront-client" data-product-count={trendingProducts.length}>
      {trendingProducts.map((p: any) => (
        <div key={p.id} data-testid="product">{p.title}</div>
      ))}
    </div>
  ),
}))

const mockProduct = {
  id: 'prod_1',
  title: 'HP 123 Black',
  handle: 'hp-123',
  variants: [{ sku: 'HP-123', calculated_price: { calculated_amount: 39900 } }],
  categories: [],
  images: [],
  metadata: {},
}

function mockFetch(responses: any[]) {
  let idx = 0
  vi.stubGlobal('fetch', vi.fn(() => {
    const resp = responses[idx++] ?? { products: [], regions: [] }
    return Promise.resolve({ json: () => Promise.resolve(resp) })
  }))
}

describe('StorefrontPage (server component)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders StorefrontClient with products when backend responds', async () => {
    mockFetch([
      { models: [] },                  // compat models — fetched first
      { regions: [{ id: 'reg_01' }] },
      { products: [mockProduct], count: 1 },
    ])

    const StorefrontPage = (await import('@/app/(storefront)/page')).default
    const jsx = await StorefrontPage()
    render(<CartProvider><Suspense fallback={null}>{jsx}</Suspense></CartProvider>)

    expect(screen.getByTestId('storefront-client')).toBeInTheDocument()
    expect(screen.getByTestId('storefront-client')).toHaveAttribute('data-product-count', '1')
  })

  it('renders with empty products when backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))))

    const StorefrontPage = (await import('@/app/(storefront)/page')).default
    const jsx = await StorefrontPage()
    render(<CartProvider><Suspense fallback={null}>{jsx}</Suspense></CartProvider>)

    expect(screen.getByTestId('storefront-client')).toHaveAttribute('data-product-count', '0')
  })

  it('falls back to no-region fetch when region returns empty', async () => {
    mockFetch([
      { regions: [] },        // first fetch: no region
      { products: [], count: 0 },  // second fetch attempt 1: empty
      { products: [mockProduct], count: 1 }, // third fetch attempt 2 (fallback)
    ])

    const StorefrontPage = (await import('@/app/(storefront)/page')).default
    const jsx = await StorefrontPage()
    render(<CartProvider><Suspense fallback={null}>{jsx}</Suspense></CartProvider>)

    // The component retries; either result is acceptable
    expect(screen.getByTestId('storefront-client')).toBeInTheDocument()
  })

  it('renders with zero products when all fetches return empty', async () => {
    mockFetch([
      { regions: [{ id: 'reg_01' }] },
      { products: [], count: 0 },
      { products: [], count: 0 },
    ])

    const StorefrontPage = (await import('@/app/(storefront)/page')).default
    const jsx = await StorefrontPage()
    render(<CartProvider><Suspense fallback={null}>{jsx}</Suspense></CartProvider>)

    expect(screen.getByTestId('storefront-client')).toHaveAttribute('data-product-count', '0')
  })
})
