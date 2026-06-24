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
    brand,
    cartridge_type,
    price_zar: zarPrice?.amount != null ? Math.round(zarPrice.amount / 100) : null,
    image_url: product.images?.[0]?.url ?? null,
    categories,
    compatible_printers: compatiblePrinters,
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
  await index.updateSearchableAttributes(['title', 'sku', 'brand', 'compatible_printers', 'categories', 'description'])
  await index.updateFilterableAttributes(['brand', 'cartridge_type'])
  await index.updateSortableAttributes(['price_zar'])
  await index.updateRankingRules([
    'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
  ])
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
