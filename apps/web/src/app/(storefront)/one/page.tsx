'use client'

import { MockupNav } from '@/components/mockup-nav'
import { useState } from 'react'

const brands = [
  { name: 'HP', color: '#1D4ED8', ghost: 'HP', sub: 'Ink & Toner' },
  { name: 'Canon', color: '#DC2626', ghost: 'C', sub: 'Ink & Toner' },
  { name: 'Epson', color: '#0EA5E9', ghost: 'E', sub: 'EcoTank & more' },
  { name: 'Brother', color: '#4338CA', ghost: 'B', sub: 'Laser Toner' },
  { name: 'Samsung', color: '#0369A1', ghost: 'S', sub: 'Laser Toner' },
  { name: 'Pantum', color: '#059669', ghost: 'P', sub: 'Laser Toner' },
  { name: 'Kyocera', color: '#B45309', ghost: 'K', sub: 'Toner' },
  { name: 'Ricoh', color: '#7C3AED', ghost: 'R', sub: 'Toner' },
  { name: 'Lexmark', color: '#0F766E', ghost: 'L', sub: 'Ink & Toner' },
  { name: 'Xerox', color: '#374151', ghost: 'X', sub: 'Toner' },
  { name: 'OKI', color: '#9D174D', ghost: 'O', sub: 'Toner' },
  { name: 'Konica', color: '#1E3A8A', ghost: 'KM', sub: 'Toner' },
]

const popular = [
  { name: 'HP 678 Black', sku: 'CZ107AA', price: 'R 299', color: '#1D4ED8' },
  { name: 'Canon 737 Toner', sku: 'CRG-737', price: 'R 300', color: '#DC2626' },
  { name: 'HP 106A Toner', sku: 'W1106A', price: 'R 330', color: '#1D4ED8' },
  { name: 'Brother TN-2455', sku: 'TN2455', price: 'R 330', color: '#4338CA' },
]

const suggestions = ['HP DeskJet 2722', 'Canon PIXMA MG2540', 'Epson L3150', 'Brother HL-L2321D', 'Samsung M2020']

export default function PocOnePage() {
  const [query, setQuery] = useState('')

  return (
    <div className="min-h-screen bg-[#F2F1EC] p-3 pb-24 font-sans">
      <div
        className="grid grid-cols-2 lg:grid-cols-6 gap-3 max-w-[1440px] mx-auto"
        style={{ gridTemplateRows: 'repeat(4, minmax(9.5rem, auto))' }}
      >

        {/* Logo */}
        <div className="bg-[#0D9488] rounded-3xl p-6 flex flex-col justify-between">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-base leading-none">T</span>
          </div>
          <div>
            <div className="text-white font-black text-2xl leading-none tracking-tight">TSE</div>
            <div className="text-teal-200 text-xs font-medium mt-0.5">Est. 1987</div>
          </div>
        </div>

        {/* Compatibility finder — dominant tile */}
        <div className="col-span-1 lg:col-span-4 bg-white rounded-3xl p-6 flex flex-col justify-center gap-3">
          <div>
            <p className="text-[11px] font-black text-[#0D9488] uppercase tracking-widest mb-1">Find a cartridge for your printer</p>
            <p className="text-xs text-gray-400">Every generic guaranteed to work as good, or better, than the original.</p>
          </div>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter printer model or cartridge number..."
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-32 py-4 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0D9488] text-white rounded-xl px-4 py-2.5 text-sm font-black cursor-pointer hover:bg-[#0f766e] transition-colors">
              Find It
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setQuery(s)} className="text-[11px] bg-gray-50 hover:bg-teal-50 border border-gray-100 hover:border-[#0D9488]/30 text-gray-500 hover:text-[#0D9488] px-3 py-1 rounded-full cursor-pointer transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-[#111827] rounded-3xl p-6 flex flex-col justify-between cursor-pointer hover:bg-[#1a2535] transition-colors">
          <div className="relative w-fit">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="absolute -top-1 -right-1 bg-[#0D9488] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">3</span>
          </div>
          <div>
            <div className="text-white font-black text-base">Cart</div>
            <div className="text-gray-500 text-xs">R 867.00</div>
          </div>
        </div>

        {/* Guarantee — 2 cols × 3 rows */}
        <div className="col-span-2 lg:row-span-3 bg-[#080808] rounded-3xl p-8 flex flex-col justify-between min-h-[28rem] lg:min-h-0">
          <span className="text-[11px] font-black text-[#0D9488] uppercase tracking-widest">Our Guarantee</span>

          <div>
            <div
              className="font-black text-white leading-none tracking-tight mb-6"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}
            >
              Works as good,<br />
              <span className="text-[#0D9488]">or better</span><br />
              than the original.
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Every generic cartridge we stock is quality-tested and backed by our replacement warranty. If it doesn&apos;t perform, we make it right.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: '↩', label: 'Replacement warranty on all products' },
              { icon: '✓', label: 'Quality-tested imported inks' },
              { icon: '◎', label: 'Supplying South Africa since 1987' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#0D9488]/10 border border-[#0D9488]/20 text-[#0D9488] text-sm flex items-center justify-center shrink-0 font-bold">{t.icon}</span>
                <span className="text-gray-400 text-xs">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Brand tiles — 4 across */}
        {brands.slice(0, 4).map((b) => (
          <div key={b.name} className="rounded-3xl p-5 overflow-hidden relative cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between" style={{ backgroundColor: b.color }}>
            <span className="text-white/90 font-bold text-sm relative z-10">{b.name}</span>
            <div className="relative z-10">
              <div className="text-white font-black text-sm leading-tight">Generic</div>
              <div className="text-white/60 text-xs">{b.sub}</div>
            </div>
            <span className="absolute -bottom-4 -right-2 font-black text-white/[0.07] leading-none select-none pointer-events-none" style={{ fontSize: '5rem' }}>{b.ghost}</span>
          </div>
        ))}

        {/* Popular products — 4 cards */}
        {popular.map((p) => (
          <div key={p.sku} className="bg-white rounded-3xl p-5 flex flex-col justify-between cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            <div>
              <div className="w-8 h-8 rounded-lg mb-3" style={{ backgroundColor: p.color + '20' }}>
                <div className="w-full h-full rounded-lg flex items-center justify-center">
                  <div className="w-2 h-3 rounded-sm" style={{ backgroundColor: p.color + '80' }} />
                </div>
              </div>
              <div className="text-sm font-bold text-gray-900 leading-snug">{p.name}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{p.sku} · Generic</div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-lg font-black text-gray-900">{p.price}</span>
              <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs font-black px-3 py-1.5 rounded-xl cursor-pointer transition-colors">
                Add
              </button>
            </div>
          </div>
        ))}

        {/* Delivery */}
        <div className="bg-[#FEFCE8] rounded-3xl p-5 flex flex-col justify-between">
          <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M13 16H4M13 16l2.5-7H20l1 7h-8z" />
            </svg>
          </div>
          <div>
            <div className="text-amber-900 font-black text-sm leading-tight">Next day delivery</div>
            <div className="text-amber-600 text-xs mt-0.5">JHB/PTA — order before noon</div>
          </div>
        </div>

        {/* More brands strip — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 flex flex-col justify-between">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Also available</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {brands.slice(4).map((b) => (
              <button key={b.name} className="text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer hover:scale-105 transition-transform" style={{ borderColor: b.color + '40', color: b.color, backgroundColor: b.color + '10' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>

      </div>
      <MockupNav />
    </div>
  )
}
