import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterPanel } from '@/app/(storefront)/products/FilterPanel'
import { useRouter, useSearchParams } from 'next/navigation'

const mockPush = vi.fn()

const mockCategories = [
  { id: 'cat_hp_ink', name: 'HP', parent_category: { name: 'Inkjet Cartridges' } },
  { id: 'cat_canon_ink', name: 'Canon', parent_category: { name: 'Inkjet Cartridges' } },
  { id: 'cat_hp_laser', name: 'HP', parent_category: { name: 'Laser Cartridges' } },
  { id: 'cat_kyocera_laser', name: 'Kyocera', parent_category: { name: 'Laser Cartridges' } },
  { id: 'cat_inkjet', name: 'Inkjet Cartridges', parent_category: null },
  { id: 'cat_laser', name: 'Laser Cartridges', parent_category: null },
]

function setParams(qs = '') {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(qs) as any)
}

beforeEach(() => {
  mockPush.mockClear()
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() } as any)
  setParams('')
})

describe('FilterPanel', () => {
  it('renders the All products button and type pills', () => {
    render(<FilterPanel categories={mockCategories} />)
    expect(screen.getByText('All products')).toBeInTheDocument()
    expect(screen.getByText('Inkjet')).toBeInTheDocument()
    expect(screen.getByText('Laser')).toBeInTheDocument()
  })

  it('lists deduplicated brands sorted alphabetically', () => {
    render(<FilterPanel categories={mockCategories} />)
    expect(screen.getByText('Canon')).toBeInTheDocument()
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('Kyocera')).toBeInTheDocument()
  })

  it('excludes type categories from the brand list', () => {
    render(<FilterPanel categories={mockCategories} />)
    expect(screen.queryByText('Inkjet Cartridges')).not.toBeInTheDocument()
    expect(screen.queryByText('Laser Cartridges')).not.toBeInTheDocument()
  })

  it('clicking a brand navigates with ?brand=<name>', async () => {
    render(<FilterPanel categories={mockCategories} />)
    await userEvent.click(screen.getByText('HP'))
    expect(mockPush).toHaveBeenCalledWith('/products?brand=HP')
  })

  it('clicking a type navigates with ?type=<key>', async () => {
    render(<FilterPanel categories={mockCategories} />)
    await userEvent.click(screen.getByText('Laser'))
    expect(mockPush).toHaveBeenCalledWith('/products?type=laser')
  })

  it('only shows brands available under the selected type', () => {
    setParams('type=laser')
    render(<FilterPanel categories={mockCategories} />)
    expect(screen.getByText('HP')).toBeInTheDocument()
    expect(screen.getByText('Kyocera')).toBeInTheDocument()
    // Canon only exists under Inkjet in the mock
    expect(screen.queryByText('Canon')).not.toBeInTheDocument()
  })

  it('drops a brand not offered under a newly selected type', async () => {
    setParams('brand=Canon')
    render(<FilterPanel categories={mockCategories} />)
    await userEvent.click(screen.getByText('Laser'))
    const call = mockPush.mock.calls[0]![0] as string
    expect(call).toContain('type=laser')
    expect(call).not.toContain('brand=Canon')
  })

  it('All products clears type and brand but keeps other params', async () => {
    setParams('type=laser&brand=HP&other=val')
    render(<FilterPanel categories={mockCategories} />)
    await userEvent.click(screen.getByText('All products'))
    const call = mockPush.mock.calls[0]![0] as string
    expect(call).toContain('other=val')
    expect(call).not.toContain('type=')
    expect(call).not.toContain('brand=')
  })

  it('removes the page param when changing a filter', async () => {
    setParams('page=3')
    render(<FilterPanel categories={mockCategories} />)
    await userEvent.click(screen.getByText('Canon'))
    const call = mockPush.mock.calls[0]![0] as string
    expect(call).not.toContain('page=')
    expect(call).toContain('brand=Canon')
  })

  it('marks the active brand with active styling', () => {
    setParams('brand=HP')
    render(<FilterPanel categories={mockCategories} />)
    const hp = screen.getByText('HP')
    expect(hp.className).toContain('bg-[#111827]')
    expect(hp.className).toContain('text-white')
  })
})
