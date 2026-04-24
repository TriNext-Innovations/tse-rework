import { MockupNav } from '@/components/mockup-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'POC 3 — Commercial' }

const categories = [
  { name: 'HP', sub: 'Ink & Toner', count: '2,400+', from: '#DBEAFE', to: '#EFF6FF', accent: '#1D4ED8', text: '#1E3A8A', logo: '/hp.png' },
  { name: 'Canon', sub: 'Ink & Toner', count: '1,800+', from: '#FFE4E6', to: '#FFF1F2', accent: '#DC2626', text: '#991B1B', logo: '/canonlogo.png' },
  { name: 'Epson', sub: 'EcoTank & more', count: '1,200+', from: '#E0F2FE', to: '#F0F9FF', accent: '#0EA5E9', text: '#0369A1', logo: '/Epson.png' },
  { name: 'Brother', sub: 'Laser Toner', count: '900+', from: '#EDE9FE', to: '#F5F3FF', accent: '#7C3AED', text: '#5B21B6', logo: '/brotherlogo.png' },
]

const featured = [
  { name: 'HP 678 Black Ink', sku: 'CZ107AA', price: 'R 299', was: null, badge: 'Best Seller', from: '#DBEAFE', to: '#EFF6FF', dot: '#1D4ED8', image: '/HPcart.png' },
  { name: 'Canon 737 Black Toner', sku: 'CRG-737', price: 'R 300', was: null, badge: 'Generic', from: '#FFE4E6', to: '#FFF1F2', dot: '#DC2626', image: '/Canoncart.png' },
  { name: 'Epson T6641 Black Bottle', sku: 'C13T664100', price: 'R 310', was: null, badge: 'Generic', from: '#E0F2FE', to: '#F0F9FF', dot: '#0EA5E9', image: '/Epsonblack.png' },
  { name: 'Brother TN-2455 Toner', sku: 'TN2455', price: 'R 330', was: null, badge: 'Generic', from: '#EDE9FE', to: '#F5F3FF', dot: '#7C3AED', image: '/BrotherTN2455.png' },
  { name: 'HP 106A Black Toner', sku: 'W1106A', price: 'R 330', was: null, badge: 'Generic', from: '#DCFCE7', to: '#F0FDF4', dot: '#16A34A', image: '/HP106A.png' },
  { name: 'Samsung MLT-D111S', sku: 'MLT-D111S', price: 'R 315', was: null, badge: 'Generic', from: '#FEF9C3', to: '#FEFCE8', dot: '#CA8A04', image: '/SamsungMLT.png' },
  { name: 'Pantum PC-211EV Toner', sku: 'PC-211EV', price: 'R 305', was: null, badge: 'New', from: '#F0FDF4', to: '#DCFCE7', dot: '#059669', image: '/Pantum-PC252.png' },
  { name: 'Kyocera TK-1175 Toner', sku: 'TK-1175', price: 'R 320', was: null, badge: 'Generic', from: '#FDF4FF', to: '#FAE8FF', dot: '#9333EA', image: '/TK-3060.png' },
]

export default function PocThreePage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            <a href="/" className="flex items-center cursor-pointer shrink-0">
              <img src="/logo.png" alt="TSE Online" style={{ width: 350, height: 80, objectFit: 'contain', objectPosition: 'left center' }} />
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
            <style>{`
              @keyframes float0 { 0%,100% { transform: rotate(-8deg) translateY(0px); } 50% { transform: rotate(-8deg) translateY(-12px); } }
              @keyframes float1 { 0%,100% { transform: rotate(6deg) translateY(0px); } 50% { transform: rotate(6deg) translateY(-10px); } }
              @keyframes float2 { 0%,100% { transform: rotate(0deg) translateY(0px); } 50% { transform: rotate(0deg) translateY(-14px); } }
              @keyframes float3 { 0%,100% { transform: rotate(-5deg) translateY(0px); } 50% { transform: rotate(-5deg) translateY(-8px); } }
              @keyframes float4 { 0%,100% { transform: rotate(8deg) translateY(0px); } 50% { transform: rotate(8deg) translateY(-11px); } }
            `}</style>
            <div className="relative w-80 h-80 sm:w-96 sm:h-96">
              {[
                { src: '/toner.png',   x: '2%',  y: '2%',  size: 140, z: 10, delay: '0s',    dur: '3.2s' },
                { src: '/m40.png',     x: '57%', y: '4%',  size: 135, z: 9,  delay: '0.6s',  dur: '2.8s' },
                { src: '/Canon.png',   x: '2%', y: '0%', size: 330, z: 20, delay: '0.2s',  dur: '3.6s' },
                { src: '/brother.png', x: '3%',  y: '57%', size: 135, z: 8,  delay: '1.0s',  dur: '3.0s' },
                { src: '/tk52.png',    x: '57%', y: '55%', size: 140, z: 11, delay: '0.4s',  dur: '2.6s' },
              ].map((c, i) => (
                <img
                  key={i}
                  src={c.src}
                  alt=""
                  className="absolute object-contain"
                  style={{
                    left: c.x, top: c.y,
                    width: c.size, height: c.size,
                    zIndex: c.z,
                    animation: `float${i} ${c.dur} ease-in-out ${c.delay} infinite`,
                  }}
                />
              ))}
              <div className="absolute inset-0 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, #0D948870, transparent 70%)' }} />
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
                  {'logo' in cat && cat.logo ? (
                    <img
                      src={cat.logo as string}
                      alt={cat.name}
                      className="w-[104px] h-[104px] object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div
                      className="w-14 h-20 rounded-xl shadow-xl flex flex-col items-center justify-between py-2.5 px-2 group-hover:scale-105 transition-transform duration-300"
                      style={{ background: 'linear-gradient(180deg, #1a1a2e, #0d0d1a)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: cat.accent }} />
                      <span className="text-white/30 text-[8px] font-mono uppercase tracking-widest">CART.</span>
                      <div className="w-full h-1 rounded-full bg-white/5" />
                    </div>
                  )}
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
                {/* Back left — peeking */}
                <img src="/HPcart.png" alt="" className="absolute object-contain"
                  style={{ width: '55%', height: '55%', transform: 'translateX(-52%)', zIndex: 5, opacity: 0.7, filter: 'brightness(0.75)' }} />
                {/* Back right — peeking */}
                <img src="/HPcart.png" alt="" className="absolute object-contain"
                  style={{ width: '55%', height: '55%', transform: 'translateX(52%)', zIndex: 5, opacity: 0.7, filter: 'brightness(0.75)' }} />
                {/* Front center */}
                <img src="/HPcart.png" alt="HP 678 Combo Pack" className="absolute object-contain drop-shadow-2xl"
                  style={{ width: '75%', height: '75%', zIndex: 10 }} />
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
                  {'image' in p && p.image ? (
                    <img src={p.image as string} alt={p.name} className="w-4/5 h-4/5 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-lg" />
                  ) : (
                    <div
                      className="w-12 h-16 rounded-xl shadow-xl flex flex-col items-center justify-between py-2 px-2 group-hover:scale-110 transition-transform duration-300"
                      style={{ background: 'linear-gradient(160deg, #1a1a2e, #0a0a18)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 16px 40px ${p.dot}35` }}
                    >
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
                      <div className="w-full h-1 rounded-full bg-white/5" />
                    </div>
                  )}
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
