import { MockupNav } from '@/components/mockup-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'POC 3 — Commercial' }

const categories = [
  { name: 'HP', sub: 'Ink & Toner', count: '2,400+', from: '#DBEAFE', to: '#EFF6FF', accent: '#1D4ED8', text: '#1E3A8A' },
  { name: 'Canon', sub: 'Ink & Toner', count: '1,800+', from: '#FFE4E6', to: '#FFF1F2', accent: '#DC2626', text: '#991B1B' },
  { name: 'Epson', sub: 'EcoTank & more', count: '1,200+', from: '#E0F2FE', to: '#F0F9FF', accent: '#0EA5E9', text: '#0369A1' },
  { name: 'Brother', sub: 'Laser Toner', count: '900+', from: '#EDE9FE', to: '#F5F3FF', accent: '#7C3AED', text: '#5B21B6' },
]

const featured = [
  { name: 'HP 678 Black Ink', sku: 'CZ107AA', price: 'R 299', was: null, badge: 'Best Seller', from: '#DBEAFE', to: '#EFF6FF', dot: '#1D4ED8' },
  { name: 'Canon 737 Black Toner', sku: 'CRG-737', price: 'R 300', was: null, badge: 'Generic', from: '#FFE4E6', to: '#FFF1F2', dot: '#DC2626' },
  { name: 'Epson T6641 Black Bottle', sku: 'C13T664100', price: 'R 310', was: null, badge: 'Generic', from: '#E0F2FE', to: '#F0F9FF', dot: '#0EA5E9' },
  { name: 'Brother TN-2455 Toner', sku: 'TN2455', price: 'R 330', was: null, badge: 'Generic', from: '#EDE9FE', to: '#F5F3FF', dot: '#7C3AED' },
  { name: 'HP 106A Black Toner', sku: 'W1106A', price: 'R 330', was: null, badge: 'Generic', from: '#DCFCE7', to: '#F0FDF4', dot: '#16A34A' },
  { name: 'Samsung MLT-D111S', sku: 'MLT-D111S', price: 'R 315', was: null, badge: 'Generic', from: '#FEF9C3', to: '#FEFCE8', dot: '#CA8A04' },
  { name: 'Pantum PC-211EV Toner', sku: 'PC-211EV', price: 'R 305', was: null, badge: 'New', from: '#F0FDF4', to: '#DCFCE7', dot: '#059669' },
  { name: 'Kyocera TK-1175 Toner', sku: 'TK-1175', price: 'R 320', was: null, badge: 'Generic', from: '#FDF4FF', to: '#FAE8FF', dot: '#9333EA' },
]

