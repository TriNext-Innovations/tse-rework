import { describe, it, expect } from 'vitest'
import { collapseByProduct } from '../../api/store/compatibility/route'

const product = (id: string, handle: string, title: string) => ({
  product_id: id, title, thumbnail: null, handle,
})

// HP 177 as it actually is: K/C/M/Y are variants of one product, while the
// Light colours are standalone products. That mix is what made the finder
// report "3 cartridges" for a printer that takes six.
const hp177 = product('prod_177', 'hp-177', 'HP 177')
const variantMap = new Map([
  ['HP-177-K', hp177],
  ['HP-177-C', hp177],
  ['HP-177-M', hp177],
  ['HP-177-Y', hp177],
  ['HP-177CYANLIGHT', product('prod_cl', 'hp-177-cyan-light', 'HP 177 Cyan Light')],
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

  it('keeps the first row order — the card names the sku a shopper hit first', () => {
    const { results } = collapseByProduct(rows, variantMap)
    expect(results.find((r) => r.handle === 'hp-177')!.sku).toBe('HP-177-K')
  })

  it('returns nothing for no rows', () => {
    expect(collapseByProduct([], variantMap)).toEqual({ results: [], dropped: 0 })
  })
})
