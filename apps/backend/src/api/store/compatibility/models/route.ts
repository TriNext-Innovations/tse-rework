import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

let _pool: Pool | null = null
const getPool = () => {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

/**
 * GET /store/compatibility/models
 *
 * Returns every printer model that has at least one compatible cartridge the
 * shopper can actually buy, ordered by count (descending) so popular models
 * surface first. Used for autocomplete, for /printers, and for the printer
 * pages in the sitemap — so "has a cartridge" has to mean the same thing here
 * as it does on the page, or the sitemap advertises URLs that 404.
 *
 * The join to product/product_variant is what makes that true. `cartridge_compat`
 * records a physical fact — this cartridge fits this printer — and keeps
 * recording it after the product is delisted. `delist-products.cjs` sets
 * `status='draft'` and never touches the compat table, so 190 drafted products
 * were still being counted here: 903 models claimed cartridges, but only 765
 * had one that was published and purchasable. The other 138 rendered a page of
 * links that all 404'd.
 *
 * `cartridge_count` counts DISTINCT PUBLISHED PRODUCTS, deliberately — the same
 * unit the page displays. It used to count `cartridge_compat` rows, i.e. SKUs,
 * one per colour, so a 4-colour set read as 8 where the page showed 2. A number
 * that cannot be reconciled with what the user sees is worse than no number.
 *
 * Cached for 1 hour at the edge.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const db = getPool()

  const { rows } = await db.query<{
    brand: string
    model: string
    cartridge_count: string
  }>(`
    SELECT
      pb.name AS brand,
      pm.name AS model,
      COUNT(DISTINCT p.id) AS cartridge_count
    FROM   printer_model pm
    JOIN   printer_brand pb ON pb.id = pm.brand_id AND pb.deleted_at IS NULL
    LEFT JOIN cartridge_compat cc
           ON cc.printer_model_id = pm.id AND cc.deleted_at IS NULL
    LEFT JOIN product_variant pv
           ON pv.sku = cc.sku AND pv.deleted_at IS NULL
    LEFT JOIN product p
           ON p.id = pv.product_id AND p.deleted_at IS NULL AND p.status = 'published'
    WHERE  pm.deleted_at IS NULL
      AND  pm.name ~ '^[A-Za-z]'  -- bare-number names like "656cdw" are CSV artifacts; still searchable, just not surfaced
    GROUP BY pb.name, pm.name
    HAVING COUNT(DISTINCT p.id) > 0
    ORDER BY COUNT(DISTINCT p.id) DESC, pb.name, pm.name
  `)

  console.log(`[compat/models] returning ${rows.length} models`)

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=600")
  res.json({
    models: rows.map((r) => ({
      brand: r.brand,
      model: r.model,
      cartridge_count: parseInt(r.cartridge_count, 10),
    })),
  })
}
