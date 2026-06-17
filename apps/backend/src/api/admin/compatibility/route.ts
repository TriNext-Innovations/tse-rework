import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Pool } from 'pg'

let _pool: Pool | null = null
const getPool = () => {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

/**
 * GET /admin/compatibility?sku=XXX
 *
 * Returns the printer models compatible with a cartridge SKU. Queries the
 * compatibility tables directly via pg (same pattern as the store
 * compatibility routes) rather than the compatibility module service — the
 * module's ORM manager isn't wired up at runtime.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sku = (req.query as Record<string, string>).sku?.trim()

  if (!sku) {
    return res.status(400).json({ error: 'sku query param is required' })
  }

  try {
    const db = getPool()
    const { rows } = await db.query<{ brand: string; model: string; printer_model_id: string }>(
      `SELECT DISTINCT pb.name AS brand, pm.name AS model, pm.id AS printer_model_id
       FROM   cartridge_compat cc
       JOIN   printer_model pm ON pm.id = cc.printer_model_id AND pm.deleted_at IS NULL
       LEFT JOIN printer_brand pb ON pb.id = pm.brand_id AND pb.deleted_at IS NULL
       WHERE  cc.sku = $1 AND cc.deleted_at IS NULL
       ORDER BY pb.name, pm.name
       LIMIT 200`,
      [sku],
    )
    const models = rows.map((r) => ({
      brand: r.brand ?? '',
      model: r.model,
      printer_model_id: r.printer_model_id,
    }))
    return res.status(200).json({ models, count: models.length })
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Failed to query compatibility data' })
  }
}
