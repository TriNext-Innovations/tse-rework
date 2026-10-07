import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CATEGORIES } from '@/lib/categories'

vi.mock('@/lib/printers', () => ({
  fetchPrinterModels: vi.fn(async () => [{ brand: 'HP', model: 'LaserJet P1102' }]),
  printerSlug: (b: string, m: string) => `${b}-${m}`.toLowerCase().replace(/\s+/g, '-'),
}))

const laser = CATEGORIES[0]!

function mockProducts(products: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ products, count: products.length }) })))
}

async function build() {
  const { default: sitemap } = await import('@/app/sitemap')
  return sitemap()
}

describe('sitemap lastmod (#525)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('dates each page by real content changes, never the build time', async () => {
    mockProducts([
      { handle: 'old', updated_at: '2026-08-04T06:10:00Z', categories: [{ handle: laser.medusaHandle }] },
      { handle: 'new', updated_at: '2026-09-29T19:31:00Z', categories: [{ handle: laser.medusaHandle }] },
      { handle: 'other', updated_at: '2026-09-01T00:00:00Z', categories: [{ handle: 'not-a-listed-category' }] },
    ])
    const entries = await build()
    const at = (path: string) => entries.find((e) => e.url.endsWith(path))

    expect(at('/products/old')?.lastModified).toEqual(new Date('2026-08-04T06:10:00Z'))
    expect(at(`/cartridges/${laser.slug}`)?.lastModified).toEqual(new Date('2026-09-29T19:31:00Z'))
    expect(at('/products')?.lastModified).toEqual(new Date('2026-09-29T19:31:00Z'))
    // No honest date exists for these, so they carry none.
    expect(at('/printers/hp-laserjet-p1102')).toBeDefined()
    expect(at('/printers/hp-laserjet-p1102')?.lastModified).toBeUndefined()
    expect(at('/legal/terms')?.lastModified).toBeUndefined()

    const now = Date.now()
    for (const e of entries) {
      if (e.lastModified) expect(now - new Date(e.lastModified).getTime()).toBeGreaterThan(60_000)
    }
  })

  it('lists only stocked categories', async () => {
    mockProducts([{ handle: 'p', categories: [{ handle: laser.medusaHandle }] }])
    const urls = (await build()).map((e) => e.url)
    expect(urls.filter((u) => u.includes('/cartridges/'))).toEqual([expect.stringContaining(`/cartridges/${laser.slug}`)])
  })

  it('falls back to undated static pages when the catalogue fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const entries = await build()
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((e) => !e.url.includes('/products/') && e.lastModified === undefined)).toBe(true)
  })
})
