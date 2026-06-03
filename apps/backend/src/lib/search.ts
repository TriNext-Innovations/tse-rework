import { MeiliSearch } from 'meilisearch'

export const SEARCH_INDEX = 'products'

const TYPE_CATEGORIES = new Set(['Inkjet Cartridges', 'Laser Cartridges'])

export type SearchDocument = {
  id: string
  title: string
  handle: string
  description: string | null
  sku: string | null
  brand: string | null
  cartridge_type: string | null
  price_zar: number | null
  image_url: string | null
  categories: string[]
}

export function getSearchClient(): MeiliSearch {
  return new MeiliSearch({
    host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY ?? '',
  })
}

export function productToDocument(product: any): SearchDocument {
  const variant = product.variants?.[0]
  const zarPrice = variant?.prices?.find((p: any) =>
    p.currency_code?.toLowerCase() === 'zar',
  ) ?? variant?.prices?.[0]

  const categories: string[] = (product.categories ?? []).map((c: any) => c.name as string)
  const brand = categories.find((c) => !TYPE_CATEGORIES.has(c)) ?? null
  const cartridge_type: string | null = product.metadata?.cartridge_type ?? null

  return {
    id: product.id,
    title: product.title ?? '',
    handle: product.handle ?? '',
    description: product.description ?? null,
    sku: variant?.sku ?? null,
    brand,
    cartridge_type,
    price_zar: zarPrice?.amount != null ? Math.round(zarPrice.amount / 100) : null,
    image_url: product.images?.[0]?.url ?? null,
    categories,
  }
}

export async function configureIndex(client: MeiliSearch): Promise<void> {
  const index = client.index(SEARCH_INDEX)
  await index.updateSearchableAttributes(['title', 'sku', 'brand', 'categories', 'description'])
  await index.updateFilterableAttributes(['brand', 'cartridge_type'])
  await index.updateSortableAttributes(['price_zar'])
  await index.updateRankingRules([
    'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
  ])
}

export async function upsertDocument(product: any): Promise<void> {
  const client = getSearchClient()
  const doc = productToDocument(product)
  await client.index(SEARCH_INDEX).addDocuments([doc], { primaryKey: 'id' })
}

export async function deleteDocument(id: string): Promise<void> {
  const client = getSearchClient()
  await client.index(SEARCH_INDEX).deleteDocument(id)
}
