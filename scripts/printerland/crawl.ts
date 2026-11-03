/**
 * Printerland compatibility crawler (#482).
 *
 * The client asked for printer ↔ cartridge compatibility from
 * printerland.co.za, which they trust. Printerland sells genuine cartridges
 * only and is a competitor: it is a data source, never something the
 * storefront mentions.
 *
 *   npx tsx scripts/printerland/crawl.ts            # crawl, then write today's snapshot
 *   npx tsx scripts/printerland/crawl.ts --limit 20 # try it on a few pages
 *
 * Politeness (checked 27 Oct 2026: their terms cover sales only and say nothing
 * on automated access; /robots.txt is a 404):
 *   - one request at a time, ≥3 s apart, identifying user agent with a contact
 *   - run by hand only — never put this on a schedule against their site
 *   - resumable: every fetched page is appended to .cache/printerland/pages.jsonl
 *     and skipped on the next run, so an interrupted crawl never refetches
 *
 * Output: migration/raw/printerland/<YYYY-MM-DD>.json — cartridge pages only,
 * sorted, so consecutive runs diff cleanly. scripts/printerland/match.ts turns
 * it into an import CSV and a review report.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ORIGIN = 'https://www.printerland.co.za'
const UA = 'TSE-compat-research/1.0 (+https://www.tse.co.za; sales@tse.co.za)'
const DELAY_MS = 3000
const ROOT = join(import.meta.dirname, '../..')
const CACHE_DIR = join(ROOT, '.cache/printerland')
const PAGES = join(CACHE_DIR, 'pages.jsonl')
const OUT_DIR = join(ROOT, 'migration/raw/printerland')

// Sitemaps mix printers, paper and cables in with consumables. Only slugs that
// name a consumable are fetched; a printer page has no "works with" list anyway.
const CONSUMABLE = /cartridge|toner|ink|drum|bottle|developer|imaging|ribbon/i

export type PageResult = {
  url: string
  status: number
  /** Printerland's part number, e.g. CNHPCE285A. */
  mpn?: string
  brand?: string
  title?: string
  /** One entry per compatible printer family, from the per-family links. */
  families?: string[]
  /** The comma-separated "works with" line, kept as a cross-check. */
  worksWith?: string
  fetchedAt: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastRequest = 0

async function get(url: string): Promise<{ status: number; body: string }> {
  const wait = lastRequest + DELAY_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' })
  return { status: res.status, body: res.ok ? await res.text() : '' }
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseProductPage(url: string, status: number, html: string): PageResult {
  const result: PageResult = { url, status, fetchedAt: new Date().toISOString() }
  if (!html) return result

  result.mpn = html.match(/itemprop="mpn"\s+content\s*=\s*"([^"]+)"/)?.[1]?.trim()
  result.brand = html.match(/itemprop="brand"\s+content\s*=\s*"([^"]+)"/)?.[1]?.trim()
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]
  if (title) result.title = decode(title)

  const families = [...html.matchAll(/class="product-detail-compatible-product-link">\s*<a[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => decode(m[1] ?? ''))
    .filter(Boolean)
  if (families.length) result.families = [...new Set(families)]

  const works = html.match(/class="compatible-item">([\s\S]*?)<\/span>/)?.[1]
  if (works) result.worksWith = decode(works)

  return result
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!)
}

function loadDone(): Map<string, PageResult> {
  const done = new Map<string, PageResult>()
  if (!existsSync(PAGES)) return done
  for (const line of readFileSync(PAGES, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const row = JSON.parse(line) as PageResult
    // A failed fetch is retried on the next run; a 404 is a real answer.
    if (row.status === 200 || row.status === 404) done.set(row.url, row)
  }
  return done
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity

  mkdirSync(CACHE_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const index = await get(`${ORIGIN}/sitemap.xml`)
  if (index.status !== 200) throw new Error(`sitemap index: HTTP ${index.status}`)
  const brandMaps = locs(index.body).filter((u) => /\/Site-Maps\//.test(u) && !/Category/i.test(u))

  const urls: string[] = []
  for (const map of brandMaps) {
    const res = await get(map)
    if (res.status !== 200) {
      console.warn(`  skip ${map}: HTTP ${res.status}`)
      continue
    }
    const all = locs(res.body).filter((u) => u.includes('/product/'))
    const kept = all.filter((u) => CONSUMABLE.test(u.split('/product/')[1] ?? ''))
    console.log(`  ${map.split('/').pop()}: ${kept.length} consumable pages of ${all.length}`)
    urls.push(...kept)
  }

  const done = loadDone()
  const todo = [...new Set(urls)].filter((u) => !done.has(u)).slice(0, limit)
  const etaMin = Math.ceil((todo.length * DELAY_MS) / 60000)
  console.log(`\n${done.size} pages cached, ${todo.length} to fetch (~${etaMin} min at ${DELAY_MS / 1000} s each)\n`)

  let n = 0
  for (const url of todo) {
    let row: PageResult
    try {
      const res = await get(url)
      row = parseProductPage(url, res.status, res.body)
    } catch (err) {
      row = { url, status: 0, fetchedAt: new Date().toISOString() }
      console.warn(`  ${url}: ${(err as Error).message}`)
    }
    appendFileSync(PAGES, `${JSON.stringify(row)}\n`)
    done.set(url, row)
    if (++n % 50 === 0) console.log(`  ${n}/${todo.length}`)
  }

  // Snapshot: only pages that are cartridges with a compatibility list, and only
  // URLs still in the sitemaps, so delisted items drop out between runs.
  const live = new Set(urls)
  const snapshot = [...done.values()]
    .filter((r) => live.has(r.url) && r.mpn && r.families?.length)
    .map(({ url, mpn, brand, title, families, worksWith }) => ({ mpn, brand, title, families, worksWith, url }))
    .sort((a, b) => a.mpn!.localeCompare(b.mpn!) || a.url.localeCompare(b.url))

  const out = join(OUT_DIR, `${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`\nWrote ${snapshot.length} cartridges → ${out.replace(`${ROOT}/`, '')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
