import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { Pool } from "pg"

let _pool: Pool | null = null
const getPool = () => {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

/**
 * GET /store/compatibility?model=HP+LaserJet+1020
 *
 * Searches in order:
 *   1. model name ILIKE %query%          ("LaserJet 1020")
 *   2. brand name ILIKE %query%          ("HP")
 *   3. split on first space: brand ILIKE "HP%", model ILIKE "%LaserJet 1020%"
 *
 * Returns 200 with empty array when nothing matches.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = ((req.query.model as string) ?? "").trim()
  console.log(`[compat] query="${q}"`)

  if (!q || q.length < 2) {
    return res.json({ results: [] })
  }

  const db = getPool()

  // Single reusable SQL — joins all three tables, caller passes WHERE fragment via params.
  const sql = `
    SELECT cc.sku,
           pb.name AS brand,
           pm.name AS model
    FROM   cartridge_compat cc
    JOIN   printer_model pm ON pm.id  = cc.printer_model_id AND pm.deleted_at IS NULL
    JOIN   printer_brand pb ON pb.id  = pm.brand_id         AND pb.deleted_at IS NULL
    WHERE  cc.deleted_at IS NULL
  `

  // Stage 1 — model name
  let { rows } = await db.query<{ sku: string; brand: string; model: string }>(
    `${sql} AND pm.name ILIKE $1 LIMIT 100`,
    [`%${q}%`]
  )
  console.log(`[compat] stage1 (model ILIKE): ${rows.length} rows`)

  // Stage 2 — brand name
  if (!rows.length) {
    ;({ rows } = await db.query<{ sku: string; brand: string; model: string }>(
      `${sql} AND pb.name ILIKE $1 LIMIT 100`,
      [`%${q}%`]
    ))
    console.log(`[compat] stage2 (brand ILIKE): ${rows.length} rows`)
  }

  // Stage 3 — split first word as brand prefix, rest as model name
  if (!rows.length) {
    const spaceIdx = q.indexOf(" ")
    if (spaceIdx > 0) {
      const brandPart = q.slice(0, spaceIdx)
      const modelPart = q.slice(spaceIdx + 1)
      ;({ rows } = await db.query<{ sku: string; brand: string; model: string }>(
        `${sql} AND pb.name ILIKE $1 AND pm.name ILIKE $2 LIMIT 100`,
        [`${brandPart}%`, `%${modelPart}%`]
      ))
      console.log(`[compat] stage3 (brand="${brandPart}" model="${modelPart}"): ${rows.length} rows`)
    }
  }

  if (!rows.length) {
    console.log("[compat] no results")
    return res.json({ results: [] })
  }

  // Enrich with Medusa product data — graceful no-op when products are not yet seeded.
  const skus = [...new Set(rows.map((r) => r.sku))]
  console.log(`[compat] enriching ${rows.length} results across ${skus.length} SKUs`)

  type ProductInfo = { product_id: string; title: string; thumbnail: string | null; handle: string }
  const variantMap = new Map<string, ProductInfo>()

  try {
    const productModule = req.scope.resolve(Modules.PRODUCT) as any
    const variants = await productModule.listProductVariants(
      { sku: { $in: skus } },
      { select: ["id", "sku", "product_id"], take: skus.length }
    )
    if (variants.length) {
      const productIds = [...new Set(variants.map((v: any) => v.product_id as string))]
      const products = await productModule.listProducts(
        { id: { $in: productIds } },
        { select: ["id", "title", "thumbnail", "handle"], take: productIds.length }
      )
      const productById = new Map(products.map((p: any) => [p.id as string, p]))
      for (const v of variants) {
        const product = productById.get(v.product_id) as any
        if (product) {
          variantMap.set(v.sku as string, {
            product_id: v.product_id as string,
            title: product.title as string,
            thumbnail: (product.thumbnail as string | null) ?? null,
            handle: product.handle as string,
          })
        }
      }
    }
    console.log(`[compat] enriched ${variantMap.size} SKUs with product data`)
  } catch (err: any) {
    console.log(`[compat] product enrichment skipped: ${err.message}`)
  }

  const results = rows.map((r) => {
    const product = variantMap.get(r.sku)
    return {
      sku: r.sku,
      printer_brand: r.brand,
      printer_model: r.model,
      product_id: product?.product_id ?? null,
      title: product?.title ?? null,
      thumbnail: product?.thumbnail ?? null,
      handle: product?.handle ?? null,
    }
  })

  console.log(`[compat] returning ${results.length} results`)
  return res.json({ results })
}
