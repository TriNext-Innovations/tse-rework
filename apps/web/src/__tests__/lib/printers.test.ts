import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  printerSlug, printerLabel, groupByBrand, findCartridges, purchasableCount, printerLede, withPricing,
  type CompatibleCartridge, type PrinterModel,
} from '@/lib/printers'

const m = (brand: string, model: string, cartridge_count = 1): PrinterModel => ({ brand, model, cartridge_count })

describe('printerSlug', () => {
  it('builds a URL-safe slug from brand and model', () => {
    expect(printerSlug('Brother', 'DCP-L3520cdw')).toBe('brother-dcp-l3520cdw')
    expect(printerSlug('Ricoh', 'MP C2003')).toBe('ricoh-mp-c2003')
  })

  it('collapses punctuation and never leaves a leading or trailing dash', () => {
    expect(printerSlug('Konica Minolta', 'bizhub C284e')).toBe('konica-minolta-bizhub-c284e')
    expect(printerSlug('HP', '  M233 / M234  ')).toBe('hp-m233-m234')
    for (const s of [printerSlug('HP', '(1020)'), printerSlug('Epson', 'ET-4500 ')]) {
      expect(s.startsWith('-')).toBe(false)
      expect(s.endsWith('-')).toBe(false)
    }
  })

  it('produces only lowercase alphanumerics and single dashes', () => {
    expect(printerSlug('Konica Minolta', 'C-284//e')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
})

describe('printerLabel', () => {
  it('prefixes the brand', () => {
    expect(printerLabel(m('Brother', 'DCP-L3520cdw'))).toBe('Brother DCP-L3520cdw')
  })

  // Some model names in the catalogue already carry the brand. Naive
  // concatenation renders "HP HP LaserJet Pro" in the <h1> and the <title>.
  it('does not repeat a brand the model already starts with', () => {
    expect(printerLabel(m('HP', 'HP LaserJet Pro M404dn'))).toBe('HP LaserJet Pro M404dn')
    expect(printerLabel(m('HP', 'hp deskjet 2130'))).toBe('hp deskjet 2130')
  })
})

describe('groupByBrand', () => {
  const models = [m('HP', 'M404'), m('Canon', 'MX494'), m('HP', 'M233'), m('HP', 'M110'), m('Canon', 'G3410')]

  it('groups every model under its brand, losing none', () => {
    const g = groupByBrand(models)
    expect(g.flatMap((x) => x.models)).toHaveLength(models.length)
    expect(g.map((x) => x.brand)).toEqual(['HP', 'Canon'])
  })

  it('orders brands by how many models they have', () => {
    const [first] = groupByBrand(models)
    expect(first?.brand).toBe('HP')
    expect(first?.models).toHaveLength(3)
  })

  it('sorts models numerically so M110 precedes M233', () => {
    const [first] = groupByBrand(models)
    expect(first?.models.map((x) => x.model)).toEqual(['M110', 'M233', 'M404'])
  })
})

describe('findCartridges', () => {
  function mockResults(results: unknown[]) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results }),
    })))
  }

  afterEach(() => vi.unstubAllGlobals())

  // A compatibility row with no published product used to render a card with a
  // null title and href="/products/null". The backend now drops these; the page
  // must not be able to emit one even if that regresses.
  it('drops rows with no handle', async () => {
    mockResults([
      { sku: 'A', product_id: 'p1', handle: 'brother-tn-279', title: 'TN 279' },
      { sku: 'B', product_id: 'p2', handle: null, title: null },
      { sku: 'C', product_id: 'p3', title: 'no handle key at all' },
    ])
    const out = await findCartridges('Brother', 'DCP-L3520cdw')
    expect(out.map((c) => c.product_id)).toEqual(['p1'])
  })

  it('collapses colour variants of one product into a single card', async () => {
    mockResults([
      { sku: 'KM-TN321-K', product_id: 'p1', handle: 'km-tn-321', title: 'TN 321' },
      { sku: 'KM-TN321-C', product_id: 'p1', handle: 'km-tn-321', title: 'TN 321' },
      { sku: 'KM-TN328-K', product_id: 'p2', handle: 'km-tn-328', title: 'TN 328' },
    ])
    const out = await findCartridges('Konica Minolta', 'C284e')
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.handle)).toEqual(['km-tn-321', 'km-tn-328'])
  })

  it('returns [] rather than throwing when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    expect(await findCartridges('HP', 'CP1025')).toEqual([])
  })
})

