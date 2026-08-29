// The brand × type category layer — the pages `tse.co.za` actually ranks on.
//
// The legacy WooCommerce site earns its search traffic almost entirely on
// `/product-category/*` and `/buy-*-cartridges` pages. This store had no
// equivalent page type at all: 301 product pages, one `/products` browse page,
// and nothing in between. Redirecting a ranking category page at the cutover to
// a page that is not an equivalent is read by Google as a soft 404 — the
// ranking is dropped rather than transferred — so the layer has to exist
// *before* the DNS flip, not after.
//
// This module is the single source of truth for that layer. The page, the
// sitemap and (at cutover) the redirect map all read it, so a category can
// never be live in one and missing from another.
//
// Slugs deliberately reuse the legacy site's wording (`hp-laserjet-cartridges`,
// not `hp-laser`). The redundancy in `/cartridges/hp-laserjet-cartridges` is
// cosmetic; keeping the exact phrase the ranking page already uses is worth
// more than a tidier URL, and it makes the redirect map close to mechanical.

import type { CartridgeType } from './taxonomy'

export type Category = {
  /** URL segment under /cartridges. Mirrors the legacy site's keyword slug. */
  slug: string
  /** The Medusa product-category `handle` this page lists. */
  medusaHandle: string
  /** Brand category name in Medusa — must match exactly. */
  brand: string
  type: CartridgeType
  /** <h1> and <title> subject, e.g. "HP LaserJet Cartridges". */
  title: string
  /**
   * Paths on the legacy site that should 301 here at cutover. Several legacy
   * pages point at one target: a `/product-category/` page and the matching
   * `/buy-<brand>-cartridges` hub are the same intent.
   *
   * NOTE: these are a starting point, not the finished redirect map. The legacy
   * sitemap omits its own `/product-category/*` pages entirely, so anything
   * derived from it undercounts — build the final map from Search Console's
   * indexed-URL export plus a crawl. See the 2026-08-21 decision note.
   */
  legacyPaths: string[]
}

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'hp-laserjet-cartridges',
    medusaHandle: 'laser-hp',
    brand: 'HP',
    type: 'laser',
    title: 'HP LaserJet Cartridges',
    legacyPaths: ['/product-category/hp-laserjet-cartridges', '/buy-hp-cartridges', '/hp-laserjet-cartridges-buy-the-best-quality-generics'],
  },
  {
    slug: 'hp-inkjet-cartridges',
    medusaHandle: 'inkjet-hp',
    brand: 'HP',
    type: 'inkjet',
    title: 'HP Inkjet Cartridges',
    legacyPaths: ['/product-category/hp-inkjet-cartridges', '/hp-inkjet-cartridges-buy-the-best-quality-generics'],
  },
  {
    slug: 'brother-laserjet-cartridges',
    medusaHandle: 'laser-brother',
    brand: 'Brother',
    type: 'laser',
    title: 'Brother Laser Cartridges',
    legacyPaths: ['/product-category/brother-laserjet-cartridges', '/buy-brother-cartridges', '/brother-cartridges-the-best-quality-and-service'],
  },
  {
    slug: 'brother-inkjet-cartridges',
    medusaHandle: 'inkjet-brother',
    brand: 'Brother',
    type: 'inkjet',
    title: 'Brother Inkjet Cartridges',
    legacyPaths: ['/product-category/brother-inkjet-cartridges'],
  },
  {
    slug: 'canon-laserjet-cartridges',
    medusaHandle: 'laser-canon',
    brand: 'Canon',
    type: 'laser',
    title: 'Canon Laser Cartridges',
    legacyPaths: ['/product-category/canon-laserjet-cartridges', '/buy-canon-cartridges', '/canon-printer-cartridge-price'],
  },
  {
    slug: 'canon-inkjet-cartridges',
    medusaHandle: 'inkjet-canon',
    brand: 'Canon',
    type: 'inkjet',
    title: 'Canon Inkjet Cartridges',
    legacyPaths: ['/product-category/canon-inkjet-cartridges'],
  },
  {
    slug: 'epson-inkjet-cartridges',
    medusaHandle: 'inkjet-epson',
    brand: 'Epson',
    type: 'inkjet',
    title: 'Epson Inkjet Cartridges',
    legacyPaths: ['/product-category/epson-inkjet-cartridges', '/epson-ink-the-best-quality-and-service'],
  },
  {
    slug: 'samsung-laserjet-cartridges',
    medusaHandle: 'laser-samsung',
    brand: 'Samsung',
    type: 'laser',
    title: 'Samsung Laser Cartridges',
    legacyPaths: ['/product-category/samsung-laserjet-cartridges', '/buy-samsung-cartridges', '/the-best-samsung-cartridges-to-fullfill-your-printing-needs'],
  },
  {
    slug: 'kyocera-laserjet-cartridges',
    medusaHandle: 'laser-kyocera',
    brand: 'Kyocera',
    type: 'laser',
    title: 'Kyocera Laser Cartridges',
    legacyPaths: ['/product-category/generic-kyocera-laserjet-cartridges', '/kyocera-cartridges-the-best-quality-and-service', '/kyocera-cartridges-buy-the-best-quality-generics'],
  },
  {
    slug: 'pantum-laserjet-cartridges',
    medusaHandle: 'laser-pantum',
    brand: 'Pantum',
    type: 'laser',
    title: 'Pantum Laser Cartridges',
    legacyPaths: ['/the-best-quality-generic-pantum-cartridges-satisfaction-guaranteed', '/the-best-pantum-cartridges-to-enhance-your-printing-experience'],
  },
  {
    slug: 'ricoh-laserjet-cartridges',
    medusaHandle: 'laser-ricoh',
    brand: 'Ricoh',
    type: 'laser',
    title: 'Ricoh Laser Cartridges',
    legacyPaths: ['/product-category/generic-ricoh-laserjet-cartridges', '/ricoh-cartridges-the-best-quality-and-service'],
  },
  {
    slug: 'xerox-cartridges',
    medusaHandle: 'laser-xerox',
    brand: 'Xerox',
    type: 'laser',
    title: 'Xerox Laser Cartridges',
    legacyPaths: ['/product-category/xerox-cartridges', '/xerox-cartridges-the-best-quality-and-service'],
  },
  {
    slug: 'lexmark-laserjet-cartridges',
    medusaHandle: 'laser-lexmark',
    brand: 'Lexmark',
    type: 'laser',
    title: 'Lexmark Laser Cartridges',
    legacyPaths: ['/product-category/lexmark-laserjet-cartridges', '/buy-lexmark-cartridges', '/lexmark-cartridges-the-best-quality-and-service'],
  },
  {
    slug: 'konica-minolta-laserjet-cartridges',
    medusaHandle: 'laser-konica-minolta',
    brand: 'Konica Minolta',
    type: 'laser',
    title: 'Konica Minolta Laser Cartridges',
    legacyPaths: ['/product-category/generic-konica-minolta-laserjet-cartridges', '/konica-minolta-cartridges-the-best-quality-and-service'],
  },
  {
    slug: 'oki-laserjet-cartridges',
    medusaHandle: 'laser-oki',
    brand: 'OKI',
    type: 'laser',
    title: 'OKI Laser Cartridges',
    legacyPaths: ['/product-category/generic-oki-laserjet-cartridges', '/oki-cartridges-the-best-quality-and-service'],
  },
  // ⚠ Samsung and Lexmark INKJET are deliberately absent.
  //
  // The legacy site ranks `/product-category/samsung-inkjet-cartridges` and
  // `/product-category/lexmark-inkjet-cartridges`, but this catalogue holds
  // ZERO products in either — so the page would be empty. An empty category
  // page is worse than no page: it is thin content, and redirecting a ranking
  // legacy page onto one throws the ranking away rather than transferring it.
  //
  // Two ways to close this, and it is a commercial question, not a technical
  // one: if TSE still sells them, import the products and add the entries here
  // (the page then appears automatically); if they don't, point those two
  // legacy URLs at the brand's laser page at cutover instead.
] as const

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

/** Every legacy path → the slug that should receive it. For the cutover map. */
export function legacyRedirectMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of CATEGORIES) {
    for (const p of c.legacyPaths) map[p] = `/cartridges/${c.slug}`
  }
  return map
}
