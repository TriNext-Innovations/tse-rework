/**
 * Builds the tse.co.za → tse-cartridges.co.za 301 map for the cutover.
 *
 * The authority transfer is one-shot: a ranking legacy page redirected to a
 * non-equivalent is read as a soft 404 and the ranking is dropped rather than
 * transferred. So every legacy URL gets the most specific live equivalent we
 * can prove, and the fallback is always the brand's category page — never the
 * homepage, which is the classic way to throw a redirect away.
 *
 * Inputs are all fetched live, so the map can be regenerated at cutover time:
 *   - the legacy AIOSEO sitemap set  (every indexed legacy URL)
 *   - the legacy product-category pages  (authoritative ink-vs-laser per SKU)
 *   - the new store's own sitemap  (proves every target is a live route)
 *
 * NOTE on the old plan: this used to be blocked on a Search Console
 * indexed-URL export, because the legacy sitemap was observed (2026-08-21) to
 * omit its own /product-category/* pages. It no longer does — AIOSEO now
 * publishes product_cat-sitemap.xml with all 17 — so the crawl alone is
 * sufficient and the export is no longer on the critical path.
 *
 * Run: npx tsx scripts/build-legacy-redirects.ts
 * Writes: infrastructure/nginx/conf.d/00-legacy-redirects.conf
 *         migration/raw/legacy-redirects.json  (the reviewable table)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const LEGACY = 'https://www.tse.co.za'
const NEW = 'https://tse-cartridges.co.za'
const ROOT = join(import.meta.dirname, '..')

const SITEMAPS = ['post', 'page', 'product', 'mailpoet_page', 'category', 'product_cat', 'date'] as const
type SitemapKind = (typeof SITEMAPS)[number]

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function text(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'tse-cutover-mapper/1.0' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

const locs = (xml: string): string[] =>
  [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/g)].map((m) => m[1].trim())

const pathOf = (url: string): string => new URL(url).pathname.replace(/\/$/, '') || '/'

// ─── Taxonomy ───────────────────────────────────────────────────────────────

/** Legacy category slug → the new /cartridges/* slug that inherits it. */
const CAT_XWALK: Record<string, string> = {
  'hp-laserjet-cartridges': 'hp-laserjet-cartridges',
  'hp-inkjet-cartridges': 'hp-inkjet-cartridges',
  'brother-laserjet-cartridges': 'brother-laserjet-cartridges',
  'brother-inkjet-cartridges': 'brother-inkjet-cartridges',
  'canon-laserjet-cartridges': 'canon-laserjet-cartridges',
  'canon-inkjet-cartridges': 'canon-inkjet-cartridges',
  'epson-inkjet-cartridges': 'epson-inkjet-cartridges',
  'samsung-laserjet-cartridges': 'samsung-laserjet-cartridges',
  'lexmark-laserjet-cartridges': 'lexmark-laserjet-cartridges',
  'xerox-cartridges': 'xerox-cartridges',
  'pantum-cartridges': 'pantum-laserjet-cartridges',
  'generic-ricoh-laserjet-cartridges': 'ricoh-laserjet-cartridges',
  'generic-kyocera-laserjet-cartridges': 'kyocera-laserjet-cartridges',
  'generic-konica-minolta-laserjet-cartridges': 'konica-minolta-laserjet-cartridges',
  'generic-oki-laserjet-cartridges': 'oki-laserjet-cartridges',
  // These two rank on the legacy site but hold ZERO stock in the new catalogue,
  // so no /cartridges/ page exists for them (an empty page is thin content).
  // Point them at the brand's laser page: relevant, and it keeps the authority
  // in the brand rather than dropping it. Revisit if TSE imports the stock.
  'samsung-inkjet-cartridges': 'samsung-laserjet-cartridges',
  'lexmark-inkjet-cartridges': 'lexmark-laserjet-cartridges',
}

