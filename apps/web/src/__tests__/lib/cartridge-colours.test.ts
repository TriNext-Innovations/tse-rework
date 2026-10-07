import { describe, it, expect } from 'vitest'
import { colourOfSku, coloursOfSkus } from '@/lib/cartridge-colours'

describe('colourOfSku', () => {
  it('reads the colour off the SKU suffix', () => {
    expect(colourOfSku('HP-177-K')?.name).toBe('Black')
    expect(colourOfSku('BRO-TN279-Y')?.name).toBe('Yellow')
    expect(colourOfSku('EPS-T0806-LC')?.name).toBe('Light Cyan')
  })

  it('returns null when the suffix is not a colour', () => {
    expect(colourOfSku('HP-CE285A')).toBeNull()
    expect(colourOfSku('HP-951-CLR')).toBeNull()
  })
})

describe('coloursOfSkus (#451)', () => {
  it('lists every colour a collapsed card stands for, in order', () => {
    expect(coloursOfSkus(['HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y'])?.map((c) => c.name))
      .toEqual(['Black', 'Cyan', 'Magenta', 'Yellow'])
  })

  it('drops repeats', () => {
    expect(coloursOfSkus(['X-1-K', 'X-1-BK'])?.map((c) => c.name)).toEqual(['Black'])
  })

  it('gives up when any SKU has no colour, rather than miscounting', () => {
    expect(coloursOfSkus(['HP-177-K', 'HP-177-XL'])).toBeNull()
  })
})
