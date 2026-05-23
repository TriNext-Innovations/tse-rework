'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef, useEffect } from 'react'

const POPULAR_MODELS = [
  'HP LaserJet 1020', 'HP DeskJet 2700', 'HP OfficeJet 4650', 'HP LaserJet Pro M404',
  'Canon PIXMA G3410', 'Canon PIXMA MG2550', 'Canon i-SENSYS MF3010',
  'Epson EcoTank L3250', 'Epson Expression Home XP-4105',
  'Brother DCP-L2530DW', 'Brother HL-L2350DW', 'Brother MFC-L2710DW',
  'Samsung Xpress M2020', 'Samsung Xpress M2070',
  'Lexmark B2236dw', 'Xerox Phaser 3020',
]

export function CompatSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    const lower = query.toLowerCase()
    setSuggestions(POPULAR_MODELS.filter((m) => m.toLowerCase().includes(lower)).slice(0, 6))
  }, [query])

  const handleSearch = (value: string) => {
    const q = value.trim()
    if (!q) return
    setShowSuggestions(false)
    startTransition(() => {
      router.push(`/compatibility?model=${encodeURIComponent(q)}`)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') handleSearch(query)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0) {
        const selected = suggestions[activeIdx] ?? ''
        setQuery(selected)
        handleSearch(selected)
      } else {
        handleSearch(query)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIdx(-1)
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-3 bg-white rounded-[14px] px-4 py-3 shadow-[0_4px_24px_-8px_rgba(10,10,10,0.15)] border border-black/8">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9ca3af] flex-shrink-0">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSuggestions(true)
            setActiveIdx(-1)
          }}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. HP LaserJet 1020"
          className="flex-1 text-sm outline-none placeholder:text-[#9ca3af] bg-transparent"
          aria-label="Printer model search"
          aria-autocomplete="list"
          aria-controls="compat-suggestions"
          aria-activedescendant={activeIdx >= 0 ? `suggestion-${activeIdx}` : undefined}
        />
        <button
          onClick={() => handleSearch(query)}
          disabled={isPending}
          className="flex-shrink-0 px-4 py-1.5 rounded-[9px] bg-[#111827] text-white text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : 'Search'}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id="compat-suggestions"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[12px] shadow-[0_8px_32px_-8px_rgba(10,10,10,0.2)] border border-black/8 overflow-hidden z-50"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => {
                setQuery(s)
                handleSearch(s)
              }}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${i === activeIdx ? 'bg-[#F5F4F0] text-[#111827]' : 'text-[#374151] hover:bg-[#F5F4F0]'}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