// HP Photosmart 3210 as it really is: HP 177 K/C/M/Y are variants of one
// product, Light Cyan and Light Magenta are standalone products.
const photosmart: CompatibleCartridge[] = [
  {
    sku: 'HP-177-K', skus: ['HP-177-K', 'HP-177-C', 'HP-177-M', 'HP-177-Y'],
    product_id: 'p177', handle: 'hp-177', title: 'HP 177', printer_brand: 'HP', printer_model: 'Photosmart 3210',
  },
  {
    sku: 'HP-177CYANLIGHT', skus: ['HP-177CYANLIGHT'],
    product_id: 'plc', handle: 'hp-177-lc', title: 'HP 177 Cyan Light', printer_brand: 'HP', printer_model: 'Photosmart 3210',
  },
  {
    sku: 'HP-177MAGENTALIGHT',
    product_id: 'plm', handle: 'hp-177-lm', title: 'HP 177 Magenta Light', printer_brand: 'HP', printer_model: 'Photosmart 3210',
  },
]

describe('purchasableCount (#451)', () => {
  it('counts cartridges a shopper can buy, not cards', () => {
    expect(purchasableCount(photosmart)).toBe(6)
  })

  it('counts a card with no skus list as one', () => {
    expect(purchasableCount([{ sku: 'A' }])).toBe(1)
    expect(purchasableCount([])).toBe(0)
  })
})

describe('printerLede (#451)', () => {
  it('says six cartridges across three products for a Photosmart 3210', () => {
    expect(printerLede({ brand: 'HP', model: 'Photosmart 3210' }, photosmart))
      .toBe('6 generic cartridges in the TSE range fit the HP Photosmart 3210, across 3 products.')
  })

  it('does not mention products when every card is one cartridge', () => {
    expect(printerLede({ brand: 'HP', model: 'LaserJet 1020' }, [{ sku: 'HP-Q2612A' }]))
      .toBe('1 generic cartridge in the TSE range fit the HP LaserJet 1020.')
  })
})

describe('withPricing (#451)', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockProducts(products: unknown[]) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('/store/regions')
        ? { regions: [{ id: 'reg_1' }] }
        : { products }),
    })))
  }

  const price = (n: number) => ({ calculated_price: { calculated_amount: n } })

  it('gives a multi-colour card no quick-add variant, and a "from" price when colours differ', async () => {
    mockProducts([{
      id: 'p177',
      variants: [
        { id: 'v_k', sku: 'HP-177-K', ...price(250) },
        { id: 'v_c', sku: 'HP-177-C', ...price(180) },
        { id: 'v_m', sku: 'HP-177-M', ...price(180) },
        { id: 'v_y', sku: 'HP-177-Y', ...price(180) },
      ],
    }])
    const [card] = await withPricing([photosmart[0]!])
    // Old code: variantId v_k and price 250 — a one-tap add put black in the
    // cart for a card that stands for four colours.
    expect(card!.variantId).toBeNull()
    expect(card!.price).toBe(180)
    expect(card!.priceFrom).toBe(true)
  })

  it('prices and adds the variant the card names, not variants[0]', async () => {
    mockProducts([{
      id: 'p2',
      variants: [
        { id: 'v_other', sku: 'X-OTHER', ...price(999) },
        { id: 'v_fit', sku: 'X-FIT', ...price(300) },
      ],
    }])
    const [card] = await withPricing([{
      sku: 'X-FIT', skus: ['X-FIT'], product_id: 'p2', handle: 'x', title: 'X', printer_brand: 'B', printer_model: 'M',
    }])
    expect(card!.variantId).toBe('v_fit')
    expect(card!.price).toBe(300)
    expect(card!.priceFrom).toBe(false)
  })

  it('keeps the single variant of a one-variant product', async () => {
    mockProducts([{ id: 'plm', variants: [{ id: 'v_lm', sku: 'HP-177MAGENTALIGHT', ...price(200) }] }])
    const [card] = await withPricing([photosmart[2]!])
    expect(card!.variantId).toBe('v_lm')
    expect(card!.price).toBe(200)
  })
})
