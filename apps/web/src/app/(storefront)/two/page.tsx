import { MockupNav } from '@/components/mockup-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'POC 2 — Authority' }

const allBrands = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Lexmark', 'Xerox', 'Pantum', 'Ricoh', 'Kyocera', 'Konica Minolta', 'OKI', 'Olivetti']
const marquee = [...allBrands, ...allBrands]

const products = [
  { name: 'HP 678 Black Ink Cartridge', sku: 'CZ107AA', price: 'R 299', save: 'Save vs original' },
  { name: 'Canon 737 Black Toner', sku: 'CRG-737', price: 'R 300', save: null },
  { name: 'HP 106A Black Toner Cartridge', sku: 'W1106A', price: 'R 330', save: 'Save vs original' },
  { name: 'Brother TN-2455 Toner', sku: 'TN2455', price: 'R 330', save: null },
  { name: 'Epson T6641 EcoTank Black', sku: 'C13T664100', price: 'R 310', save: 'Save vs original' },
]

const reviews = [
  { name: 'Thabo M.', city: 'Johannesburg', text: 'Been buying from TSE for years. Never had a cartridge fail. Saved a fortune switching the whole office over.' },
  { name: 'Priya N.', city: 'Durban', text: 'Ordered for my Canon and it printed perfectly straight out the box. Way cheaper than the original and works just as well.' },
  { name: 'Werner D.', city: 'Cape Town', text: 'Courier was fast, packaging solid. Third order now and not a single issue. Would recommend to anyone running a small business.' },
  { name: 'Lebo K.', city: 'Pretoria', text: 'Customer service actually picks up the phone. Sorted out my order query in minutes. That alone keeps me coming back.' },
]

