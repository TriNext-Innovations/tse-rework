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

  it('names colours from variant titles when the SKUs do not carry them', () => {
    render(
      <SkuLine
        sku="GI-4-BLACK135ML"
        variants={[
          { sku: 'GI-4-BLACK135ML', title: 'Black' },
          { sku: 'GI-4-CYAN70ML', title: 'Cyan' },
          { sku: 'GI-4-MAGENTA70ML', title: 'Magenta' },
        ]}
      />,
    )
    expect(screen.getByText(/3 colours/)).toBeInTheDocument()
    expect(screen.queryByText(/GI-4-BLACK135ML/)).toBeNull()
  })

  // Black + Tri-colour is two cartridges holding four inks; "2 colours" would
  // undersell it and "4 colours" would overstate the swatches.
  it('counts cartridges, not colours, when one holds several inks', () => {
    const { container } = render(<SkuLine sku="HP-121XL-K" skus={['HP-121XL-K', 'HP-121XL3-CLR']} />)
    expect(screen.getByText(/2 cartridges/)).toBeInTheDocument()
    expect(screen.getByText(/Black, Tri-colour/)).toBeInTheDocument()
    expect(container.querySelectorAll('[data-swatch]')).toHaveLength(2)
  })

  it('treats a missing skus list as a single SKU', () => {
    render(<SkuLine sku="HP-CE285A" />)
    expect(screen.getByText('SKU HP-CE285A')).toBeInTheDocument()
  })
})
