'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Category = {
  id: string
  name: string
  parent_category: { name: string } | null
}

const TYPE_CATEGORIES = new Set(['Inkjet Cartridges', 'Laser Cartridges'])
const TYPES = [
  { key: 'inkjet', label: 'Inkjet', parent: 'Inkjet Cartridges' },
  { key: 'laser', label: 'Laser', parent: 'Laser Cartridges' },
] as const

export function FilterPanel({ categories, onNavigate }: { categories: Category[]; onNavigate?: () => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const activeType = params.get('type') ?? ''
  const activeBrand = params.get('brand') ?? ''

  // Brand categories grouped by name, with the set of parent type names each
  // brand appears under — so we can show only the relevant brands per type.
  const brandParents = new Map<string, Set<string>>()
  for (const c of categories) {
    if (TYPE_CATEGORIES.has(c.name)) continue
    const set = brandParents.get(c.name) ?? new Set<string>()
    if (c.parent_category?.name) set.add(c.parent_category.name)
    brandParents.set(c.name, set)
  }

  const typeParent = TYPES.find((t) => t.key === activeType)?.parent
  const brands = [...brandParents.entries()]
    .filter(([, parents]) => !typeParent || parents.has(typeParent))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b))

  function update(next: URLSearchParams) {
    next.delete('page')
    next.delete('category') // legacy nav links — superseded by type/brand
    startTransition(() => {
      router.push(`/products?${next.toString()}`)
      onNavigate?.()
    })
  }

  function setType(type: string) {
    const next = new URLSearchParams(params.toString())
    if (type) next.set('type', type)
    else next.delete('type')
    // Drop a brand that isn't offered under the new type.
    const brand = next.get('brand')
    const parent = TYPES.find((t) => t.key === type)?.parent
    if (brand && parent && !(brandParents.get(brand)?.has(parent))) next.delete('brand')
    update(next)
  }

  function setBrand(brand: string) {
    const next = new URLSearchParams(params.toString())
    if (brand && brand !== activeBrand) next.set('brand', brand)
    else next.delete('brand')
    update(next)
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString())
    next.delete('type')
    next.delete('brand')
    update(next)
  }

  const pill =
    'text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors duration-200 cursor-pointer text-left'
  const active = 'bg-[#111827] text-white border-[#111827]'
  const inactive = 'border-black/15 text-[#374151] hover:border-black/40 hover:text-[#111827]'

  return (
    <div className={`transition-opacity duration-200 ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="mb-5">
        <button
          onClick={clearAll}
          className={`${pill} w-full ${!activeType && !activeBrand ? active : inactive}`}
        >
          All products
        </button>
      </div>

      <div className="text-[9px] uppercase tracking-[0.22em] text-[#6B6B66] mb-2 px-1">Type</div>
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(activeType === t.key ? '' : t.key)}
            className={`${pill} ${activeType === t.key ? active : inactive}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-[9px] uppercase tracking-[0.22em] text-[#6B6B66] mb-2 px-1">Brand</div>
      <div className="flex flex-col gap-1">
        {brands.map((name) => (
          <button
            key={name}
            onClick={() => setBrand(name)}
            className={`${pill} ${activeBrand === name ? active : inactive}`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
