import { Meilisearch } from 'meilisearch'
import { Pool } from 'pg'

export const SEARCH_INDEX = 'products'

const TYPE_CATEGORIES = new Set(['Inkjet Cartridges', 'Laser Cartridges'])

export type SearchDocument = {
  id: string
  title: string
  handle: string
  description: string | null
  sku: string | null
  // HP's box codes ("85A" for CE285A). See hpShortCodes.
  short_codes: string[]
  brand: string | null
  cartridge_type: string | null
  price_zar: number | null
  image_url: string | null
  categories: string[]
  // Printer models this cartridge fits (e.g. "MX 494", "MX494", "Canon MX 494").
  // Indexed as a searchable attribute so a printer-model query surfaces the
  // compatible cartridges. Sourced from the cartridge_compat tables, not the
  // product module — see getCompatPrintersBySku.
  compatible_printers: string[]
  // Separator-insensitive joins of the fields above — see joinVariants.
  search_joins: string[]
}

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

/**
 * Map each SKU to the set of searchable printer-model strings it's compatible
 * with. Built from cartridge_compat → printer_model → printer_brand (the same
 * tables /store/compatibility queries). For each model we emit a few token
 * shapes so both spaced ("MX 494" → "494") and concatenated ("MX494") queries
 * match under Meilisearch's tokenizer.
 */
export async function getCompatPrintersBySku(
  skus: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  if (skus.length === 0) return map

  const { rows } = await getPool().query<{ sku: string; brand: string; model: string }>(
    `SELECT cc.sku, pb.name AS brand, pm.name AS model
     FROM   cartridge_compat cc
     JOIN   printer_model pm ON pm.id = cc.printer_model_id AND pm.deleted_at IS NULL
     JOIN   printer_brand pb ON pb.id = pm.brand_id         AND pb.deleted_at IS NULL
     WHERE  cc.deleted_at IS NULL AND cc.sku = ANY($1)`,
    [skus],
  )

  for (const r of rows) {
    let set = map.get(r.sku)
    if (!set) { set = new Set(); map.set(r.sku, set) }
    if (r.model) {
      set.add(r.model)
      const despaced = r.model.replace(/\s+/g, '')
      if (despaced !== r.model) set.add(despaced)
      if (r.brand) set.add(`${r.brand} ${r.model}`)
    }
  }
  return map
}

export function getSearchClient(): Meilisearch {
  return new Meilisearch({
    host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY ?? '',
  })
}

/**
 * Build the separator-insensitive match tokens for a string.
 *
 * Meilisearch's tokenizer splits letter-digit boundaries, so "HP106" already
 * finds "HP 106". It does NOT split letter-letter, so "canonmx494" misses
 * "Canon MX 494" — customers routinely run the brand and model together.
 *
 * We close that by indexing the adjacent-word joins of the source string:
 * "Canon MX 494 Ink" yields canonmx, mx494, 494ink (pairs) and canonmx494,
 * mx494ink (triples). Deliberately NOT one normalised blob of the whole
 * string — a single long token prefix-matches every short query ("hp" would
 * hit "hp106blacktonercartridge") and skews ranking across the catalogue.
 */
export function joinVariants(source: string, maxWindow = 3): string[] {
  const words = source
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
  if (words.length < 2) return []

  const out = new Set<string>()
  for (let size = 2; size <= maxWindow; size++) {
    for (let i = 0; i + size <= words.length; i++) {
      const joined = words.slice(i, i + size).join('')
      // Joins this short are noise, not intent.
      if (joined.length >= 4) out.add(joined)
    }
  }
  return [...out]
}

/** Every join token for a product: its own fields, plus brand-prefixed printers. */
export function buildSearchJoins(
  parts: { title: string; sku: string | null; brand: string | null; compatiblePrinters: string[] },
): string[] {
  const { title, sku, brand, compatiblePrinters } = parts
  const out = new Set<string>()
  for (const source of [title, sku ?? '', brand ?? '', ...compatiblePrinters]) {
    for (const v of joinVariants(source)) out.add(v)
  }
  // Some models are stored brand-less, so pair brand and model up too.
  if (brand) {
    for (const printer of compatiblePrinters) {
      for (const v of joinVariants(`${brand} ${printer}`)) out.add(v)
    }
  }
  return [...out]
}

// Colour LaserJet parts whose digits do not give their box code. CE314A is
// the HP 126A drum; the digit rule would call it 14A, which is CF214A.
const HP_SHORT_CODE_EXCEPTIONS = new Set(['CE314A'])

/**
 * The code HP prints on the box, derived from the part number on the SKU.
 *
 * Customers search "85A"; the product is "HP CE285A". Meilisearch matches word
 * prefixes, never text inside a word, so "85A" finds nothing (#483). For HP
 * monochrome LaserJet parts the box code is the last two digits plus the
 * A/X suffix: CE285A → 85A, Q2612A → 12A, CF259X → 59X. The W-series keeps
 * three: W1106A → 106A.
 *
 * Colour sets (SKUs ending -K/-C/-M/-Y) are skipped on purpose. Their box
 * codes are model numbers that do not follow the digits (CE310A is 126A
 * black), and deriving one would point a "10A" search at the wrong product.
 */
export function hpShortCodes(sku: string | null): string[] {
  const s = (sku ?? '').toUpperCase()
  if (!s.startsWith('HP-')) return []
  if (/-(K|C|M|Y|BK|LC|LM)$/.test(s)) return []
  const part = s.slice(3)

  const laser = part.match(/^(?:C[A-Z]|Q)(\d{1,2})(\d{2})([AX])/)
  if (laser) {
    if (HP_SHORT_CODE_EXCEPTIONS.has(laser[0])) return []
    return [`${laser[2]}${laser[3]}`]
  }
  const wSeries = part.match(/^W\d(\d{3})([AX])/)
  if (wSeries) return [`${wSeries[1]}${wSeries[2]}`]
  return []
}

