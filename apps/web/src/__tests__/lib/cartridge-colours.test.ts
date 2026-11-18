import { describe, it, expect } from 'vitest'
import { colourOfName, colourOfSku, coloursOfSkus, coloursOfVariants } from '@/lib/cartridge-colours'

describe('colourOfSku', () => {
  it('reads the colour off the SKU suffix', () => {
    expect(colourOfSku('HP-177-K')?.name).toBe('Black')
    expect(colourOfSku('BRO-TN279-Y')?.name).toBe('Yellow')
    expect(colourOfSku('EPS-T0806-LC')?.name).toBe('Light Cyan')
  })

  it('returns null when the suffix is not a colour', () => {
    expect(colourOfSku('HP-CE285A')).toBeNull()
    expect(colourOfSku('HP-177-ALL')).toBeNull()
  })

  // HP 121 XL is Black + Tri-colour as variants of one product. Without -CLR
  // its card fell back to "2 options".
  it('reads -CLR as the tri-colour cartridge', () => {
    expect(colourOfSku('HP-121XL3-CLR')).toMatchObject({ name: 'Tri-colour', multi: true })
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

describe('colourOfName', () => {
  it('reads a Medusa variant title as a colour', () => {
    expect(colourOfName('Cyan')?.name).toBe('Cyan')
    expect(colourOfName(' tri-colour ')?.name).toBe('Tri-colour')
    expect(colourOfName('Colour')?.name).toBe('Tri-colour')
  })

  it('returns null for titles that are not colours', () => {
    expect(colourOfName('Standard yield')).toBeNull()
    expect(colourOfName('Default Title')).toBeNull()
    expect(colourOfName(null)).toBeNull()
  })
})

describe('coloursOfVariants (#451)', () => {
  it('prefers the variant title over the SKU suffix', () => {
    expect(coloursOfVariants([
      { sku: 'GI-4-CYAN70ML', title: 'Cyan' },
      { sku: 'GI-4-MAGENTA70ML', title: 'Magenta' },
    ])?.map((c) => c.name)).toEqual(['Cyan', 'Magenta'])
  })

  it('falls back to the SKU when a variant has no title', () => {
    expect(coloursOfVariants([
      { sku: 'HP-177-K', title: null },
      { sku: 'HP-177-C' },
    ])?.map((c) => c.name)).toEqual(['Black', 'Cyan'])
  })

  it('gives up on a yield set rather than calling it colours', () => {
    expect(coloursOfVariants([
      { sku: 'PAN-TL5120', title: 'Standard yield' },
      { sku: 'PAN-TL5120-H', title: 'High yield' },
    ])).toBeNull()
  })
})
