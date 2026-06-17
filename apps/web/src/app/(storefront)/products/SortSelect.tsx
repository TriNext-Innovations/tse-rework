'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

const OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'name-desc', label: 'Name: Z–A' },
]

export function SortSelect({ className = '' }: { className?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const value = params.get('sort') ?? 'featured'

  function onChange(v: string) {
    const next = new URLSearchParams(params.toString())
    if (v && v !== 'featured') next.set('sort', v)
    else next.delete('sort')
    next.delete('page')
    startTransition(() => router.push(`/products?${next.toString()}`))
  }

  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="text-[#6B6B66] whitespace-nowrap">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-black/15 bg-white pl-3 pr-8 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#111827] cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[right_0.6rem_center] bg-no-repeat"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
