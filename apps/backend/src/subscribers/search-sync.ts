import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { upsertDocument, deleteDocument } from '../lib/search'

// Prices are reachable only via the Query graph (module link), not as a
// `variants.prices` relation on the product module — see bulk-index.ts.
const PRODUCT_FIELDS = [
  'id',
  'title',
  'handle',
  'description',
  'metadata',
  'images.url',
  'categories.name',
  'variants.sku',
  'variants.prices.amount',
  'variants.prices.currency_code',
]

export default async function searchSyncHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const id = data.id

  if (name === 'product.deleted') {
    try {
      await deleteDocument(id)
      console.log(`[search-sync] removed ${id} from index`)
    } catch (err: any) {
      console.error(`[search-sync] failed to remove ${id}:`, err.message)
    }
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data: [product] } = await query.graph({
      entity: 'product',
      fields: PRODUCT_FIELDS,
      filters: { id },
    })
    if (!product) {
      console.error(`[search-sync] product ${id} not found`)
      return
    }
    await upsertDocument(product)
    console.log(`[search-sync] indexed "${product.title}" (${id})`)
  } catch (err: any) {
    console.error(`[search-sync] failed to index ${id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: ['product.created', 'product.updated', 'product.deleted'],
}