/** Brand token → the category page to fall back to when no product matches. */
const BRAND_CAT: Record<string, string> = {
  hp: 'hp-laserjet-cartridges',
  brother: 'brother-laserjet-cartridges',
  canon: 'canon-laserjet-cartridges',
  can: 'canon-laserjet-cartridges',
  samsung: 'samsung-laserjet-cartridges',
  kyocera: 'kyocera-laserjet-cartridges',
  pantum: 'pantum-laserjet-cartridges',
  ricoh: 'ricoh-laserjet-cartridges',
  xerox: 'xerox-cartridges',
  lexmark: 'lexmark-laserjet-cartridges',
  konica: 'konica-minolta-laserjet-cartridges',
  minolta: 'konica-minolta-laserjet-cartridges',
  oki: 'oki-laserjet-cartridges',
  epson: 'epson-inkjet-cartridges',
}

/** The four brands that also have an inkjet page on the new store. */
const INK_CAT: Record<string, string> = {
  hp: 'hp-inkjet-cartridges',
  canon: 'canon-inkjet-cartridges',
  brother: 'brother-inkjet-cartridges',
  epson: 'epson-inkjet-cartridges',
}

/** Legacy one-offs with a real equivalent that no pattern would find. */
const MANUAL: Record<string, string> = {
  '/': '/',
  '/shop': '/products',
  '/printer-cartridges-ts-cs': '/legal/terms',
  '/category/uncategorized': '/products',
  // Editorial with no equivalent on the new site (it has no blog). /products is
  // the honest target: the intent is "buy cartridges", and it is a real page.
  '/printer-cartridges-know-how': '/products',
  '/printer-cartridges-what-you-need-to-know-before-you-buy': '/products',
  '/tse-printer-cartridges-everything-you-need-to-know': '/products',
  '/everything-you-need-to-know-about-generic-printer-cartridges': '/products',
  '/reliable-best-quality-and-efficient-printer-ink-near-me': '/products',
  '/printer-cartridges-near-me': '/products',
  '/the-best-hp-cartridges-to-enhance-your-printing-experience': '/cartridges/hp-laserjet-cartridges',
  '/printer-with-ink-tank-revolutionizing-printing-efficiency-better': '/products',
  '/buy-the-best-quality-generic-samsung-111-cartridges': '/products/samsung-mlt-d111l',
}

// The two page-title patterns the legacy site uses for model landing pages.
const MODEL_PAGE = /^\/(.+?)-(cartridges|drums?|toners?)-buy-the-best-quality-generics$/
const UNLOCK_POST = /^\/unlock-the-best-printing-quality-with-(.+?)-(cartridges?|drums?|toners?)(-\d+)?$/

// ─── Matching ───────────────────────────────────────────────────────────────

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const COLOUR = /-(black|cyan|magenta|yellow|tri-?colou?r|colou?r|bk|photo-black|light-cyan|light-magenta)(-\d+)?$/
const stripColour = (s: string): string => {
  let prev = s
  for (;;) {
    const next = prev.replace(COLOUR, '')
    if (next === prev) return prev
    prev = next
  }
}

// WooCommerce duplicate suffixes only: "-copy" or a single trailing digit.
// Must NOT be greedier than that — "-\d+" would eat the model number itself
// and turn hp-22 into hp, which then prefix-matches half the catalogue.
const stripDupe = (s: string): string => s.replace(/-(copy|[2-9])$/, '')

const colourOf = (s: string): string | null => s.match(/\b(black|cyan|magenta|yellow)\b/)?.[1] ?? null

/**
 * A discontinued colour must never land on a different colour's product page.
 * "Cyan" → a black cartridge is a mismatch Google reads as a soft 404, and a
 * shopper reads as the wrong item. Those fall through to the category instead.
 */
const colourClash = (legacy: string, handle: string): boolean => {
  const a = colourOf(legacy)
  const b = colourOf(handle)
  return a !== null && b !== null && a !== b
}

const COLOUR_TOKEN = /^(black|cyan|magenta|yellow|bk|m|c|y|k|colou?r|tri-?colou?r)$/
const YIELD_TOKEN = /^(a|x|l|s|h|xl|xxl|high|capacity|yield|unit|drum|copy|\d)$/

