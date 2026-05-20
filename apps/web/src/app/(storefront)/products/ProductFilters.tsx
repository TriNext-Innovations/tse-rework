'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Category = {
  id: string
  name: string
  parent_category: { name: string } | null
}

// Categories that are type-labels, not brands — exclude from brand list
const TYPE_CATEGORIES = new Set(['Inkjet Cartridges', 'Laser Cartridges'])

export function ProductFilters({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const activeCategory = params.get('category') ?? ''

  const brands = categories
    .filter((c) => !TYPE_CATEGORIES.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  function setCategory(id: string) {
    startTransition(() => {
      const next = new URLSearchParams(params.toString())
      if (id) next.set('category', id)
      else next.delete('category')
      next.delete('page')
      router.push(`/products?${next.toString()}`)
    })
  }

  const pill =
    'text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors duration-200 cursor-pointer text-left'
  const active = 'bg-[#111827] text-white border-[#111827]'
  const inactive = 'border-black/15 text-[#374151] hover:border-black/40 hover:text-[#111827]'

  return (
    <aside className={`transition-opacity duration-200 ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="mb-4">
        <button
          onClick={() => setCategory('')}
          className={`${pill} ${activeCategory === '' ? active : inactive} w-full`}
        >
          All products
        </button>
      </div>

      <div className="text-[9px] uppercase tracking-[0.22em] text-[#6B6B66] mb-2 px-1">By brand</div>
      <div className="flex flex-col gap-1">
        {brands.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`${pill} ${activeCategory === c.id ? active : inactive}`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </aside>
  )
}
