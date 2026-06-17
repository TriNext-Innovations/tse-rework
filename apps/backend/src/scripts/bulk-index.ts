/**
 * Bulk-index all Medusa products into Meilisearch.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/bulk-index.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { getSearchClient, configureIndex, productToDocument, SEARCH_INDEX } from '../lib/search'

const BATCH = 50

// Prices live in the pricing module, not the product module, so they are only
// reachable through the Query graph (which traverses the module link) — NOT as
// a `variants.prices` relation on productService.listProducts (that throws).
const PRODUCT_FIELDS = [
  'id',
  'title',
  'handle',
  'description',
  'metadata',
  'status',
  'images.url',
  'categories.name',
  'variants.sku',
  'variants.prices.amount',
  'variants.prices.currency_code',
]

export default async function bulkIndex({ container }: { container: MedusaContainer }) {
  const client = getSearchClient()

  console.log('[bulk-index] configuring Meilisearch index settings…')
  await configureIndex(client)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  let offset = 0
  let indexed = 0

  console.log('[bulk-index] starting product indexing…')

  while (true) {
    const { data: products } = await query.graph({
      entity: 'product',
      fields: PRODUCT_FIELDS,
      filters: { status: 'published' },
      pagination: { skip: offset, take: BATCH },
    })

    if (products.length === 0) break

    const docs = products.map(productToDocument)
    await client.index(SEARCH_INDEX).addDocuments(docs, { primaryKey: 'id' })

    indexed += products.length
    offset += BATCH
    console.log(`[bulk-index] indexed ${indexed} products so far…`)
  }

  console.log(`[bulk-index] done — ${indexed} products indexed.`)
}