export function buildMatcher(handles: string[]) {
  const byNorm = new Map<string, string[]>()
  for (const h of handles) {
    const k = norm(h)
    byNorm.set(k, [...(byNorm.get(k) ?? []), h])
  }
  const brandTokens = new Set(Object.keys(BRAND_CAT))

  /** Prefix match that refuses to cross a digit boundary: hp22 must not eat hp222a. */
  const prefixMatches = (key: string): string[] =>
    handles.filter((h) => {
      const n = norm(h)
      if (!n.startsWith(key)) return false
      const next = n[key.length]
      return next === undefined || !/[0-9]/.test(next)
    })

  /** Do these handles differ only by colour or yield — i.e. one model family? */
  const sameFamily = (hits: string[], key: string): boolean =>
    hits.every((h) => {
      const tail = norm(h).slice(key.length)
      return tail === '' || COLOUR_TOKEN.test(tail) || YIELD_TOKEN.test(tail)
    })

  const pickFamily = (hits: string[], legacy: string): string =>
    hits.find((h) => colourOf(h) && colourOf(h) === colourOf(legacy)) ??
    hits.find((h) => /black|-bk$/.test(h)) ??
    [...hits].sort((a, b) => norm(a).length - norm(b).length)[0]

  return function resolve(slug: string): { target: string; tier: 'A' | 'B'; how: string } | null {
    const base = stripDupe(slug)
    const tries = [...new Set([slug, base, stripColour(slug), stripColour(base),
      slug.replace(/^generic-/, ''), stripColour(base.replace(/^generic-/, ''))])]

    for (const s of tries) {
      if (handles.includes(s) && !colourClash(slug, s)) return { target: s, tier: 'A', how: 'exact handle' }
    }
    for (const s of tries) {
      const exact = byNorm.get(norm(s))
      if (exact?.length === 1 && !colourClash(slug, exact[0])) {
        return { target: exact[0], tier: 'A', how: 'normalized exact' }
      }
    }

    // Brand-specific spellings the two catalogues disagree on.
    const cands = new Set(tries.map(norm))
    for (const s of tries) {
      if (s.startsWith('minolta-')) cands.add(norm(`konica-${s}`))
      if (s.startsWith('canon-')) {
        cands.add(norm(`canon-ca${s.slice(6)}`)) // legacy "canon-725" → "canon-ca725"
        cands.add(norm(`can-${s.slice(6)}`))
      }
      const sam = s.match(/^samsung-(mlt|clt)-(\d+)$/)
      if (sam) cands.add(norm(`samsung-${sam[1]}-d${sam[2]}`)) // "mlt-101" → "mlt-d101s"
    }
    // A bare brand token would prefix-match the whole brand — never a match.
    for (const c of [...cands]) if (brandTokens.has(c) || c.length < 4) cands.delete(c)

    for (const c of [...cands].sort((a, b) => b.length - a.length)) {
      const hits = prefixMatches(c)
      if (hits.length === 1) {
        return colourClash(slug, hits[0]) ? null : { target: hits[0], tier: 'B', how: `unique prefix "${c}"` }
      }
      if (hits.length > 1) {
        if (!sameFamily(hits, c)) return null
        const pick = pickFamily(hits, slug)
        return colourClash(slug, pick) ? null : { target: pick, tier: 'B', how: `${c} family (${hits.length})` }
      }
    }
    return null
  }
}

// ─── Legacy category membership ─────────────────────────────────────────────

/**
 * Which legacy category each legacy product sits in. This is the only reliable
 * ink-vs-laser signal: the slug alone cannot tell you that HP 21 is an inkjet
 * while HP 212A is a toner, and getting that wrong sends an ink page to a
 * toner category. Pagination is ?product-page=N — /page/N/ answers 200 with
 * page 1's content, which silently yields one page of results per category.
 */
