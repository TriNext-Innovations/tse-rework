import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { upsertDocument, deleteDocument } from '../lib/search'

const PRODUCT_RELATIONS = ['images', 'categories', 'variants', 'variants.prices']

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

  const productService = container.resolve(Modules.PRODUCT) as any
  try {
    const product = await productService.retrieveProduct(id, {
      relations: PRODUCT_RELATIONS,
    })
    await upsertDocument(product)
    console.log(`[search-sync] indexed "${product.title}" (${id})`)
  } catch (err: any) {
    console.error(`[search-sync] failed to index ${id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: ['product.created', 'product.updated', 'product.deleted'],
}