export function productToDocument(
  product: any,
  compatiblePrinters: string[] = [],
): SearchDocument {
  const variant = product.variants?.[0]
  const zarPrice = variant?.prices?.find((p: any) =>
    p.currency_code?.toLowerCase() === 'zar',
  ) ?? variant?.prices?.[0]

  const categories: string[] = (product.categories ?? []).map((c: any) => c.name as string)
  const brand = categories.find((c) => !TYPE_CATEGORIES.has(c)) ?? null
  const cartridge_type: string | null = product.metadata?.cartridge_type ?? null

  return {
    id: product.id,
    title: product.title ?? '',
    handle: product.handle ?? '',
    description: product.description ?? null,
    sku: variant?.sku ?? null,
    short_codes: hpShortCodes(variant?.sku ?? null),
    brand,
    cartridge_type,
    price_zar: zarPrice?.amount != null ? Math.round(zarPrice.amount) : null,
    image_url: product.images?.[0]?.url ?? null,
    categories,
    compatible_printers: compatiblePrinters,
    search_joins: buildSearchJoins({
      title: product.title ?? '',
      sku: variant?.sku ?? null,
      brand,
      compatiblePrinters,
    }),
  }
}

/** Union the compat printer strings across all of a product's variant SKUs. */
export function compatiblePrintersForProduct(
  product: any,
  bySku: Map<string, Set<string>>,
): string[] {
  const out = new Set<string>()
  for (const v of product.variants ?? []) {
    const set = v?.sku ? bySku.get(v.sku) : undefined
    if (set) for (const s of set) out.add(s)
  }
  return [...out]
}

export async function configureIndex(client: Meilisearch): Promise<void> {
  const index = client.index(SEARCH_INDEX)
  await index.updateSearchableAttributes(['title', 'sku', 'short_codes', 'brand', 'compatible_printers', 'search_joins', 'categories', 'description'])
  await index.updateFilterableAttributes(['brand', 'cartridge_type'])
  await index.updateSortableAttributes(['price_zar'])
  await index.updateRankingRules([
    'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
  ])
  // Typo tolerance, stated rather than inherited.
  //
  // Prose can take a typo; a part number cannot. "HP 106" and "HP 105" are
  // different products, and a cartridge bought on a fuzzy match is a return.
  // The defaults already shield the short codes — a typo needs a 5-character
  // word, so "106" and "494" get none — but that is a property of the
  // defaults, not a decision, and it would move if they did. Pinned here.
  //
  // `sku` is the one attribute worth disabling outright: a near-miss on an
  // exact part number is always wrong (W1106B must not find W1106A).
  //
  // `search_joins` is deliberately NOT in this list, despite also being an
  // identifier field. Disabling typos on it stops it matching AT ALL, not just
  // fuzzily, which silently undoes the separator fix it exists for —
  // "canonmx494" drops back to zero results. Verified against v1.12.8:
  //
  //   disableOnAttributes            canonmx494   W1106B   cartrige
  //   sku, search_joins, printers    0 (broken)   0        4
  //   sku                            1            0        4
  //   (none)                         1            1        4
  //
  // The cost of leaving it out: a typo'd model code can still match through
  // `search_joins` or `title` (TN2412 finds TN-2411). Exactness ranking puts
  // the right product first, and that is the better trade against breaking
  // spaceless search outright. Revisit if Meilisearch separates "no typos on
  // this attribute" from "do not match this attribute".
  await index.updateTypoTolerance({
    enabled: true,
    minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
    disableOnAttributes: ['sku'],
  })
}

export async function upsertDocument(product: any): Promise<void> {
  const client = getSearchClient()
  const skus = (product.variants ?? []).map((v: any) => v?.sku).filter(Boolean)
  const bySku = await getCompatPrintersBySku(skus)
  const doc = productToDocument(product, compatiblePrintersForProduct(product, bySku))
  await client.index(SEARCH_INDEX).addDocuments([doc], { primaryKey: 'id' })
}

export async function deleteDocument(id: string): Promise<void> {
  const client = getSearchClient()
  await client.index(SEARCH_INDEX).deleteDocument(id)
}

/**
 * Drop every document that a full re-index did not just write.
 *
 * addDocuments only ever upserts, so a product that is unpublished or deleted
 * keeps its document — and stays searchable on the live site — until something
 * removes it. That has bitten us twice (149 ghosts found 2026-07-30, 3 more on
 * 2026-08-04), so a full run now prunes rather than leaving the index to drift.
 *
 * Only safe to call with the complete set of live ids from a finished run.
 * Returns the ids removed.
 */
export async function pruneStaleDocuments(
  client: Meilisearch,
  liveIds: Set<string>,
): Promise<string[]> {
  const index = client.index(SEARCH_INDEX)
  const PAGE = 1000
  const stale: string[] = []

  for (let offset = 0; ; offset += PAGE) {
    const { results } = await index.getDocuments<{ id: string }>({
      limit: PAGE,
      offset,
      fields: ['id'],
    })
    if (results.length === 0) break
    for (const doc of results) if (!liveIds.has(doc.id)) stale.push(doc.id)
    if (results.length < PAGE) break
  }

  if (stale.length > 0) await index.deleteDocuments(stale).waitTask()
  return stale
}
