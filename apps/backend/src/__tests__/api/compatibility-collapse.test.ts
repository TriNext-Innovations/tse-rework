import { describe, it, expect } from 'vitest'
import { collapseByProduct } from '../../api/store/compatibility/route'

const product = (id: string, handle: string, title: string) => ({
  product_id: id, title, thumbnail: null, handle,
})

// HP 177 as it actually is: K/C/M/Y are variants of one product, while the
// Light colours are standalone products. That mix is what made the finder
// report "3 cartridges" for a printer that takes six.
const hp177 = product('prod_177', 'hp-177', 'HP 177')
const variantMap = new Map<string, ReturnType<typeof product> & { variant_title?: string | null }>([
  ['HP-177-K', { ...hp177, variant_title: 'Black' }],
  ['HP-177-C', { ...hp177, variant_title: 'Cyan' }],
  ['HP-177-M', { ...hp177, variant_title: 'Magenta' }],
  ['HP-177-Y', { ...hp177, variant_title: 'Yellow' }],
  ['HP-177CYANLIGHT', { ...product('prod_cl', 'hp-177-cyan-light', 'HP 177 Cyan Light'), variant_title: 'Default Title' }],
  ['HP-177MAGENTALIGHT', product('prod_ml', 'hp-177-magenta-light', 'HP 177 Magenta Light')],
])

const rows = [
  'HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y',
  'HP-177CYANLIGHT', 'HP-177MAGENTALIGHT',
].map((sku) => ({ sku, brand: 'HP', model: 'Photosmart 3210' }))

describe('collapseByProduct', () => {
  it('collapses colour variants of one cartridge into a single card', () => {
    const { results } = collapseByProduct(rows, variantMap)
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.handle)).toEqual([
      'hp-177', 'hp-177-cyan-light', 'hp-177-magenta-light',
    ])
  })

  it('records every variant the collapsed card stands for', () => {
    const { results } = collapseByProduct(rows, variantMap)
    const card = results.find((r) => r.handle === 'hp-177')!
    // Without this the card shows "SKU HP-177-K" and a shopper after yellow
    // concludes we do not stock yellow.
    expect(card.skus).toEqual(['HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y'])
  })

  it('counts six purchasable cartridges across three cards', () => {
    const { results } = collapseByProduct(rows, variantMap)
    const purchasable = results.reduce((n, r) => n + r.skus.length, 0)
    expect(purchasable).toBe(6)
    expect(results.length).toBe(3)
  })

  it('leaves a single-variant card with one sku', () => {
    const { results } = collapseByProduct(rows, variantMap)
    expect(results.find((r) => r.handle === 'hp-177-cyan-light')!.skus).toEqual(['HP-177CYANLIGHT'])
  })

  it('drops rows whose sku has no published product, and counts them', () => {
    const extra = [...rows, { sku: 'HP-177-DELISTED', brand: 'HP', model: 'Photosmart 3210' }]
    const { results, dropped } = collapseByProduct(extra, variantMap)
    expect(dropped).toBe(1)
    expect(results).toHaveLength(3)
  })

  it('does not double-count a sku repeated across rows', () => {
    const dupes = [...rows, { sku: 'HP-177-C', brand: 'HP', model: 'Photosmart 3210' }]
    const { results } = collapseByProduct(dupes, variantMap)
    expect(results.find((r) => r.handle === 'hp-177')!.skus).toHaveLength(4)
  })

  it('names each variant so the storefront can show its colour', () => {
    const { results } = collapseByProduct(rows, variantMap)
    expect(results.find((r) => r.handle === 'hp-177')!.variants).toEqual([
      { sku: 'HP-177-K', title: 'Black' },
      { sku: 'HP-177-C', title: 'Cyan' },
      { sku: 'HP-177-M', title: 'Magenta' },
      { sku: 'HP-177-Y', title: 'Yellow' },
    ])
  })

  it('drops Medusa placeholder variant titles rather than showing "Default Title"', () => {
    const { results } = collapseByProduct(rows, variantMap)
    expect(results.find((r) => r.handle === 'hp-177-cyan-light')!.variants)
      .toEqual([{ sku: 'HP-177CYANLIGHT', title: null }])
    expect(results.find((r) => r.handle === 'hp-177-magenta-light')!.variants)
      .toEqual([{ sku: 'HP-177MAGENTALIGHT', title: null }])
  })

  // The compat SQL has no ORDER BY, so whichever row came first used to name
  // the card. The order is now the colour order, whatever the rows say.
  it('orders variants by colour, not by whichever row came back first', () => {
    const shuffled = ['HP-177-Y', 'HP-177-M', 'HP-177-K', 'HP-177-C']
      .map((sku) => ({ sku, brand: 'HP', model: 'Photosmart 3210' }))
    const { results } = collapseByProduct(shuffled, variantMap)
    expect(results[0]!.skus).toEqual(['HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y'])
    expect(results[0]!.sku).toBe('HP-177-K')
  })

  it('keeps row order for variants it cannot rank', () => {
    const p = product('prod_x', 'pantum-tl5120', 'Pantum TL5120')
    const map = new Map([
      ['PAN-TL5120-X', { ...p, variant_title: 'Extra High Yield' }],
      ['PAN-TL5120', { ...p, variant_title: 'Standard yield' }],
    ])
    const { results } = collapseByProduct(
      ['PAN-TL5120-X', 'PAN-TL5120'].map((sku) => ({ sku, brand: 'Pantum', model: 'P3010' })),
      map,
    )
    expect(results[0]!.skus).toEqual(['PAN-TL5120-X', 'PAN-TL5120'])
  })

  it('returns nothing for no rows', () => {
    expect(collapseByProduct([], variantMap)).toEqual({ results: [], dropped: 0 })
  })
})
