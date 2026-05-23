import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductFilters } from '@/app/(storefront)/products/ProductFilters'
import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

const mockPush = vi.fn()

const mockCategories = [
  { id: 'cat_hp', name: 'HP', parent_category: null },
  { id: 'cat_canon', name: 'Canon', parent_category: null },
  { id: 'cat_epson', name: 'Epson', parent_category: null },
  { id: 'cat_inkjet', name: 'Inkjet Cartridges', parent_category: null },
  { id: 'cat_laser', name: 'Laser Cartridges', parent_category: null },
]

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() } as any)
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as any)
})

describe('ProductFilters', () => {
  it('renders "All products" button', () => {
    render(<ProductFilters categories={mockCategories} />)
    expect(screen.getByText('All products')).toBeInTheDocument()
  })

  it('renders brand categories sorted alphabetically', () => {
    render(<ProductFilters categories={mockCategories} />)
    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    const brandButtons = buttons.filter((b) => b !== 'All products')
    expect(brandButtons).toEqual(['Canon', 'Epson', 'HP'])
  })

  it('excludes Inkjet Cartridges and Laser Cartridges from brand list', () => {
    render(<ProductFilters categories={mockCategories} />)
    expect(screen.queryByText('Inkjet Cartridges')).not.toBeInTheDocument()
    expect(screen.queryByText('Laser Cartridges')).not.toBeInTheDocument()
  })

  it('clicking a brand navigates to /products?category=<id>', async () => {
    render(<ProductFilters categories={mockCategories} />)
    await userEvent.click(screen.getByText('HP'))
    expect(mockPush).toHaveBeenCalledWith('/products?category=cat_hp')
  })

  it('clicking "All products" navigates to /products without category', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('category=cat_hp') as any)
    render(<ProductFilters categories={mockCategories} />)
    await userEvent.click(screen.getByText('All products'))
    expect(mockPush).toHaveBeenCalledWith('/products?')
  })

  it('active category button has active styling', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('category=cat_hp') as any)
    render(<ProductFilters categories={mockCategories} />)
    const hpBtn = screen.getByText('HP')
    expect(hpBtn.className).toContain('bg-[#111827]')
    expect(hpBtn.className).toContain('text-white')
  })

  it('"All products" is active when no category is selected', () => {
    render(<ProductFilters categories={mockCategories} />)
    const allBtn = screen.getByText('All products')
    expect(allBtn.className).toContain('bg-[#111827]')
  })

  it('renders empty brand list when all categories are type labels', () => {
    const typeOnly = [
      { id: 'cat_inkjet', name: 'Inkjet Cartridges', parent_category: null },
      { id: 'cat_laser', name: 'Laser Cartridges', parent_category: null },
    ]
    render(<ProductFilters categories={typeOnly} />)
    expect(screen.getByText('All products')).toBeInTheDocument()
    // Only the "All products" button should be there
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('preserves existing URL params when clearing category', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('category=cat_hp&other=val') as any)
    render(<ProductFilters categories={mockCategories} />)
    await userEvent.click(screen.getByText('All products'))
    expect(mockPush).toHaveBeenCalledWith('/products?other=val')
  })

  it('removes page param when changing category', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('page=3') as any)
    render(<ProductFilters categories={mockCategories} />)
    await userEvent.click(screen.getByText('Canon'))
    const call = mockPush.mock.calls[0][0] as string
    expect(call).not.toContain('page=')
    expect(call).toContain('category=cat_canon')
  })
})
