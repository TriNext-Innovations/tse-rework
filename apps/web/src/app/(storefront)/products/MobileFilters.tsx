'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FilterPanel } from './FilterPanel'
import { SortSelect } from './SortSelect'

type Category = { id: string; name: string; parent_category: { name: string } | null }

export function MobileFilters({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const params = useSearchParams()
  const activeCount =
    (params.get('type') ? 1 : 0) +
    (params.get('brand') ? 1 : 0) +
    (params.get('sort') && params.get('sort') !== 'featured' ? 1 : 0)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-[#111827] cursor-pointer"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filters &amp; sort
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#111827] text-white text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-[80] overflow-hidden transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div
          className={`absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-[#F5F4F0] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${open ? 'translate-x-0' : '-translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Filter and sort"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
            <span className="font-display text-lg">Filter &amp; sort</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="text-[9px] uppercase tracking-[0.22em] text-[#6B6B66] mb-2 px-1">Sort by</div>
            <SortSelect className="mb-6 w-full [&>select]:flex-1" />
            <FilterPanel categories={categories} />
          </div>

          <div className="px-5 py-4 border-t border-black/8">
            <button
              onClick={() => setOpen(false)}
              className="w-full bg-[#111827] text-white rounded-full py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors cursor-pointer"
            >
              Show results
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