export default function PocTwoPage() {
  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] font-sans">
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .animate-ticker { animation: ticker 30s linear infinite; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-100 sticky top-0 z-40 bg-white">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TSE Online" style={{ width: 200, height: 48, objectFit: 'contain' }} />
          <span className="text-xs text-gray-400 font-medium tracking-wide -ml-2">Cartridges</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          {['Products', 'Brands', 'About'].map((item) => (
            <a key={item} href="#" className="hover:text-gray-900 transition-colors cursor-pointer">{item}</a>
          ))}
        </nav>
        <button className="bg-[#0A0A0A] text-white text-sm font-black px-5 py-2.5 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
          Shop Now
        </button>
      </header>

      {/* Hero — oversized editorial, light */}
      <section className="pt-14 pb-0 overflow-hidden border-b border-gray-100" style={{ backgroundImage: "url('https://cdn.mos.cms.futurecdn.net/g3k8sf4sNtXPpTeevjoKEW.jpg')", backgroundRepeat: 'no-repeat', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="px-8 mb-3">
          <span className="text-[11px] font-black text-[#0D9488] uppercase tracking-[0.3em]">
            Kya Sands, Johannesburg · Supplying South Africa since 1992
          </span>
        </div>

        <div className="overflow-hidden px-8">
          <h1
            className="font-black uppercase text-[#0A0A0A] leading-none"
            style={{ fontSize: 'clamp(4.5rem, 14vw, 12rem)', lineHeight: 0.85, letterSpacing: '-0.04em' }}
          >
            QUALITY
          </h1>
        </div>
        <div className="overflow-hidden">
          <h1
            className="font-black uppercase text-[#0D9488] leading-none pl-8"
            style={{ fontSize: 'clamp(4.5rem, 14vw, 12rem)', lineHeight: 0.85, letterSpacing: '-0.04em' }}
          >
            GENERICS.
          </h1>
        </div>

        {/* Guarantee statement — under headline */}
        <div className="px-8 mt-10 pb-14 max-w-2xl">
          <p className="text-xl text-gray-500 leading-relaxed font-medium mb-6">
            Every cartridge we sell is guaranteed to work as good, or better, than the original — at a fraction of the brand price.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black px-7 py-4 rounded-2xl cursor-pointer transition-colors border-2 border-[#0D9488] hover:border-[#0f766e]">
              Shop All Cartridges
            </button>
            <button className="border-2 border-[#0D9488] hover:border-[#0f766e] text-[#0D9488] hover:text-[#0f766e] font-bold px-7 py-4 rounded-2xl cursor-pointer transition-colors">
              Find My Cartridge
            </button>
          </div>
        </div>
      </section>

      {/* Brand ticker — dark on light */}
      <div className="border-b border-gray-100 py-4 overflow-hidden bg-gray-50">
        <div className="flex animate-ticker whitespace-nowrap">
          {marquee.map((brand, i) => (
            <span key={i} className="inline-flex items-center gap-5 px-6 text-xs font-black text-gray-400 hover:text-gray-700 cursor-pointer transition-colors uppercase tracking-widest">
              {brand}
              <span className="w-1 h-1 rounded-full bg-gray-300" />
            </span>
          ))}
        </div>
      </div>

      {/* Credibility bar */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '1992', label: 'Year established' },
            { value: '13+', label: 'Printer brands stocked' },
            { value: '100%', label: 'Generic — not OEM' },
            { value: 'Next day', label: 'JHB/PTA before noon' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-[#0A0A0A] tracking-tight leading-none">{s.value}</div>
              <div className="text-gray-400 text-xs mt-2 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Products — editorial list */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex items-baseline justify-between mb-10">
          <div>
            <span className="text-[11px] font-black text-[#0D9488] uppercase tracking-[0.25em]">Best Sellers</span>
            <h2 className="text-3xl font-black mt-1 tracking-tight">Popular right now</h2>
          </div>
          <a href="#" className="text-sm text-gray-400 hover:text-gray-900 transition-colors cursor-pointer">View all →</a>
        </div>
        <div className="divide-y divide-gray-100">
          {products.map((p, i) => (
            <div key={p.sku} className="flex items-center justify-between py-5 group cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded-2xl transition-colors">
              <div className="flex items-center gap-6">
                <span className="text-gray-300 text-sm font-mono w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="text-gray-900 font-semibold text-base group-hover:text-[#0D9488] transition-colors">{p.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">SKU: {p.sku} · <span className="text-[#0D9488] font-semibold">Generic</span></div>
                </div>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                {p.save && <span className="text-xs font-bold text-green-600 hidden sm:block">{p.save}</span>}
                <span className="text-xl font-black text-gray-900">{p.price}</span>
                <button className="bg-gray-900 hover:bg-[#0D9488] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors">
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantee — full-width statement */}
      <section className="bg-[#0D9488]">
        <div className="max-w-7xl mx-auto px-8 py-16 flex flex-col md:flex-row items-start md:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <p className="text-teal-100 text-xs font-black uppercase tracking-widest mb-3">Our Promise</p>
            <h2 className="text-3xl font-black text-white leading-tight">
              &ldquo;We guarantee all our products to work as good, or even better, than the original.&rdquo;
            </h2>
          </div>
          <div className="space-y-3 shrink-0">
            {[
              'Replacement warranty on every cartridge',
              'Quality-tested, imported inks',
              'Used by businesses across South Africa',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-teal-100 text-sm">
                <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews — newspaper columns */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-10">
          <span className="text-[11px] font-black text-[#0D9488] uppercase tracking-[0.25em]">Reviews</span>
          <h2 className="text-3xl font-black mt-1 tracking-tight">What customers say.</h2>
        </div>
        <div className="columns-1 sm:columns-2 gap-5 space-y-5">
          {reviews.map((r) => (
            <div key={r.name} className="break-inside-avoid bg-gray-50 border border-gray-100 rounded-3xl p-6">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0D9488]/10 flex items-center justify-center">
                  <span className="text-[#0D9488] text-xs font-black">{r.name[0]}</span>
                </div>
                <div>
                  <div className="text-gray-900 text-xs font-bold">{r.name}</div>
                  <div className="text-gray-400 text-xs">{r.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <div className="border-t border-gray-100 bg-[#0A0A0A] px-8 py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-white font-black text-2xl tracking-tight">Ready to switch to generics?</div>
            <div className="text-gray-500 text-sm mt-1">Quality cartridges. Competitive prices. Supplying SA since 1992.</div>
          </div>
          <button className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black px-8 py-4 rounded-2xl cursor-pointer transition-colors text-sm shrink-0">
            Browse All Products →
          </button>
        </div>
      </div>

      <MockupNav />
    </div>
  )
}
