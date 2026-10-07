import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { SearchModal } from '@/components/SearchModal'
import { NAVIGATION_START_EVENT } from '@/lib/motion'

const search = vi.hoisted(() => ({
  state: { hits: [] as Array<Record<string, unknown>>, loading: false },
}))

vi.mock('@/lib/product-search', () => ({
  isSearchConfigured: () => true,
  useProductSearch: () => search.state,
}))

const push = vi.fn()

beforeEach(() => {
  search.state = { hits: [], loading: false }
  vi.mocked(useRouter).mockReturnValue({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>)
})

const HIT = {
  id: 'prod_85a',
  title: 'HP 85A',
  handle: 'hp-85a',
  sku: 'CE285A',
  brand: 'HP',
  cartridge_type: 'laser',
  price_zar: 450,
  image_url: null,
  categories: [],
}

describe('SearchModal loading', () => {
  it('shows placeholder rows while the first results for a query load', () => {
    search.state = { hits: [], loading: true }
    render(<SearchModal open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search cartridges/i), { target: { value: '85A' } })
    expect(screen.getByLabelText('Searching')).toBeInTheDocument()
    expect(document.querySelector('.dot-orb')).toBeInTheDocument()
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument()
  })

  it('keeps earlier results visible, stepped back, while a newer query runs', () => {
    search.state = { hits: [HIT], loading: true }
    render(<SearchModal open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Search cartridges/i), { target: { value: '85' } })
    expect(screen.getByText('HP 85A')).toBeInTheDocument()
    expect(screen.getByText('HP 85A').closest('ul')).toHaveClass('opacity-50')
    expect(screen.queryByLabelText('Searching')).not.toBeInTheDocument()
  })

  it('starts the page progress bar when a result is opened', () => {
    search.state = { hits: [HIT], loading: false }
    const onClose = vi.fn()
    const heard = vi.fn()
    window.addEventListener(NAVIGATION_START_EVENT, heard)
    render(<SearchModal open onClose={onClose} />)
    fireEvent.change(screen.getByPlaceholderText(/Search cartridges/i), { target: { value: '85A' } })
    fireEvent.click(screen.getByText('HP 85A'))
    expect(push).toHaveBeenCalledWith('/products/hp-85a')
    expect(heard).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
    window.removeEventListener(NAVIGATION_START_EVENT, heard)
  })
})
