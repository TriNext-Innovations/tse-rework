'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { MeiliSearch } from 'meilisearch'

const HOST = process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? ''
const KEY = process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY ?? ''
const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const INDEX = 'products'

type Hit = {
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

function getClient(): MeiliSearch | null {
  if (!HOST || !KEY) return null
  return new MeiliSearch({ host: HOST, apiKey: KEY })
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const debouncedQuery = useDebounce(query, 150)
  const client = useRef(getClient())

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setHits([])
      setCursor(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search on query change
  useEffect(() => {
    if (!debouncedQuery.trim()) { setHits([]); return }
    if (!client.current) return

    setLoading(true)
    client.current
      .index(INDEX)
      .search<Hit>(debouncedQuery, { limit: 6 })
      .then((r) => {
        setHits(r.hits)
        setCursor(-1)
        if (r.hits.length === 0 && debouncedQuery.trim().length >= 3) {
          fetch(`${BACKEND}/store/search/no-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: debouncedQuery.trim() }),
          }).catch(() => null)
        }
      })
      .catch(() => setHits([]))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function navigate(handle: string) {
    router.push(`/products/${handle}`)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, -1))
    } else if (e.key === 'Enter' && cursor >= 0 && hits[cursor]) {
      navigate(hits[cursor].handle)
    }
  }

  if (!open) return null

  const configured = Boolean(HOST && KEY)

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true" aria-label="Search">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-[24px] shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/8">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cartridges, brands, SKUs…"
            className="flex-1 bg-transparent text-[#111827] placeholder:text-[#9ca3af] text-base outline-none"
            autoComplete="off"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-black/15 border-t-[#111827] rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd
            onClick={onClose}
            className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium text-[#9ca3af] bg-black/5 px-1.5 py-0.5 rounded cursor-pointer"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!configured && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[#6B6B66]">Search not configured yet.</p>
              <button
                onClick={() => { router.push('/products'); onClose() }}
                className="mt-3 text-sm underline underline-offset-4 hover:text-[#111827] transition-colors cursor-pointer"
              >
                Browse all cartridges →
              </button>
            </div>
          )}

          {configured && !query.trim() && (
            <div className="px-5 py-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#9ca3af] mb-3">Quick links</div>
              <div className="flex flex-wrap gap-2">
                {['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Lexmark'].map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setQuery(brand)}
                    className="text-xs px-3 py-1.5 border border-black/10 rounded-full hover:border-[#41e0f5] hover:text-[#41e0f5] transition-colors cursor-pointer"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {configured && query.trim() && !loading && hits.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[#6B6B66]">No results for &ldquo;{query}&rdquo;</p>
              <button
                onClick={() => { router.push(`/products?q=${encodeURIComponent(query)}`); onClose() }}
                className="mt-3 text-sm underline underline-offset-4 hover:text-[#111827] transition-colors cursor-pointer"
              >
                Browse all cartridges →
              </button>
            </div>
          )}

          {hits.length > 0 && (
            <ul>
              {hits.map((hit, i) => {
                const active = cursor === i
                const typeLabel = hit.cartridge_type === 'inkjet' ? 'Inkjet' : hit.cartridge_type === 'laser' ? 'Laser' : null
                return (
                  <li key={hit.id}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => navigate(hit.handle)}
                      className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors cursor-pointer ${active ? 'bg-[#F5F4F0]' : 'hover:bg-[#F5F4F0]'}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-14 flex-shrink-0 rounded-[8px] overflow-hidden bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] flex items-center justify-center">
                        {hit.image_url ? (
                          <Image
                            src={hit.image_url}
                            alt={hit.title}
                            width={40}
                            height={56}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-white/40 text-[8px] font-light" style={{ fontFamily: 'var(--font-fraunces, serif)' }}>TSE</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#111827] truncate">{hit.title}</div>
                        <div className="text-[11px] text-[#9ca3af] mt-0.5">
                          {hit.sku && <span>SKU {hit.sku}</span>}
                          {hit.brand && hit.sku && <span className="mx-1.5">·</span>}
                          {hit.brand && <span>{hit.brand}</span>}
                        </div>
                      </div>

                      {/* Price + type */}
                      <div className="flex-shrink-0 text-right">
                        {hit.price_zar ? (
                          <div className="text-sm font-medium" style={{ fontFamily: 'var(--font-fraunces, serif)' }}>
                            R{hit.price_zar}
                          </div>
                        ) : (
                          <div className="text-xs text-[#9ca3af]">POA</div>
                        )}
                        {typeLabel && (
                          <div className="text-[10px] text-[#6B6B66] mt-0.5">{typeLabel}</div>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {hits.length > 0 && (
          <div className="border-t border-black/8 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-[#9ca3af]">
              <span className="flex items-center gap-1">
                <kbd className="bg-black/5 px-1 py-0.5 rounded text-[9px]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-black/5 px-1 py-0.5 rounded text-[9px]">↵</kbd>
                Open
              </span>
            </div>
            <button
              onClick={() => { router.push(`/products?q=${encodeURIComponent(query)}`); onClose() }}
              className="text-[11px] text-[#6B6B66] hover:text-[#111827] transition-colors cursor-pointer"
            >
              View all results →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
