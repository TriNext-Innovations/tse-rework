import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductSearch } from '@/app/(storefront)/compatibility/ProductSearch'
import { useProductSearch } from '@/lib/product-search'

vi.mock('@/lib/product-search', () => ({
  useProductSearch: vi.fn(),
  isSearchConfigured: vi.fn(() => true),
}))

const hit = {
  id: 'prod_1',
  title: 'HP 177 Black',
  handle: 'hp-177',
  sku: 'HP-177-K',
  brand: 'HP',
  cartridge_type: 'inkjet',
  price_zar: 150,
  image_url: null,
  categories: ['HP'],
}

function setSearch(over: Partial<ReturnType<typeof useProductSearch>> = {}) {
  vi.mocked(useProductSearch).mockReturnValue({
    hits: [], loading: false, failed: false, configured: true, ...over,
  } as any)
}

beforeEach(() => {
  setSearch()
})

describe('ProductSearch', () => {
  it('labels itself as the cartridge search, distinct from the printer search', () => {
    render(<ProductSearch />)
    expect(screen.getByText(/already know the cartridge/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/search cartridges by name, brand or sku/i),
    ).toBeInTheDocument()
  })

  it('submits to /products so the full result set stays reachable without JS', () => {
    const { container } = render(<ProductSearch />)
    const form = container.querySelector('form')
    expect(form).toHaveAttribute('action', '/products')
    expect(form).toHaveAttribute('method', 'GET')
    expect(container.querySelector('input[name="q"]')).toBeInTheDocument()
  })

  it('shows nothing until the shopper types', () => {
    render(<ProductSearch />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists matches and links each to its product page', async () => {
    setSearch({ hits: [hit] as any })
    render(<ProductSearch />)
    await userEvent.type(screen.getByLabelText(/search cartridges/i), 'hp 177')

    const link = screen.getByRole('link', { name: /HP 177 Black/ })
    expect(link).toHaveAttribute('href', '/products/hp-177')
    expect(screen.getByText(/SKU HP-177-K/)).toBeInTheDocument()
  })

  it('offers a see-all link carrying the query through', async () => {
    setSearch({ hits: [hit] as any })
    render(<ProductSearch />)
    await userEvent.type(screen.getByLabelText(/search cartridges/i), 'hp 177')

    expect(screen.getByRole('link', { name: /see all results/i }))
      .toHaveAttribute('href', '/products?q=hp%20177')
  })

  it('tells the shopper when nothing matched, and points them onward', async () => {
    setSearch({ hits: [] })
    render(<ProductSearch />)
    await userEvent.type(screen.getByLabelText(/search cartridges/i), 'zzzz')

    expect(screen.getByText(/nothing matched/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse all cartridges/i })).toBeInTheDocument()
  })

  it('surfaces an outage instead of pretending there are no results', async () => {
    setSearch({ failed: true })
    render(<ProductSearch />)
    await userEvent.type(screen.getByLabelText(/search cartridges/i), 'hp')

    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/nothing matched/i)).not.toBeInTheDocument()
  })

  it('renders nothing at all when search is not configured', () => {
    setSearch({ configured: false })
    const { container } = render(<ProductSearch />)
    expect(container).toBeEmptyDOMElement()
  })
})
