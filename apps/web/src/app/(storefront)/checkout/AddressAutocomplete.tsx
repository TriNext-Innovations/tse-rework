'use client'

import { useEffect, useRef, useState } from 'react'

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export type ParsedAddress = {
  line1?: string
  suburb?: string
  city?: string
  province?: string
  postalCode?: string
}

// Load the Google Maps JS bootstrap once and resolve the Places library.
let placesPromise: Promise<any> | null = null
function loadPlaces(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const g = (window as any).google
  if (g?.maps?.importLibrary) return g.maps.importLibrary('places')
  if (!placesPromise) {
    placesPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&v=weekly&loading=async`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('maps failed to load'))
      document.head.appendChild(s)
    }).then(() => (window as any).google.maps.importLibrary('places'))
  }
  return placesPromise
}

function pick(components: any[], ...types: string[]): string | undefined {
  for (const t of types) {
    const c = components.find((x) => x.types?.includes(t))
    if (c?.longText) return c.longText as string
  }
  return undefined
}

function parse(components: any[]): ParsedAddress {
  const streetNo = pick(components, 'street_number')
  const route = pick(components, 'route')
  return {
    line1: [streetNo, route].filter(Boolean).join(' ') || undefined,
    suburb: pick(components, 'sublocality_level_1', 'sublocality', 'neighborhood'),
    city: pick(components, 'locality', 'postal_town', 'administrative_area_level_2'),
    province: pick(components, 'administrative_area_level_1'),
    postalCode: pick(components, 'postal_code'),
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (a: ParsedAddress) => void
  placeholder?: string
  className?: string
  autoComplete?: string
}) {
  const places = useRef<any>(null)
  const token = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!KEY) return
    let active = true
    loadPlaces().then((lib) => { if (active) { places.current = lib; setReady(true) } }).catch(() => {})
    return () => { active = false }
  }, [])

  async function handleInput(v: string) {
    onChange(v)
    setCursor(-1)
    if (!ready || !places.current || v.trim().length < 3) { setSuggestions([]); setOpen(false); return }
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = places.current
      if (!token.current) token.current = new AutocompleteSessionToken()
      const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: v,
        includedRegionCodes: ['za'],
        sessionToken: token.current,
      })
      setSuggestions(res?.suggestions ?? [])
      setOpen(true)
    } catch {
      setSuggestions([])
    }
  }

  async function choose(s: any) {
    try {
      const place = s.placePrediction.toPlace()
      await place.fetchFields({ fields: ['addressComponents'] })
      const parsed = parse(place.addressComponents ?? [])
      if (parsed.line1) onChange(parsed.line1)
      onSelect(parsed)
    } catch {
      /* fall back to whatever the user typed */
    } finally {
      setOpen(false)
      setSuggestions([])
      token.current = null // a selection ends the billing session
    }
  }

  function label(s: any): string {
    return s?.placePrediction?.text?.text ?? ''
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete={autoComplete ?? 'off'}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length) setOpen(true) }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, suggestions.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
          else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); choose(suggestions[cursor]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white rounded-[12px] border border-black/10 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                onClick={() => choose(s)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${cursor === i ? 'bg-[#F5F4F0]' : 'hover:bg-[#F5F4F0]'}`}
              >
                {label(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
