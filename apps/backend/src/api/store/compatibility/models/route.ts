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
 * Returns every printer model that has at least one compatible cartridge,
 * ordered by cartridge count (descending) so popular models surface first.
 * Used by the storefront to populate autocomplete suggestions — list grows
 * automatically as new printers are seeded into the compatibility tables.
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
      COUNT(cc.id) AS cartridge_count
    FROM   printer_model pm
    JOIN   printer_brand pb ON pb.id = pm.brand_id AND pb.deleted_at IS NULL
    LEFT JOIN cartridge_compat cc
           ON cc.printer_model_id = pm.id AND cc.deleted_at IS NULL
    WHERE  pm.deleted_at IS NULL
      AND  pm.name ~ '^[A-Za-z]'  -- bare-number names like "656cdw" are CSV artifacts; still searchable, just not surfaced
    GROUP BY pb.name, pm.name
    HAVING COUNT(cc.id) > 0
    ORDER BY COUNT(cc.id) DESC, pb.name, pm.name
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
