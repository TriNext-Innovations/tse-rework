import { describe, it, expect } from 'vitest'
import { buildMerchantTitle, buildProductType, typeNounFor } from '@/lib/merchant-title'

// Every case below is a real shape from the production catalogue, audited
// 2026-08-19 (301 products / 523 variants). The point of the change is that a
// shopper searching "brother tn277 toner" finds us, so the assertions pin the
// search words, not just the formatting.
describe('buildMerchantTitle', () => {
  it('adds colour and the toner noun to a laser variant', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'Brother TN 277',
        variantName: 'Magenta',
        cartridgeType: 'laser',
        compatible: true,
      }),
    ).toBe('Brother TN 277 Magenta Toner Cartridge — Compatible')
  })

  it('says "Ink" not "Toner" for inkjet', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'Canon CLI-451XL',
        variantName: 'Cyan',
        cartridgeType: 'inkjet',
        compatible: true,
      }),
    ).toBe('Canon CLI-451XL Cyan Ink Cartridge — Compatible')
  })

  it('drops the placeholder variant name (passed as null by the caller)', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'HP CF283A',
        variantName: null,
        cartridgeType: 'laser',
        compatible: true,
      }),
    ).toBe('HP CF283A Toner Cartridge — Compatible')
  })

  // "HP 120A Drum Unit" is a laser consumable but is NOT a toner cartridge.
  // Asserting otherwise is a title/product mismatch, which is a suspension risk.
  it('never calls a drum unit a toner cartridge', () => {
    const title = buildMerchantTitle({
      productTitle: 'HP 120A Drum Unit',
      variantName: null,
      cartridgeType: 'laser',
      compatible: true,
    })
    expect(title).toBe('HP 120A Drum Unit — Compatible')
    expect(title).not.toMatch(/toner/i)
  })

  it('leaves "Generic ..." products alone rather than saying it twice', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'Generic Brother LC-472 XL',
        variantName: 'Magenta',
        cartridgeType: 'inkjet',
        compatible: true,
      }),
    ).toBe('Generic Brother LC-472 XL Magenta Ink Cartridge')
  })

  // Canon T13's sole variant is literally called "T13".
  it('does not repeat a variant name the product title already carries', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'Canon T13',
        variantName: 'T13',
        cartridgeType: null,
        compatible: false,
      }),
    ).toBe('Canon T13 Cartridge')
  })

  // The two products with no metadata.cartridge_type must still gain the word
  // "cartridge" — but must not be guessed into "Toner" or "Ink".
  it('falls back to the neutral noun when the type is unknown', () => {
    const title = buildMerchantTitle({
      productTitle: 'Samsung SCX4521UNI',
      variantName: null,
      cartridgeType: null,
      compatible: false,
    })
    expect(title).toBe('Samsung SCX4521UNI Cartridge')
    expect(title).not.toMatch(/toner|\bink\b/i)
  })

  it('keeps yield variant names, which shoppers do search', () => {
    expect(
      buildMerchantTitle({
        productTitle: 'Kyocera TK-1170',
        variantName: 'High yield',
        cartridgeType: 'laser',
        compatible: true,
      }),
    ).toBe('Kyocera TK-1170 High yield Toner Cartridge — Compatible')
  })

  it('drops the Compatible suffix before it drops the type noun', () => {
    const title = buildMerchantTitle({
      productTitle: 'Konica Minolta A Very Long Legacy Model Designation 4695MF',
      variantName: 'Magenta',
      cartridgeType: 'laser',
      compatible: true,
    })
    expect(title.length).toBeLessThanOrEqual(70)
    expect(title).toMatch(/Toner Cartridge$/)
    expect(title).not.toMatch(/Compatible/)
  })

  it('shrinks the model designation on a word boundary, never the search words', () => {
    const productTitle =
      'Ricoh Extremely Long Product Designation That Nobody Would Ever Actually Type'
    const title = buildMerchantTitle({
      productTitle,
      variantName: 'Yellow',
      cartridgeType: 'laser',
      compatible: true,
    })
    expect(title.length).toBeLessThanOrEqual(70)
    expect(title).toBe(title.trim())
    expect(title).toMatch(/Yellow Toner Cartridge$/)
    // What's left of the product title is a whole-word prefix of the original,
    // not a model number sliced in half.
    const kept = title.replace(/ Yellow Toner Cartridge$/, '')
    expect(productTitle.startsWith(kept)).toBe(true)
    expect(productTitle[kept.length]).toBe(' ')
  })
})

describe('typeNounFor', () => {
  it('returns null when the title already says "cartridge"', () => {
    expect(typeNounFor('HP 123 Ink Cartridge', 'inkjet')).toBeNull()
  })

  it('returns null for self-describing parts', () => {
    expect(typeNounFor('Samsung R116 Drum Unit', 'laser')).toBeNull()
    expect(typeNounFor('HP CE314A Drum', 'laser')).toBeNull()
  })

  it('returns the right noun per type', () => {
    expect(typeNounFor('Brother TN 277', 'laser')).toBe('Toner Cartridge')
    expect(typeNounFor('Epson 101', 'inkjet')).toBe('Ink Cartridge')
    expect(typeNounFor('Canon T13', null)).toBe('Cartridge')
  })
})

describe('buildProductType', () => {
  it('files cartridges under their type and brand', () => {
    expect(buildProductType('Brother TN 277', 'laser', 'Brother')).toBe(
      'Printer Consumables > Laser Toner > Brother',
    )
    expect(buildProductType('Canon CLI-426', 'inkjet', 'Canon')).toBe(
      'Printer Consumables > Inkjet Ink > Canon',
    )
  })

  it('files drums separately from toner', () => {
    expect(buildProductType('HP 120A Drum Unit', 'laser', 'HP')).toBe(
      'Printer Consumables > Drum Units & Parts > HP',
    )
  })
})
