/**
 * Bulk-index all Medusa products into Meilisearch.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/bulk-index.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { getSearchClient, configureIndex, productToDocument, SEARCH_INDEX } from '../lib/search'

const BATCH = 50

export default async function bulkIndex({ container }: { container: MedusaContainer }) {
  const client = getSearchClient()

  console.log('[bulk-index] configuring Meilisearch index settings…')
  await configureIndex(client)

  const productService = container.resolve(Modules.PRODUCT) as any

  let offset = 0
  let indexed = 0

  console.log('[bulk-index] starting product indexing…')

  while (true) {
    const products: any[] = await productService.listProducts(
      { status: ['published'] },
      {
        relations: ['images', 'categories', 'variants', 'variants.prices'],
        skip: offset,
        take: BATCH,
      },
    )

    if (products.length === 0) break

    const docs = products.map(productToDocument)
    await client.index(SEARCH_INDEX).addDocuments(docs, { primaryKey: 'id' })

    indexed += products.length
    offset += BATCH
    console.log(`[bulk-index] indexed ${indexed} products so far…`)
  }

  console.log(`[bulk-index] done — ${indexed} products indexed.`)
}