export default function PocThreePage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            <a href="/" className="flex items-center gap-2 cursor-pointer shrink-0">
              <div className="w-8 h-8 bg-[#0D9488] rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">T</span>
              </div>
              <span className="font-black text-gray-900 text-lg tracking-tight">TSE Online</span>
            </a>
            <div className="flex-1 max-w-xl hidden sm:block">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search cartridges, printers, brands..." className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488]" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 cursor-pointer transition-colors font-medium">Sign in</button>
              <button className="relative cursor-pointer text-gray-600 hover:text-[#0D9488] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="absolute -top-1.5 -right-1.5 bg-[#0D9488] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">3</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Promo bar */}
      <div className="bg-[#0D9488] text-white text-xs font-semibold text-center py-2.5 tracking-wide">
        Quality generics — guaranteed as good or better than original &nbsp;·&nbsp; Order before noon → next day JHB/PTA &nbsp;·&nbsp; Est. 1992
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2744 50%, #0D3D38 100%)', minHeight: 480 }}>
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20" style={{ background: 'radial-gradient(ellipse, #0D9488, transparent)' }} />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-16 flex flex-col lg:flex-row items-center gap-12">
          {/* Copy */}
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block bg-[#0D9488]/20 border border-[#0D9488]/30 text-teal-300 text-xs font-bold px-3 py-1 rounded-full mb-5 uppercase tracking-widest">
              Quality Generics · Supplying SA since 1992
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-none tracking-tight mb-4">
              Quality generics.<br />
              <span className="text-[#0D9488]">Competitive prices.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto lg:mx-0">
              Generic cartridges guaranteed to work as good — or better — than the original. Every major brand. Kya Sands, JHB. Nationwide courier delivery.
            </p>
            <div className="flex gap-3 justify-center lg:justify-start">
              <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black px-7 py-4 rounded-2xl cursor-pointer transition-colors text-base">
                Shop All Products
              </button>
              <button className="bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold px-7 py-4 rounded-2xl cursor-pointer transition-colors text-base">
                Find My Cartridge
              </button>
            </div>
            <div className="flex items-center gap-6 mt-8 justify-center lg:justify-start">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                18,000+ customers
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                4.8 / 5 rating
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Est. 1992
              </div>
            </div>
          </div>

          {/* Hero product art */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80">
              {/* Floating cartridge cluster */}
              {[
                { color: '#1D4ED8', x: '15%', y: '10%', size: 52, h: 76, rot: '-8deg', z: 10 },
                { color: '#DC2626', x: '55%', y: '5%', size: 40, h: 60, rot: '6deg', z: 9 },
                { color: '#0D9488', x: '35%', y: '25%', size: 60, h: 88, rot: '0deg', z: 20 },
                { color: '#7C3AED', x: '10%', y: '52%', size: 38, h: 56, rot: '-5deg', z: 8 },
                { color: '#0EA5E9', x: '60%', y: '48%', size: 44, h: 64, rot: '8deg', z: 11 },
              ].map((c, i) => (
                <div
                  key={i}
                  className="absolute rounded-2xl shadow-2xl flex flex-col items-center justify-between py-3 px-2.5"
                  style={{
                    left: c.x, top: c.y,
                    width: c.size, height: c.h,
                    background: 'linear-gradient(160deg, #1a1a2e, #0a0a18)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transform: `rotate(${c.rot})`,
                    zIndex: c.z,
                    boxShadow: `0 20px 60px ${c.color}30`,
                  }}
                >
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: c.color, opacity: 0.9 }} />
                  <div className="w-full h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                </div>
              ))}
              {/* Glow under cluster */}
              <div className="absolute inset-0 rounded-full opacity-30" style={{ background: 'radial-gradient(ellipse at center, #0D948870, transparent 70%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Compatibility finder */}
      <section className="bg-[#F0FDF9] border-b border-teal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row items-center gap-8">
          <div className="shrink-0 max-w-xs">
            <p className="text-[11px] font-black text-[#0D9488] uppercase tracking-widest mb-2">Not sure which cartridge fits?</p>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">Find the right generic for your printer</h2>
            <p className="text-sm text-gray-500 mt-2">Every result guaranteed to work as good, or better, than the original.</p>
          </div>
          <div className="flex-1 w-full">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="e.g. HP DeskJet 2722 or HP 678..."
                  className="w-full bg-white border border-teal-200 focus:border-[#0D9488] rounded-2xl pl-12 pr-4 py-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
              <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black px-6 py-4 rounded-2xl cursor-pointer transition-colors text-sm shrink-0">
                Find It
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {['HP DeskJet 2722', 'Canon PIXMA MG2540', 'Epson L3150', 'Brother HL-L2321D', 'Samsung M2020'].map((q) => (
                <button key={q} className="text-xs bg-white border border-teal-100 hover:border-[#0D9488]/40 text-gray-500 hover:text-[#0D9488] px-3 py-1.5 rounded-full cursor-pointer transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Shop by brand */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex items-baseline justify-between mb-7">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Shop by brand</h2>
          <a href="#" className="text-sm text-[#0D9488] hover:text-[#0f766e] cursor-pointer font-semibold">All brands →</a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="rounded-3xl overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ background: `linear-gradient(145deg, ${cat.from}, ${cat.to})` }}
            >
              {/* Image zone */}
              <div className="h-36 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 60% 50%, ${cat.accent}, transparent 65%)` }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-14 h-20 rounded-xl shadow-xl flex flex-col items-center justify-between py-2.5 px-2 group-hover:scale-105 transition-transform duration-300"
                    style={{ background: 'linear-gradient(180deg, #1a1a2e, #0d0d1a)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: cat.accent }} />
                    <span className="text-white/30 text-[8px] font-mono uppercase tracking-widest">CART.</span>
                    <div className="w-full h-1 rounded-full bg-white/5" />
                  </div>
                </div>
                <div
                  className="absolute bottom-3 right-3 text-5xl font-black leading-none opacity-[0.08] select-none"
                  style={{ color: cat.accent }}
                >
                  {cat.name[0]}
                </div>
              </div>
              {/* Info */}
              <div className="px-5 py-4">
                <div className="font-black text-lg tracking-tight" style={{ color: cat.text }}>{cat.name}</div>
                <div className="text-xs mt-0.5 opacity-70" style={{ color: cat.text }}>{cat.sub}</div>
                <div className="text-xs font-semibold mt-2 opacity-60" style={{ color: cat.text }}>{cat.count} products</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deal spotlight — full-width split */}
      <section className="bg-[#F8FAF9] border-t border-b border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-12">
          {/* Product art — large */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(145deg, #DBEAFE, #EFF6FF)' }}>
              <div className="w-full h-full flex items-center justify-center relative">
                <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 55% 45%, #1D4ED8, transparent 60%)' }} />
                <div className="relative flex flex-col items-center gap-4">
                  {/* Cartridge stack */}
                  {[{ w: 72, h: 104, off: 0 }, { w: 60, h: 88, off: -56 }, { w: 64, h: 96, off: 52 }].map((s, i) => (
                    <div
                      key={i}
                      className="absolute rounded-2xl shadow-xl flex flex-col items-center justify-between py-3 px-3"
                      style={{
                        width: s.w, height: s.h,
                        left: `calc(50% + ${s.off}px - ${s.w / 2}px)`,
                        top: `calc(50% - ${s.h / 2}px)`,
                        background: 'linear-gradient(160deg, #1a1a2e, #0a0a18)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: i === 0 ? 10 : 5,
                        boxShadow: '0 24px 48px rgba(29,78,216,0.25)',
                      }}
                    >
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#1D4ED8', opacity: i === 0 ? 1 : 0.5 }} />
                      <div className="text-center">
                        <div className="text-white/20 text-[7px] font-mono uppercase tracking-widest">HP 678</div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Deal details */}
          <div className="flex-1 max-w-lg">
            <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-black px-3 py-1.5 rounded-full mb-5 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Deal of the day — ends midnight
            </span>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight mb-3">
              HP 678 Combo Pack<br />
              <span className="text-[#0D9488]">Black + Colour</span>
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Quality generic cartridges for HP DeskJet 1115, 2135, 3635, 3775, 3776, 3777, 3787, 3788, 3790. Guaranteed to work as good or better than the original. Get black and colour together.
            </p>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-5xl font-black text-gray-900">R 449</span>
              <span className="text-xl text-gray-400 line-through">R 549</span>
              <span className="bg-green-100 text-green-700 text-sm font-black px-2.5 py-1 rounded-xl">Save R100</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black px-8 py-4 rounded-2xl cursor-pointer transition-colors text-base flex-1 sm:flex-none">
                Add to Cart
              </button>
              <button className="border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold px-8 py-4 rounded-2xl cursor-pointer transition-colors text-base">
                View details
              </button>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              In stock · Ships today from Johannesburg
            </div>
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 pb-28">
        <div className="flex items-baseline justify-between mb-7">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Popular products</h2>
          <a href="#" className="text-sm text-[#0D9488] hover:text-[#0f766e] cursor-pointer font-semibold">View all →</a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map((p) => (
            <div key={p.sku} className="bg-white border border-gray-100 rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl hover:border-gray-200 transition-all duration-300 hover:-translate-y-1 group flex flex-col">
              {/* Image zone */}
              <div className="h-44 relative overflow-hidden" style={{ background: `linear-gradient(145deg, ${p.from}, ${p.to})` }}>
                {p.badge && (
                  <span className={`absolute top-3 left-3 z-10 text-[10px] font-black px-2.5 py-1 rounded-full ${
                    p.badge === 'Sale' ? 'bg-red-500 text-white' :
                    p.badge === 'New' ? 'bg-blue-500 text-white' :
                    p.badge === 'Bundle' ? 'bg-purple-500 text-white' :
                    'bg-white text-gray-700 shadow-sm'
                  }`}>
                    {p.badge}
                  </span>
                )}
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 60% 40%, ${p.dot}, transparent 65%)` }} />
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="w-12 h-16 rounded-xl shadow-xl flex flex-col items-center justify-between py-2 px-2 group-hover:scale-110 transition-transform duration-300"
                    style={{ background: 'linear-gradient(160deg, #1a1a2e, #0a0a18)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 16px 40px ${p.dot}35` }}
                  >
                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
                    <div className="w-full h-1 rounded-full bg-white/5" />
                  </div>
                </div>
              </div>
              {/* Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1 line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-gray-400">SKU: {p.sku}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-lg font-black text-gray-900">{p.price}</span>
                    {p.was && <span className="text-xs text-gray-400 line-through ml-1.5">{p.was}</span>}
                  </div>
                  <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs font-black px-3.5 py-2 rounded-xl cursor-pointer transition-colors">
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <MockupNav />
    </div>
  )
}
