import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { CATEGORIES, categoryBySlug, legacyRedirectMap } from '@/lib/categories'
import { TYPE_CATEGORIES } from '@/lib/taxonomy'

describe('category registry', () => {
  it('has unique slugs', () => {
    const slugs = CATEGORIES.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has unique Medusa handles — two pages listing one category would be duplicate content', () => {
    const handles = CATEGORIES.map((c) => c.medusaHandle)
    expect(new Set(handles).size).toBe(handles.length)
  })

  it('uses URL-safe slugs', () => {
    for (const c of CATEGORIES) expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  // The failure this guards against is silent: pairing "HP Inkjet Cartridges"
  // with the `laser-hp` handle renders a page whose heading says inkjet and
  // whose products are all laser. Nothing errors, and it is exactly the kind of
  // mismatch a reviewer skims past.
  it('pairs each entry with a handle for its own cartridge type', () => {
    const prefix = { laser: 'laser-', inkjet: 'inkjet-' } as const
    for (const c of CATEGORIES) {
      expect(c.medusaHandle.startsWith(prefix[c.type])).toBe(true)
    }
  })

  it('only uses known cartridge types', () => {
    const known = new Set(TYPE_CATEGORIES.map((t) => t.key))
    for (const c of CATEGORIES) expect(known.has(c.type)).toBe(true)
  })

  it('names the brand in its own title', () => {
    for (const c of CATEGORIES) expect(c.title.startsWith(c.brand)).toBe(true)
  })

  it('resolves a known slug and rejects an unknown one', () => {
    expect(categoryBySlug('hp-laserjet-cartridges')?.brand).toBe('HP')
    expect(categoryBySlug('not-a-category')).toBeUndefined()
  })
})

describe('legacy redirect map', () => {
  // A legacy path listed under two categories would make the cutover redirect
  // order-dependent — the last entry silently wins and one ranking page lands
  // on the wrong target.
  it('never claims one legacy path for two categories', () => {
    const seen = new Map<string, string>()
    for (const c of CATEGORIES) {
      for (const p of c.legacyPaths) {
        expect(seen.has(p), `${p} claimed by both ${seen.get(p)} and ${c.slug}`).toBe(false)
        seen.set(p, c.slug)
      }
    }
  })

  it('uses root-relative legacy paths with no trailing slash', () => {
    for (const c of CATEGORIES) {
      for (const p of c.legacyPaths) {
        expect(p.startsWith('/')).toBe(true)
        expect(p.endsWith('/')).toBe(false)
      }
    }
  })

  it('points every legacy path at a category that exists', () => {
    const map = legacyRedirectMap()
    expect(Object.keys(map).length).toBeGreaterThan(0)
    for (const [, target] of Object.entries(map)) {
      const slug = target.replace('/cartridges/', '')
      expect(categoryBySlug(slug)).toBeDefined()
    }
  })
})

// The nginx map in infrastructure/ is what actually serves the cutover 301s;
// CATEGORIES is what renders the pages. They are produced by different tools,
// so nothing but this test stops them drifting apart — and the failure mode is
// silent until the one-shot authority transfer has already been spent.
describe('cutover redirect map', () => {
  const conf = readFileSync(
    join(import.meta.dirname, '../../../../../infrastructure/nginx/conf.d/00-legacy-redirects.conf'),
    'utf8',
  )
  const nginxMap = Object.fromEntries(
    conf
      .split('\n')
      .filter((l) => /^\s{4}\//.test(l))
      .map((l) => l.trim().replace(/;$/, '').split(/\s+/) as [string, string]),
  )

  it('serves a 301 for every legacy path the category registry claims', () => {
    for (const [legacyPath, target] of Object.entries(legacyRedirectMap())) {
      expect(nginxMap, `${legacyPath} is in CATEGORIES but not in the nginx map`).toHaveProperty(
        legacyPath,
      )
      expect(nginxMap[legacyPath], `${legacyPath} redirects somewhere else`).toBe(target)
    }
  })

  it('has no duplicate keys — nginx refuses to load a map with one', () => {
    const keys = conf
      .split('\n')
      .filter((l) => /^\s{4}\//.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never points a legacy URL at another legacy URL', () => {
    for (const target of Object.values(nginxMap)) {
      expect(target.startsWith('/')).toBe(true)
      expect(target).not.toMatch(/^\/(product|product-category)\//)
    }
  })
})
