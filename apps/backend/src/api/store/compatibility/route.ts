import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { Pool } from "pg"

// Module-level pool — one instance per server process, reused across requests.
let _pool: Pool | null = null
const getPool = () => {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

// Three-stage search: model name → brand name → brand-prefix + model-suffix.
// Handles "HP LaserJet 1020" even though models are stored as "LaserJet 1020".
async function queryCompat(
  db: Pool,
  query: string
): Promise<Array<{ sku: string; brand: string; model: string }>> {
  const toRow = (r: { sku: string; brand_name: string; model_name: string }) => ({
    sku: r.sku,
    brand: r.brand_name,
    model: r.model_name,
  })

  const baseSelect = `
    SELECT cc.sku, pb.name AS brand_name, pm.name AS model_name
    FROM   cartridge_compat cc
    JOIN   printer_model pm ON pm.id = cc.printer_model_id
    JOIN   printer_brand pb ON pb.id = pm.brand_id
    WHERE  pm.deleted_at IS NULL
      AND  pb.deleted_at IS NULL
      AND  cc.deleted_at IS NULL
  `

  // Stage 1 — model name ILIKE
  const { rows: byModel } = await db.query<{ sku: string; brand_name: string; model_name: string }>(
    `${baseSelect} AND pm.name ILIKE $1 LIMIT 100`,
    [`%${query}%`]
  )
  if (byModel.length) return byModel.map(toRow)

  // Stage 2 — brand name ILIKE
  const { rows: byBrand } = await db.query<{ sku: string; brand_name: string; model_name: string }>(
    `${baseSelect} AND pb.name ILIKE $1 LIMIT 100`,
    [`%${query}%`]
  )
  if (byBrand.length) return byBrand.map(toRow)

  // Stage 3 — split "HP LaserJet 1020" → brand="HP", model="LaserJet 1020"
  const words = query.split(/\s+/)
  if (words.length > 1) {
    for (let i = 1; i < words.length; i++) {
      const brandPart = words.slice(0, i).join(" ")
      const modelPart = words.slice(i).join(" ")

      const { rows: bySplit } = await db.query<{ sku: string; brand_name: string; model_name: string }>(
        `${baseSelect} AND pb.name ILIKE $1 AND pm.name ILIKE $2 LIMIT 100`,
        [`${brandPart}%`, `%${modelPart}%`]
      )
      if (bySplit.length) return bySplit.map(toRow)
    }
  }

  return []
}

/**
 * GET /store/compatibility?model=HP+LaserJet+1020
 *
 * Returns cartridges compatible with the given printer model.
 * Uses direct SQL — no dependency on the custom Medusa module container.
 * Always returns 200; empty array when no match.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = ((req.query.model as string) ?? "").trim()

  if (!query || query.length < 2) {
    return res.json({ results: [] })
  }

  const db = getPool()
  const matches = await queryCompat(db, query)

  if (!matches.length) {
    return res.json({ results: [] })
  }

  // Enrich with Medusa product data. Graceful no-op when products not seeded.
  const skus = [...new Set(matches.map((m) => m.sku))]
  type ProductInfo = { product_id: string; title: string; thumbnail: string | null; handle: string }
  const variantMap = new Map<string, ProductInfo>()

  try {
    const productModule = req.scope.resolve(Modules.PRODUCT) as any
    const variants = await productModule.listProductVariants(
      { sku: { $in: skus } },
      { select: ["id", "sku", "product_id"], take: skus.length }
    )

    if (variants.length) {
      const productIds = [...new Set(variants.map((v: any) => v.product_id))]
      const products = await productModule.listProducts(
        { id: { $in: productIds } },
        { select: ["id", "title", "thumbnail", "handle"], take: productIds.length }
      )
      const productById = new Map(products.map((p: any) => [p.id, p]))

      for (const v of variants) {
        const product = productById.get(v.product_id) as any
        if (product) {
          variantMap.set(v.sku, {
            product_id: v.product_id,
            title: product.title as string,
            thumbnail: (product.thumbnail as string | null) ?? null,
            handle: product.handle as string,
          })
        }
      }
    }
  } catch {
    // Products not seeded yet — compat data returned without enrichment
  }

  const results = matches.map((m) => {
    const product = variantMap.get(m.sku)
    return {
      sku: m.sku,
      printer_brand: m.brand,
      printer_model: m.model,
      product_id: product?.product_id ?? null,
      title: product?.title ?? null,
      thumbnail: product?.thumbnail ?? null,
      handle: product?.handle ?? null,
    }
  })

  return res.json({ results })
}
