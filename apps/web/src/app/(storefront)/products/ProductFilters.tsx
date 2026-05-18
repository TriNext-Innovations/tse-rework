'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Category = {
  id: string
  name: string
  parent_category: { name: string } | null
}

export function ProductFilters({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const activeCategory = params.get('category') ?? ''

  const inkjetBrands = categories.filter((c) => c.parent_category?.name === 'Inkjet Cartridges')
  const laserBrands = categories.filter((c) => c.parent_category?.name === 'Laser Cartridges')

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
  const active = 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
  const inactive = 'border-[var(--ink)]/15 text-[var(--ink-2)] hover:border-[var(--ink)]/40 hover:text-[var(--ink)]'

  return (
    <aside className={`transition-opacity duration-200 ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="mb-6">
        <button
          onClick={() => setCategory('')}
          className={`${pill} ${activeCategory === '' ? active : inactive} w-full mb-1`}
        >
          All products
        </button>
      </div>

      <div className="mb-6">
        <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2 px-1">Inkjet</div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setCategory('inkjet')}
            className={`${pill} ${activeCategory === 'inkjet' ? active : inactive}`}
          >
            All Inkjet
          </button>
          {inkjetBrands.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`${pill} ${activeCategory === c.id ? active : inactive}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2 px-1">Laser</div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setCategory('laser')}
            className={`${pill} ${activeCategory === 'laser' ? active : inactive}`}
          >
            All Laser
          </button>
          {laserBrands.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`${pill} ${activeCategory === c.id ? active : inactive}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