async function crawlMembership(catPaths: string[]): Promise<Map<string, string>> {
  const member = new Map<string, string>()
  for (const catPath of catPaths) {
    const slug = catPath.replace('/product-category/', '')
    const first = await text(`${LEGACY}${catPath}/`)
    const total = Number(first.match(/of (\d+) results/)?.[1] ?? 0)
    const pages = Math.max(1, Math.ceil(total / 16))

    const collect = (html: string) => {
      for (const m of html.matchAll(/href="https:\/\/www\.tse\.co\.za\/product\/([^"/]+)\/?"/g)) {
        if (!member.has(m[1])) member.set(m[1], slug)
      }
    }
    collect(first)
    for (let p = 2; p <= pages; p++) {
      collect(await text(`${LEGACY}${catPath}/?product-page=${p}`))
      await new Promise((r) => setTimeout(r, 300))
    }
    console.log(`  ${slug}: ${total} results, ${pages} pages`)
  }
  return member
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching legacy sitemaps…')
  const legacy: { kind: SitemapKind; path: string }[] = []
  for (const kind of SITEMAPS) {
    for (const url of locs(await text(`${LEGACY}/${kind}-sitemap.xml`))) {
      legacy.push({ kind, path: pathOf(url) })
    }
  }
  console.log(`  ${legacy.length} legacy URLs`)

  console.log('Fetching the new sitemap…')
  const newUrls = locs(await text(`${NEW}/sitemap.xml`)).map(pathOf)
  const handles = newUrls.filter((p) => p.startsWith('/products/')).map((p) => p.slice(10))
  const categories = new Set(newUrls.filter((p) => p.startsWith('/cartridges/')).map((p) => p.slice(12)))
  const live = new Set(newUrls)
  console.log(`  ${handles.length} products, ${categories.size} categories`)

  const catPaths = legacy.filter((r) => r.kind === 'product_cat').map((r) => r.path)
  console.log('Crawling legacy category membership…')
  const member = await crawlMembership(catPaths)
  console.log(`  ${member.size} products placed`)

  const resolve = buildMatcher(handles)

  /** The category page a legacy slug falls back to: crawl first, brand token second. */
  const fallback = (slug: string, productSlug?: string): { cat: string; how: string } | null => {
    if (productSlug) {
      const legacyCat = member.get(productSlug) ?? member.get(stripDupe(productSlug))
      const mapped = legacyCat ? CAT_XWALK[legacyCat] : undefined
      if (mapped) return { cat: mapped, how: `legacy category "${legacyCat}"` }
    }
    // Scan every token, not just the first: the hub pages are worded
    // "/buy-hp-cartridges" and "/the-best-samsung-cartridges-to-…", so the
    // brand is rarely the leading word.
    const tokens = slug.replace(/^generic-/, '').split('-')
    // A hub page that says "inkjet" belongs on the brand's ink page, not the
    // laser default — /hp-inkjet-cartridges-buy-… is an ink page.
    const wantsInk = tokens.some((t) => t === 'ink' || t === 'inkjet')
    for (const token of tokens) {
      if (wantsInk && INK_CAT[token]) return { cat: INK_CAT[token], how: `brand token "${token}" (inkjet)` }
      if (BRAND_CAT[token]) return { cat: BRAND_CAT[token], how: `brand token "${token}"` }
    }
    return null
  }

  const rows: { path: string; kind: string; target: string | null; tier: string; how: string }[] = []
  const brandTokens = new Set(Object.keys(BRAND_CAT))

  for (const { kind, path } of legacy) {
    const add = (target: string | null, tier: string, how: string) => rows.push({ path, kind, target, tier, how })

    if (MANUAL[path]) { add(MANUAL[path], 'M', 'manual rule'); continue }
    if (kind === 'date') { add('/products', 'M', 'date archive → browse'); continue }
    if (kind === 'mailpoet_page') { add(null, 'SKIP', 'query-string page, no path to match'); continue }

    if (kind === 'product_cat') {
      const cat = CAT_XWALK[path.replace('/product-category/', '')]
      add(cat ? `/cartridges/${cat}` : null, cat ? 'A' : 'X', cat ? 'category crosswalk' : 'no crosswalk')
      continue
    }

    if (kind === 'product') {
      const slug = path.replace('/product/', '')
      const hit = resolve(slug)
      if (hit) { add(`/products/${hit.target}`, hit.tier, hit.how); continue }
      const f = fallback(slug, slug)
      add(f ? `/cartridges/${f.cat}` : null, f ? 'D' : 'X', f ? `no product → ${f.how}` : 'unresolved')
      continue
    }

    // page + post: both host model landing pages, under two different patterns.
    const m = path.match(MODEL_PAGE) ?? path.match(UNLOCK_POST)
    if (m) {
      const slug = m[1]
      if (brandTokens.has(slug)) { add(`/cartridges/${BRAND_CAT[slug]}`, 'A', 'brand hub → category'); continue }
      const hit = resolve(slug)
      if (hit) { add(`/products/${hit.target}`, hit.tier, `model page → ${hit.how}`); continue }
      const f = fallback(slug)
      add(f ? `/cartridges/${f.cat}` : null, f ? 'D' : 'X', f ? `model page → ${f.how}` : 'unresolved')
      continue
    }
    const f = fallback(path.slice(1))
    add(f ? `/cartridges/${f.cat}` : null, f ? 'D' : 'X', f ? `hub → ${f.how}` : 'editorial, no equivalent')
  }

  // Every target must be a live route. A 301 into a 404 loses the ranking just
  // as thoroughly as no redirect at all, so this is a hard failure, not a warn.
  const dead = rows.filter((r) => r.target && r.target !== '/' && !live.has(r.target))
  if (dead.length) {
    for (const d of dead) console.error(`  DEAD TARGET ${d.path} → ${d.target}`)
    throw new Error(`${dead.length} targets are not live routes`)
  }

  const mapped = rows.filter((r) => r.target)
  const tiers = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.tier]: (a[r.tier] ?? 0) + 1 }), {})
  console.log(`\nMapped ${mapped.length}/${rows.length}. Tiers:`, tiers)

  mkdirSync(join(ROOT, 'migration/raw'), { recursive: true })
  writeFileSync(join(ROOT, 'migration/raw/legacy-redirects.json'), `${JSON.stringify(rows, null, 2)}\n`)

  const width = Math.max(...mapped.map((r) => r.path.length)) + 2
  const body = mapped
    .filter((r) => r.path !== '/')
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((r) => `    ${r.path.padEnd(width)}${r.target};`)
    .join('\n')

  writeFileSync(join(ROOT, 'infrastructure/nginx/conf.d/00-legacy-redirects.conf'), `\
# ── tse.co.za → tse-cartridges.co.za 301 map ──────────────────────────────
#
# GENERATED — do not edit by hand.
#   npx tsx scripts/build-legacy-redirects.ts
#
# ${mapped.length} of ${rows.length} legacy URLs, every target verified against the live
# sitemap at generation time. Defining the map is inert: nothing reads
# $legacy_target until conf.d/legacy-tse-co-za.conf.disabled is enabled at
# cutover, so this file is safe to deploy ahead of the DNS change.
#
# Tiers (see migration/raw/legacy-redirects.json for the per-URL rationale):
#   A  exact/normalized product or category match
#   B  matched through a known spelling difference between the two catalogues
#   D  no product equivalent — falls back to the brand's category page
#   M  manual rule

# Trailing slash is how the legacy site links everything; normalize before
# lookup so /product/foo/ and /product/foo hit the same entry.
map $uri $legacy_key {
    ~^(?<stripped>.+)/$  $stripped;
    default              $uri;
}

map_hash_max_size    4096;
map_hash_bucket_size 256;

map $legacy_key $legacy_target {
    default "";
${body}
}
`)
  console.log('Wrote infrastructure/nginx/conf.d/00-legacy-redirects.conf')
  console.log('Wrote migration/raw/legacy-redirects.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
