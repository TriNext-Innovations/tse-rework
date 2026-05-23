import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { COMPATIBILITY_MODULE } from "../../../modules/compatibility"

/**
 * GET /store/compatibility?model=HP+LaserJet+1020
 *
 * Returns cartridges compatible with the given printer model.
 * Partial/case-insensitive match on model name.
 * Always returns 200 — empty array when no match.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = ((req.query.model as string) ?? "").trim()

  if (!query || query.length < 2) {
    return res.json({ results: [] })
  }

  const compatService = req.scope.resolve(COMPATIBILITY_MODULE) as any
  const matches: Array<{ sku: string; brand: string; model: string }> =
    await compatService.findByModel(query)

  if (!matches.length) {
    return res.json({ results: [] })
  }

  // Enrich with Medusa product data where possible.
  // Products may not be seeded yet — gracefully returns null fields.
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
    // Product module unavailable or products not seeded — return compat data only
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
