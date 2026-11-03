import { describe, it, expect } from 'vitest'
import { joinVariants, buildSearchJoins, hpShortCodes, productToDocument } from '../../lib/search'

describe('joinVariants', () => {
  it('joins adjacent words into pair and triple tokens', () => {
    expect(joinVariants('Canon MX 494')).toEqual(
      expect.arrayContaining(['canonmx', 'mx494', 'canonmx494']),
    )
  })

  it('treats any non-alphanumeric run as a separator', () => {
    expect(joinVariants('TN-2411')).toContain('tn2411')
  })

  it('drops joins shorter than four characters as noise', () => {
    // "HP 4" would otherwise emit "hp4", which prefix-matches half the catalogue.
    expect(joinVariants('HP 4')).toEqual([])
  })

  it('returns nothing for a single word — there is nothing to join', () => {
    expect(joinVariants('cartridge')).toEqual([])
    expect(joinVariants('')).toEqual([])
  })

  it('does not emit a blob of the whole string', () => {
    // A single long token prefix-matches every short query and skews ranking.
    expect(joinVariants('HP 106 Black Original Laser Toner Cartridge')).not.toContain(
      'hp106blackoriginallasertonercartridge',
    )
  })

  it('honours the window size', () => {
    expect(joinVariants('a bb cc dd', 2)).toEqual(['bbcc', 'ccdd'])
  })
})

describe('buildSearchJoins', () => {
  const parts = {
    title: 'Canon MX 494 Ink Cartridge',
    sku: 'PG-745',
    brand: 'Canon',
    compatiblePrinters: ['MX 494', 'MX494'],
  }

  it('covers the brand-and-model-run-together query that plain tokenizing misses', () => {
    expect(buildSearchJoins(parts)).toContain('canonmx494')
  })

  it('pairs a brand-less printer model with its brand', () => {
    const joins = buildSearchJoins({
      title: 'Brother TN-2411 Black Toner',
      sku: 'TN2411',
      brand: 'Brother',
      compatiblePrinters: ['HL L2312D'],
    })
    expect(joins).toContain('brotherhl')
    expect(joins).toContain('brotherhll2312d')
  })

  it('de-duplicates tokens reached by more than one source field', () => {
    const joins = buildSearchJoins(parts)
    expect(new Set(joins).size).toBe(joins.length)
  })

  it('handles a null sku and brand without throwing', () => {
    expect(() =>
      buildSearchJoins({ title: 'Loose Item', sku: null, brand: null, compatiblePrinters: [] }),
    ).not.toThrow()
  })
})

describe('hpShortCodes (#483)', () => {
  it('derives the box code from a monochrome LaserJet part', () => {
    expect(hpShortCodes('HP-CE285A')).toEqual(['85A'])
    expect(hpShortCodes('HP-Q2612A')).toEqual(['12A'])
    expect(hpShortCodes('HP-CE505A')).toEqual(['05A'])
    expect(hpShortCodes('HP-CF259X')).toEqual(['59X'])
  })

  it('reads through a drum-unit suffix on the SKU', () => {
    expect(hpShortCodes('HP-CF232ADRUMUNIT')).toEqual(['32A'])
  })

  it('keeps three digits for the W-series', () => {
    expect(hpShortCodes('HP-W1106A')).toEqual(['106A'])
  })

  it('derives nothing for colour sets, whose box codes do not follow the digits', () => {
    expect(hpShortCodes('HP-CE310A-K')).toEqual([])
    expect(hpShortCodes('HP-CF410A-K')).toEqual([])
  })

  it('derives nothing for the listed exceptions or other brands', () => {
    expect(hpShortCodes('HP-CE314ADRUM')).toEqual([])
    expect(hpShortCodes('BRO-TN2411')).toEqual([])
    expect(hpShortCodes('HP-305XL-K')).toEqual([])
    expect(hpShortCodes(null)).toEqual([])
  })

  it('puts the code on the search document', () => {
    const doc = productToDocument({
      id: 'p1',
      title: 'HP CE285A',
      variants: [{ sku: 'HP-CE285A', prices: [] }],
    })
    expect(doc.short_codes).toEqual(['85A'])
  })
})
