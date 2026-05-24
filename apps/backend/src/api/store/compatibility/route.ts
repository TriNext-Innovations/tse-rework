import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { Pool } from "pg"

// Only pass through thumbnails stored in our own infrastructure.
// WooCommerce import leaves WordPress URLs in the DB — drop them until
// the import pipeline re-uploads images to S3/R2.
const ALLOWED_THUMBNAIL_HOSTS = [".supabase.co", ".r2.dev"]
function ownThumbnail(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    return ALLOWED_THUMBNAIL_HOSTS.some((h) => host.endsWith(h)) ? url : null
  } catch {
    return null
  }
}

let _pool: Pool | null = null
const getPool = () => {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return _pool
}

// Normalize a search string the same way we built search_name:
// lowercase + strip all non-alphanumeric chars.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

type Row = { sku: string; brand: string; model: string }

/**
 * GET /store/compatibility?model=HP+LaserJet+1020
 *
 * Search strategy:
 *   Stage 1 — normalize the full query, match against pm.search_name
 *             Catches "PIXMA MX494", "MX494", "Canon PIXMA MX494", "HP LaserJet M233"
 *
 *   Stage 2 — try each word-boundary split: first N words as brand prefix,
 *             rest as normalized model token against pm.search_name
 *             Catches "Canon MX494" (brand="Canon", token="mx494")
 *             and "HP M233" (brand="HP", token="m233")
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = ((req.query.model as string) ?? "").trim()
  const normQ = norm(q)
  console.log(`[compat] query="${q}" norm="${normQ}"`)

  if (!q || normQ.length < 2) {
    return res.json({ results: [] })
  }

  const db = getPool()

  const baseSQL = `
    SELECT cc.sku,
           pb.name AS brand,
           pm.name AS model
    FROM   cartridge_compat cc
    JOIN   printer_model pm ON pm.id  = cc.printer_model_id AND pm.deleted_at IS NULL
    JOIN   printer_brand pb ON pb.id  = pm.brand_id         AND pb.deleted_at IS NULL
    WHERE  cc.deleted_at IS NULL
  `

  // Stage 1 — full normalized query against search_name
  let { rows } = await db.query<Row>(
    `${baseSQL} AND pm.search_name ILIKE $1 LIMIT 100`,
    [`%${normQ}%`]
  )
  console.log(`[compat] stage1 search_name ILIKE "%${normQ}%": ${rows.length} rows`)

  // Stage 2 — split on whitespace: try each prefix as brand, rest as model token
  if (!rows.length) {
    const words = q.split(/\s+/)
    outer: for (let i = 1; i < words.length; i++) {
      const brandPart = words.slice(0, i).join(" ")
      const modelNorm = norm(words.slice(i).join(" "))
      if (modelNorm.length < 2) continue
      ;({ rows } = await db.query<Row>(
        `${baseSQL} AND pb.name ILIKE $1 AND pm.search_name ILIKE $2 LIMIT 100`,
        [`${brandPart}%`, `%${modelNorm}%`]
      ))
      console.log(`[compat] stage2 brand="${brandPart}" model_norm="${modelNorm}": ${rows.length} rows`)
      if (rows.length) break outer
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
        {
          select: ["id", "title", "thumbnail", "handle"],
          relations: ["images"],
          take: productIds.length,
        }
      )
      const productById = new Map(products.map((p: any) => [p.id as string, p]))
      for (const v of variants) {
        const product = productById.get(v.product_id) as any
        if (product) {
          // Prefer images[0].url (same source as products page) over thumbnail,
          // which may still hold the old WordPress URL from the WooCommerce import.
          const imageUrl: string | null = product.images?.[0]?.url ?? product.thumbnail ?? null
          variantMap.set(v.sku as string, {
            product_id: v.product_id as string,
            title:      product.title as string,
            thumbnail:  ownThumbnail(imageUrl),
            handle:     product.handle as string,
          })
        }
      }
    }
    console.log(`[compat] enriched ${variantMap.size} SKUs with product data`)
  } catch (err: any) {
    console.log(`[compat] product enrichment skipped: ${err.message}`)
  }

  // Dedupe by product (when matched) so colour variants of the same cartridge
  // collapse into one card. SKUs without a matched product stay individual.
  const seen = new Set<string>()
  const results: any[] = []
  for (const r of rows) {
    const product = variantMap.get(r.sku)
    const key = product?.product_id ?? r.sku
    if (seen.has(key)) continue
    seen.add(key)
    results.push({
      sku:           r.sku,
      printer_brand: r.brand,
      printer_model: r.model,
      product_id:    product?.product_id ?? null,
      title:         product?.title ?? null,
      thumbnail:     product?.thumbnail ?? null,
      handle:        product?.handle ?? null,
    })
  }

  console.log(`[compat] returning ${results.length} deduped results (from ${rows.length} rows)`)
  return res.json({ results })
}
