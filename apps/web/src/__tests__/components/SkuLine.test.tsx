import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkuLine } from '@/components/catalog/SkuLine'

describe('SkuLine (#451)', () => {
  it('shows the SKU for a single-variant card', () => {
    render(<SkuLine sku="HP-CE285A" skus={['HP-CE285A']} />)
    expect(screen.getByText('SKU HP-CE285A')).toBeInTheDocument()
  })

  it('shows the colours, not one variant SKU, for a collapsed colour card', () => {
    render(<SkuLine sku="HP-177-K" skus={['HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y']} />)
    expect(screen.getByText(/4 colours/)).toBeInTheDocument()
    expect(screen.getByText(/Black, Cyan, Magenta, Yellow/)).toBeInTheDocument()
    expect(screen.queryByText(/HP-177-K/)).toBeNull()
  })

  it('falls back to a plain count when the variants are not colours', () => {
    render(<SkuLine sku="A-1" skus={['A-1', 'A-2']} />)
    expect(screen.getByText('2 options')).toBeInTheDocument()
  })

  it('treats a missing skus list as a single SKU', () => {
    render(<SkuLine sku="HP-CE285A" />)
    expect(screen.getByText('SKU HP-CE285A')).toBeInTheDocument()
  })
})
