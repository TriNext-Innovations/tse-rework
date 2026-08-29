// Printer-model landing pages — the one axis where this store can lead the market.
//
// TSE holds compatibility data for 903 printer models. Measured 21 Aug against
// the SA competitors that rank for compatible-cartridge terms: the largest
// printer-page inventory found was Ink Station's 117. Catalogue size is a fight
// this store cannot win (301 products against tonercorp's 3,552), but "which
// cartridge fits my printer" is a different query, and on that one 903 beats
// everything else in the market by a factor of seven.
//
// The legacy tse.co.za has no page of this type at all, so this is also the
// first thing the new store can do that the old one never could.

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export type PrinterModel = {
  brand: string
  model: string
  /**
   * ⚠ Counts compatibility rows — i.e. SKUs, one per colour — while
   * `findCartridges()` returns grouped PRODUCTS. A 4-colour set is 4 here and 1
   * there. Verified on Konica Minolta C284e: this says 8, the lookup returns 2
   * products of 4 variants each. Both are right for different questions and
   * they contradict each other on a page, so this value is NEVER rendered.
   * Pages count what they actually display.
   */
  cartridge_count: number
}

export type CompatibleCartridge = {
  sku: string
  title: string
  handle?: string
  product_id: string
  printer_brand: string
  printer_model: string
  thumbnail?: string | null
  /** Filled in by `withPricing()` — the compatibility endpoint has no price. */
  price?: number | null
  image?: string | null
  variantId?: string | null
}

/** URL segment for a model. Verified collision-free across all 903 models. */
export function printerSlug(brand: string, model: string): string {
  return `${brand} ${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function printerLabel(p: { brand: string; model: string }): string {
  // Several model names already start with the brand ("Ecosys …" does not, but
  // "HP LaserJet …" style entries exist), so avoid printing it twice.
  return p.model.toLowerCase().startsWith(p.brand.toLowerCase())
    ? p.model
    : `${p.brand} ${p.model}`
}

export async function fetchPrinterModels(): Promise<PrinterModel[]> {
  try {
    const res = await fetch(`${BACKEND}/store/compatibility/models`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const d = await res.json()
    return (d.models ?? []) as PrinterModel[]
  } catch {
    return []
  }
}

export async function findPrinterBySlug(slug: string): Promise<PrinterModel | null> {
  const models = await fetchPrinterModels()
  return models.find((m) => printerSlug(m.brand, m.model) === slug) ?? null
}

export async function findCartridges(brand: string, model: string): Promise<CompatibleCartridge[]> {
  try {
    const params = new URLSearchParams({ model: `${brand} ${model}` })
    const res = await fetch(`${BACKEND}/store/compatibility?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 600 },
    })
    if (!res.ok) return []
    const d = await res.json()
    const results = (d.results ?? []) as CompatibleCartridge[]
    const seen = new Set<string>()
    return results.filter((r) => {
      // Belt and braces against the backend regressing: a row without a handle
      // rendered as `href="/products/null"`. The endpoint now drops these, but
      // the page should not be able to emit a broken link even if it stops.
      if (!r.handle) return false
      // The endpoint can return the same product under more than one matching
      // rule; a printer page must never list one cartridge twice.
      const key = r.product_id ?? r.sku
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

/** Models grouped by brand, each list sorted, for the /printers index. */
export function groupByBrand(models: PrinterModel[]): { brand: string; models: PrinterModel[] }[] {
  const map = new Map<string, PrinterModel[]>()
  for (const m of models) {
    const list = map.get(m.brand) ?? []
    list.push(m)
    map.set(m.brand, list)
  }
  return [...map.entries()]
    .map(([brand, list]) => ({
      brand,
      models: [...list].sort((a, b) => a.model.localeCompare(b.model, 'en', { numeric: true })),
    }))
    .sort((a, b) => b.models.length - a.models.length || a.brand.localeCompare(b.brand))
}

async function getRegionId(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND}/store/regions?limit=1`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return d.regions?.[0]?.id ?? ''
  } catch {
    return ''
  }
}

/**
 * Add price, image and variant id to compatibility results.
 *
 * `/store/compatibility` answers "does it fit", not "what does it cost" — it
 * returns no price, and its thumbnail is null for most rows because the
 * WooCommerce import left WordPress URLs the endpoint deliberately drops. A
 * printer page without prices is a worse answer than the competitor pages it
 * has to beat, so the products are re-read from the store API in one batched
 * call keyed on the ids we already have.
 *
 * Enrichment is best-effort: on failure the cards still render with title and
 * SKU rather than the page failing.
 */
export async function withPricing(cartridges: CompatibleCartridge[]): Promise<CompatibleCartridge[]> {
  const ids = cartridges.map((c) => c.product_id).filter(Boolean)
  if (ids.length === 0) return cartridges
  try {
    const regionId = await getRegionId()
    const params = new URLSearchParams()
    for (const id of ids) params.append('id[]', id)
    if (regionId) params.set('region_id', regionId)
    params.set('fields', '+images,+variants.id,+variants.sku,*variants.calculated_price')

    const res = await fetch(`${BACKEND}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 300 },
    })
    if (!res.ok) return cartridges
    type ApiProduct = {
      id: string
      images?: { url: string }[]
      variants?: { id: string; calculated_price?: { calculated_amount?: number } | null }[]
    }
    const d = await res.json()
    const byId = new Map<string, ApiProduct>(
      ((d.products ?? []) as ApiProduct[]).map((p) => [p.id, p]),
    )

    return cartridges.map((c) => {
      const p = byId.get(c.product_id)
      if (!p) return c
      const variant = p.variants?.[0]
      const amount = variant?.calculated_price?.calculated_amount
      return {
        ...c,
        price: typeof amount === 'number' ? amount : null,
        image: p.images?.[0]?.url ?? c.thumbnail ?? null,
        variantId: variant?.id ?? null,
      }
    })
  } catch {
    return cartridges
  }
}
