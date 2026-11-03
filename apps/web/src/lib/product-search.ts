'use client'

import { useEffect, useRef, useState } from 'react'
import { Meilisearch } from 'meilisearch'
import * as Sentry from '@sentry/nextjs'

const HOST = process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? ''
const KEY = process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY ?? ''
const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'

export const PRODUCT_INDEX = 'products'

// A no-results report is only worth sending once the shopper has typed enough
// to mean something — the backend rejects anything shorter anyway.
export const MIN_REPORTABLE_QUERY = 3

export type ProductHit = {
  id: string
  title: string
  handle: string
  sku: string | null
  brand: string | null
  cartridge_type: string | null
  price_zar: number | null
  image_url: string | null
  categories: string[]
}

export function isSearchConfigured(): boolean {
  return Boolean(HOST && KEY)
}

export function getSearchClient(): Meilisearch | null {
  if (!isSearchConfigured()) return null
  return new Meilisearch({ host: HOST, apiKey: KEY })
}

/** Tell the backend a shopper searched for something we don't carry. */
export function reportNoResults(query: string): void {
  const trimmed = query.trim()
  if (trimmed.length < MIN_REPORTABLE_QUERY) return
  fetch(`${BACKEND}/store/search/no-results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: trimmed }),
  }).catch(() => null)
}

export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/**
 * Query the shared `products` index.
 *
 * Every product search on the site goes through here — the header modal and the
 * printer finder both use it — so relevance behaviour cannot drift between
 * entry points. A search failure is reported to Sentry rather than rendering as
 * an empty state, or a Meilisearch outage hides behind "no results".
 */
export function useProductSearch(
  query: string,
  { limit = 6, debounceMs = 150 }: { limit?: number; debounceMs?: number } = {},
): { hits: ProductHit[]; loading: boolean; failed: boolean; configured: boolean } {
  const [hits, setHits] = useState<ProductHit[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const debounced = useDebounce(query, debounceMs)
  const client = useRef<Meilisearch | null>(null)
  if (client.current === null) client.current = getSearchClient()

  useEffect(() => {
    const trimmed = debounced.trim()
    if (!trimmed) {
      setHits([])
      setFailed(false)
      return
    }
    if (!client.current) return

    let cancelled = false
    setLoading(true)
    client.current
      .index(PRODUCT_INDEX)
      .search<ProductHit>(trimmed, { limit })
      .then((r) => {
        if (cancelled) return
        setHits(r.hits)
        setFailed(false)
        if (r.hits.length === 0) reportNoResults(trimmed)
      })
      .catch((err) => {
        if (cancelled) return
        Sentry.captureException(err, {
          tags: { feature: 'search' },
          extra: { query: trimmed },
        })
        setHits([])
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [debounced, limit])

  return { hits, loading, failed, configured: isSearchConfigured() }
}
