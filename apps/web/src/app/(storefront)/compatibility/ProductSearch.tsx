'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useProductSearch } from '@/lib/product-search'
import { cartridgeTypeLabel } from '@/lib/taxonomy'

/**
 * Product search for the printer finder.
 *
 * The finder answers "what fits my printer?". This answers "where is the
 * cartridge I already know I want?" — the two live on one page, so the label
 * and placeholder are doing real work: they are what stops a shopper typing a
 * printer model in here and getting nothing.
 */
export function ProductSearch() {
  const [query, setQuery] = useState('')
  const { hits, loading, failed, configured } = useProductSearch(query, { limit: 5 })

  const trimmed = query.trim()
  const showPanel = trimmed.length > 0

  if (!configured) return null

  return (
    <div className="max-w-xl">
      <p className="text-xs text-[var(--muted)] uppercase tracking-[0.16em] mb-3">
        Already know the cartridge?
      </p>

      {/* GET form so this still works without JS */}
      <form action="/products" method="GET" className="relative">
        <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[var(--surface)] border border-[var(--line-2)] focus-within:border-[var(--ink)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cartridges, brands or SKUs…"
            aria-label="Search cartridges by name, brand or SKU"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted-2)] outline-none min-w-0"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-[var(--line-4)] border-t-[var(--ink)] rounded-full animate-spin flex-shrink-0" aria-hidden />
          )}
        </div>

        {showPanel && (
          <div className="mt-2 rounded-[14px] bg-[var(--surface)] border border-[var(--line-2)] overflow-hidden">
            {failed ? (
              <p className="px-4 py-4 text-sm text-[var(--muted)]">
                Search is temporarily unavailable.{' '}
                <Link href="/products" className="underline underline-offset-4 hover:text-[var(--ink)]">
                  Browse all cartridges
                </Link>
              </p>
            ) : hits.length > 0 ? (
              <>
                <ul>
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        href={`/products/${hit.handle}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--hover-1)] transition-colors"
                      >
                        {hit.image_url ? (
                          <Image
                            src={hit.image_url}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain flex-shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-[var(--hover-1)] flex-shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-[var(--ink)] truncate">{hit.title}</span>
                          <span className="block text-[10px] text-[var(--muted-2)] truncate">
                            {[hit.sku && `SKU ${hit.sku}`, hit.cartridge_type && cartridgeTypeLabel(hit.cartridge_type)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/products?q=${encodeURIComponent(trimmed)}`}
                  className="block px-4 py-3 text-xs text-[var(--muted)] border-t border-[var(--line-2)] hover:text-[var(--ink)] transition-colors"
                >
                  See all results for &ldquo;{trimmed}&rdquo; →
                </Link>
              </>
            ) : loading ? (
              <p className="px-4 py-4 text-sm text-[var(--muted)]">Searching…</p>
            ) : (
              <p className="px-4 py-4 text-sm text-[var(--muted)]">
                Nothing matched &ldquo;{trimmed}&rdquo;. Try the printer search above, or{' '}
                <Link href="/products" className="underline underline-offset-4 hover:text-[var(--ink)]">
                  browse all cartridges
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
