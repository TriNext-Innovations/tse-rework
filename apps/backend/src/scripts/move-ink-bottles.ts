/**
 * #518: move the refill ink bottles out of Inkjet into Ink.
 *
 * Ink gets its own brand categories ("Canon", "Epson" under "Ink"), as Inkjet
 * and Laser have, so the bottles keep their brand in search, the brand filter
 * and the nav. Each product is set to exactly one category, its brand under
 * Ink, and metadata.cartridge_type becomes 'ink' (other metadata is kept).
 * GI-21 and GI-40 already sit directly in Ink; they move under Canon too.
 *
 * Product handles do not change, so product URLs stay the same. The Inkjet
 * brand pages (/cartridges/inkjet-canon, /cartridges/inkjet-epson) keep their
 * other products.
 *
 * Dry run by default. Apply with APPLY=1, then re-index Meilisearch:
 *   docker compose exec -T -e APPLY=1 medusa /app/node_modules/.bin/medusa exec src/scripts/move-ink-bottles.ts
 *   docker compose exec -T medusa /app/node_modules/.bin/medusa exec src/scripts/bulk-index.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createProductCategoriesWorkflow, updateProductsWorkflow } from '@medusajs/medusa/core-flows'

const INK_PARENT_HANDLE = 'ink'

// Product handle → brand under Ink.
const MOVES: Record<string, 'Canon' | 'Epson'> = {
  'epson-101': 'Epson',
  'epson-103': 'Epson',
  'epson-t6641-black-2': 'Epson',
  'epson-t6642-cyan-2': 'Epson',
  'epson-t6643-magenta-2': 'Epson',
  'epson-t6644-yellow-2': 'Epson',
  'gi-46': 'Canon',
  'gi-490-black-2': 'Canon',
  'gi-490-cyan-2': 'Canon',
  'gi-490-magenta-2': 'Canon',
  'gi-490-yellow-2': 'Canon',
  'canon-cgi41': 'Canon',
  'canon-gi-21': 'Canon',
  'canon-gi-40': 'Canon',
}

export default async function moveInkBottles({ container }: { container: MedusaContainer }) {
  const apply = process.env.APPLY === '1'
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  console.log(`[move-ink-bottles] ${apply ? 'APPLYING' : 'dry run (APPLY=1 to apply)'}`)

  const { data: parents } = await query.graph({
    entity: 'product_category',
    fields: ['id', 'name', 'handle', 'category_children.id', 'category_children.name', 'category_children.handle'],
    filters: { handle: INK_PARENT_HANDLE },
  })
  const ink = parents[0]
  if (!ink) throw new Error(`no category with handle "${INK_PARENT_HANDLE}"`)

  const brandIds: Record<string, string> = {}
  for (const brand of ['Canon', 'Epson'] as const) {
    const existing = (ink.category_children ?? []).find((c: any) => c?.name === brand)
    if (existing) {
      brandIds[brand] = existing.id
      console.log(`  ${brand} under Ink exists: ${existing.handle}`)
      continue
    }
    const handle = `ink-${brand.toLowerCase()}`
    console.log(`  create ${brand} under Ink (${handle})`)
    if (apply) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [{ name: brand, handle, parent_category_id: ink.id, is_active: true, is_internal: false }],
        },
      })
      brandIds[brand] = result[0].id
    }
  }

  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id', 'handle', 'title', 'metadata', 'categories.name', 'categories.handle'],
    filters: { handle: Object.keys(MOVES) },
  })
  const missing = Object.keys(MOVES).filter((h) => !products.some((p: any) => p.handle === h))
  if (missing.length) throw new Error(`products not found: ${missing.join(', ')}`)

  for (const p of products as any[]) {
    const brand = MOVES[p.handle]
    const from = (p.categories ?? []).map((c: any) => c.handle).join(', ') || '-'
    console.log(
      `  ${p.title}: [${from}] → [ink-${brand.toLowerCase()}], cartridge_type ${p.metadata?.cartridge_type ?? '-'} → ink`,
    )
    if (apply) {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: p.id },
          update: {
            category_ids: [brandIds[brand]],
            metadata: { ...(p.metadata ?? {}), cartridge_type: 'ink' },
          },
        },
      })
    }
  }
  console.log(`[move-ink-bottles] ${apply ? 'done' : 'dry run done'}: ${products.length} products`)
}
