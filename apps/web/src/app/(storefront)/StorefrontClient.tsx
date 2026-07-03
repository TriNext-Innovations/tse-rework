'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cartridgeTypeLabel } from '@/lib/taxonomy'
import { siteConfig } from '@/lib/site-config'
import Image from 'next/image'
import { Navbar } from '@/components/layout'
import { useCart } from '@/contexts/CartContext'

export type TrendingProduct = {
  id: string
  title: string
  handle: string
  variants: Array<{ sku: string | null; calculated_price?: { calculated_amount: number } | null }>
  categories: Array<{ name: string }>
  images?: Array<{ url: string }>
  metadata?: Record<string, unknown>
}

export type CompatModel = { brand: string; model: string; cartridge_count: number }

// The real Medusa product behind the hero "Bestseller" card, resolved
// server-side so the add-to-cart targets a purchasable variant.
export type HeroProduct = {
  id: string
  title: string
  handle: string
  sku: string
  variantId: string
  price: number | null
  image: string | null
}

const faqs = [
  { q: 'Will a generic cartridge work in my printer?', a: "Yes. Our compatibles are engineered to spec for each printer model and meet or exceed OEM page yield. If it doesn't print as well as the original — we replace it." },
  { q: 'How does delivery work?', a: 'Order before noon and we deliver next day in Johannesburg and Pretoria via our own drivers (COD available). Nationwide courier ships same day on prepayment.' },
  { q: 'What if a cartridge is faulty?', a: "Every cartridge is covered by our guarantee. Faulty unit? We replace it, no fuss. That's the deal we've held since 1987." },
  { q: 'Do you do bulk / business pricing?', a: `Yes. Offices, schools, print shops — call ${siteConfig.phone.display} or email ${siteConfig.email.sales} for a quote.` },
]


export default function StorefrontClient({
  trendingProducts,
  compatModels,
  heroProduct = null,
}: {
  trendingProducts: TrendingProduct[]
  compatModels: CompatModel[]
  heroProduct?: HeroProduct | null
}) {
  const heroPrice = heroProduct?.price ?? 300
  const heroSku = heroProduct?.sku ?? 'CAN-737'
  // Brands sorted alphabetically; models grouped per brand keeping the
  // DB ordering (which is by cartridge_count DESC) so the most-supported
  // printers appear first in the datalist.
  const brands = useMemo(
    () => [...new Set(compatModels.map((m) => m.brand))].sort(),
    [compatModels],
  )
  const modelsByBrand = useMemo(() => {
    const g: Record<string, string[]> = {}
    for (const m of compatModels) (g[m.brand] ??= []).push(m.model)
    return g
  }, [compatModels])
  // One representative model per brand, top 4 brands by cartridge count
  const popularSearches = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const m of compatModels) {
      if (seen.has(m.brand)) continue
      seen.add(m.brand)
      out.push(`${m.brand} ${m.model}`)
      if (out.length >= 4) break
    }
    return out
  }, [compatModels])

  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 })
  const [finderBrand, setFinderBrand] = useState(brands[0] ?? '')
  const [finderModel, setFinderModel] = useState('')

  // Sync finderBrand once data arrives if we started with empty list
  useEffect(() => {
    if (!finderBrand && brands[0]) setFinderBrand(brands[0])
  }, [brands, finderBrand])
  const heroRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { addItem } = useCart()

  function runFinder() {
    const query = [finderBrand, finderModel].filter(Boolean).join(' ').trim()
    if (!query) return
    router.push(`/compatibility?model=${encodeURIComponent(query)}`)
  }

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      setMouse({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    const onLeave = () => setMouse({ x: -1000, y: -1000 })
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  return (
    <div className="storefront font-[var(--font-inter)] text-[var(--ink)] bg-[var(--paper)] min-h-screen overflow-x-hidden transition-colors duration-500">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; font-variation-settings: 'SOFT' 50, 'WONK' 0; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .grain {
          background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          background-size: 220px 220px;
          opacity: var(--grain-opacity);
          mix-blend-mode: var(--grain-blend);
          pointer-events: none;
        }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-ticker { animation: ticker 40s linear infinite; }
        @keyframes float-slow { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-14px) rotate(-4deg); } }
        .animate-float { animation: float-slow 7s ease-in-out infinite; }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 22s linear infinite; }
        [data-reveal] { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.22,1,.36,1), transform .9s cubic-bezier(.22,1,.36,1); }
        [data-reveal].is-revealed { opacity: 1; transform: translateY(0); }
        .bento-card { transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -20px rgba(10,10,10,0.18); }
        .product-card { transition: transform .35s cubic-bezier(.22,1,.36,1); }
        .product-card:hover { transform: translateY(-3px); }
        .product-card:hover .product-img { transform: rotate(-2deg) scale(1.04); }
        .product-img { transition: transform .5s cubic-bezier(.22,1,.36,1); }
        .pill-nav-item { position: relative; }
        .pill-nav-item::after { content:''; position:absolute; left: 12px; right: 12px; bottom: 4px; height: 2px; background: var(--magenta); transform: scaleX(0); transform-origin: left; transition: transform .35s cubic-bezier(.22,1,.36,1); }
        .pill-nav-item:hover::after { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) {
          .animate-ticker, .animate-float, .animate-spin-slow { animation: none; }
          [data-reveal] { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      {/* ─────────────── FLOATING NAV ─────────────── */}
      <Navbar />

      {/* ─────────────── HERO ─────────────── */}
      <section id="top" ref={heroRef} className="relative pt-32 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-8 lg:px-12 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{ background: `radial-gradient(420px circle at ${mouse.x}px ${mouse.y}px, rgba(238,117,233,0.12), transparent 60%)` }}
          aria-hidden
        />
        <div className="grain absolute inset-0" aria-hidden />

        <div className="relative mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-end">
          <div className="lg:col-span-7" data-reveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--magenta)]" /> Est. 1987 · South Africa
              </span>
            </div>
            <h1 className="font-display font-light text-[15vw] sm:text-[12vw] lg:text-[9.5vw] leading-[0.88] tracking-[-0.04em] text-[var(--ink)]">
              <span className="font-display-italic font-light">Generic.</span>
              <br />
              <span className="relative inline-block">
                Not generic
                <span className="text-[var(--magenta)]">.</span>
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-[15px] sm:text-base text-[var(--ink-2)] leading-relaxed">
              South Africa's printer-cartridge specialist since 1987. We make compatibles that print as well as the
              original — sometimes better — at a fraction of the price. Order before noon, on your desk tomorrow.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#shop" className="group inline-flex items-center gap-2 bg-[var(--magenta)] text-[var(--on-accent)] hover:opacity-90 transition-opacity duration-200 rounded-full pl-6 pr-2 py-2.5 text-sm font-semibold cursor-pointer shadow-[0_8px_24px_-8px_rgba(238,117,233,0.55)]">
                Shop cartridges
                <span className="inline-flex items-center justify-center w-9 h-9 bg-white/20 text-white rounded-full group-hover:rotate-45 transition-transform duration-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                </span>
              </a>
              <a href="#finder" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:text-[var(--magenta)] transition-colors cursor-pointer underline underline-offset-[6px] decoration-1">
                Find by printer model
              </a>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-4 max-w-md">
              <div data-reveal>
                <div className="font-display text-3xl sm:text-4xl font-light leading-none">39<span className="text-[var(--magenta)]">.</span></div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] mt-2">Yrs in business</div>
              </div>
              <div data-reveal>
                <div className="font-display text-3xl sm:text-4xl font-light leading-none">12</div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] mt-2">Brands</div>
              </div>
              <div data-reveal>
                <div className="font-display text-3xl sm:text-4xl font-light leading-none">R300<span className="text-[var(--magenta)]">+</span></div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] mt-2">From</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative" data-reveal>
            <div className="relative">
              <div className="absolute -top-6 -right-2 sm:right-6 w-28 h-28 sm:w-36 sm:h-36 z-20 animate-spin-slow">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <defs><path id="hero-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
                  <text fontSize="14" fontFamily="var(--font-fraunces), serif" letterSpacing="6" fill="var(--ink)">
                    <textPath href="#hero-ring">GENERIC · GUARANTEED · GENERIC · GUARANTEED · </textPath>
                  </text>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-[var(--magenta)] text-3xl sm:text-4xl">★</span>
                </div>
              </div>

              <div className="panel-dark relative bg-[var(--ink)] text-[var(--paper)] rounded-[28px] p-6 sm:p-8 overflow-hidden">
                <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-[var(--glow)] opacity-30 blur-3xl" />
                <div className="relative flex items-start justify-between mb-8">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/70">
                    <span className="w-1 h-1 rounded-full bg-[var(--magenta)] animate-pulse" /> Bestseller
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/50">№ 001</span>
                </div>

                <div className="relative flex justify-center py-6">
                  <div className="animate-float relative">
                    {heroProduct?.image ? (
                      <Image
                        src={heroProduct.image}
                        alt={heroProduct.title}
                        width={280}
                        height={360}
                        priority
                        sizes="(max-width: 640px) 60vw, 240px"
                        className="w-40 h-56 sm:w-48 sm:h-64 object-contain drop-shadow-[0_30px_60px_rgba(238,117,233,0.45)]"
                      />
                    ) : (
                      <div className="w-40 h-56 sm:w-48 sm:h-64 rounded-[14px] bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#0A0A0A] shadow-[0_30px_60px_-20px_rgba(238,117,233,0.45)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-3 bg-[var(--magenta)]" />
                        <div className="absolute top-6 left-4 right-4 text-[9px] uppercase tracking-[0.2em] text-[var(--paper)]/60">TSE Compatible</div>
                        <div className="absolute top-12 left-4 font-display text-[var(--paper)] text-2xl leading-none">Canon</div>
                        <div className="absolute top-[78px] left-4 font-display-italic text-[var(--magenta)] text-3xl leading-none">737</div>
                        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--paper)]/60">Black<br/>Toner</div>
                          <div className="w-6 h-6 rounded-full border border-[var(--paper)]/30" />
                        </div>
                        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-px bg-[var(--paper)]/15" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mt-6 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/60 mb-1">Canon · Compatible</div>
                    <div className="font-display text-xl sm:text-2xl leading-tight">737 Black Toner</div>
                    <div className="text-[11px] text-[var(--paper)]/50 mt-1">SKU {heroSku} · Up to 2,400 pages</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--paper)]/50">From</div>
                    <div className="font-display text-3xl sm:text-4xl">R{heroPrice}</div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    heroProduct
                      ? addItem({
                          id: heroProduct.id,
                          title: heroProduct.title,
                          sku: heroProduct.sku,
                          price: heroProduct.price,
                          variantId: heroProduct.variantId,
                        })
                      : router.push('/products/canon-ca737')
                  }
                  className="relative mt-6 w-full bg-[var(--paper)] hover:bg-[var(--magenta)] text-[var(--ink)] hover:text-[var(--on-accent)] rounded-full py-3 text-sm font-medium transition-colors duration-300 cursor-pointer"
                >
                  Add to cart — R{heroPrice}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── BRAND MARQUEE ─────────────── */}
      <section className="relative border-y border-[var(--ink)]/10 bg-[var(--paper)] py-6 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-[var(--paper)] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[var(--paper)] to-transparent" />
        <div className="flex animate-ticker w-max">
          {[...brands, ...brands].map((b, i) => (
            <div key={`${b}-${i}`} className="flex items-center gap-8 px-8 whitespace-nowrap">
              <span className="font-display text-2xl sm:text-3xl tracking-tight text-[var(--ink)]">{b}</span>
              <span className="text-[var(--magenta)] text-xl">✦</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────── BENTO GRID ─────────────── */}
      <section id="bento" className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-10" data-reveal>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 01 — The case for generic</div>
              <h2 className="font-display font-light text-5xl sm:text-7xl leading-[0.92] tracking-[-0.03em] max-w-3xl">
                Same print<span className="font-display-italic"> quality</span>.
                <br /> Half the<span className="text-[var(--magenta)]"> sticker shock</span>.
              </h2>
            </div>
            <p className="max-w-sm text-[var(--ink-2)] text-[15px] leading-relaxed">
              Thirty-nine years engineering compatibles that hold up under real office use. If a cartridge fails, we replace it — that's the deal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 grid-rows-[auto] gap-3 sm:gap-4 auto-rows-[minmax(140px,_auto)]">
            <article id="finder" data-reveal className="panel-dark bento-card sm:col-span-3 sm:row-span-2 bg-[var(--ink)] text-[var(--paper)] rounded-[24px] p-7 sm:p-10 relative overflow-hidden flex flex-col justify-between min-h-[360px]">
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[var(--glow)] opacity-30 blur-3xl" />
              <div className="absolute top-7 right-7 text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/50">Compatibility Finder</div>
              <div className="relative">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--magenta)] mb-4">01</div>
                <p className="font-display font-light text-3xl sm:text-4xl leading-[1.05] tracking-tight">
                  Tell us your printer.<br />
                  <span className="font-display-italic text-[var(--magenta)]">We'll do the rest.</span>
                </p>
                <p className="mt-4 text-sm text-[var(--paper)]/70 max-w-md">
                  Brand, model, done. We'll pull every cartridge that fits — black, colour, high-yield — with stock and pricing in one shot.
                </p>
              </div>

              <div className="relative mt-8">
                <div className="bg-[var(--paper)] text-[var(--ink)] rounded-2xl p-2 sm:p-3 flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <label className="block text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] px-3 pt-3">Brand</label>
                      <select
                        value={finderBrand}
                        onChange={(e) => setFinderBrand(e.target.value)}
                        className="w-full bg-transparent pl-3 pr-8 pb-3 text-sm font-medium focus:outline-none appearance-none cursor-pointer"
                      >
                        {brands.map((b) => <option key={b}>{b}</option>)}
                      </select>
                      <svg className="absolute right-3 bottom-4 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div className="relative border-t sm:border-t-0 sm:border-l border-[var(--ink)]/10">
                      <label className="block text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] px-3 pt-3">Printer model</label>
                      <input
                        type="text"
                        list="finder-models"
                        placeholder="e.g. P1102, MX494"
                        value={finderModel}
                        onChange={(e) => setFinderModel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runFinder()}
                        className="w-full bg-transparent px-3 pb-3 text-sm font-medium focus:outline-none placeholder:text-[var(--muted)]"
                        autoComplete="off"
                      />
                      <datalist id="finder-models">
                        {(modelsByBrand[finderBrand] ?? []).map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <button
                    onClick={runFinder}
                    className="bg-[var(--ink)] hover:bg-[var(--magenta)] transition-colors duration-300 text-[var(--paper)] hover:text-[var(--on-accent)] rounded-xl px-4 py-3 text-sm font-medium cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    Find cartridges
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/50 mr-1">Popular:</span>
                  {popularSearches.map((label) => (
                    <button
                      key={label}
                      onClick={() => router.push(`/compatibility?model=${encodeURIComponent(label)}`)}
                      className="text-xs px-3 py-1.5 border border-[var(--paper)]/15 rounded-full hover:border-[var(--magenta)] hover:text-[var(--magenta)] transition-colors cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </article>

            <article data-reveal className="bento-card sm:col-span-3 bg-[var(--paper-2)] rounded-[24px] p-7 relative overflow-hidden min-h-[180px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2">Est.</div>
              <div className="flex items-baseline gap-3">
                <div className="font-display font-light text-7xl sm:text-8xl leading-none tracking-[-0.04em]">1987</div>
                <div className="font-display-italic text-[var(--magenta)] text-2xl">.</div>
              </div>
              <p className="mt-3 text-sm text-[var(--ink-2)] max-w-sm">
                Family-run from Unit 34, Kya Sands Industrial — supplying offices, schools and print shops since 1987.
              </p>
            </article>

            <article data-reveal onClick={() => router.push('/products?type=inkjet')} className="bento-card sm:col-span-2 bg-[var(--magenta)] text-[var(--on-accent)] rounded-[24px] p-6 relative overflow-hidden min-h-[180px] flex flex-col justify-between cursor-pointer">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--on-accent)]/70">Category</div>
              <div>
                <div className="font-display font-light text-4xl sm:text-5xl leading-none">Inkjet</div>
                <div className="mt-1 text-xs text-[var(--on-accent)]/80">For HP, Canon, Epson, Brother</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>170+ SKUs</span>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--on-accent)] text-[var(--magenta)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </article>

            <article data-reveal onClick={() => router.push('/products?type=laser')} className="panel-dark bento-card sm:col-span-1 bg-[var(--ink-2)] text-[var(--paper)] rounded-[24px] p-5 relative overflow-hidden min-h-[180px] flex flex-col justify-between cursor-pointer">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/60">Category</div>
              <div className="font-display font-light text-3xl leading-none">Laser</div>
              <div className="text-[10px] text-[var(--paper)]/70">380+ SKUs</div>
            </article>

            <article id="delivery" data-reveal className="bento-card sm:col-span-3 bg-[var(--paper-2)] rounded-[24px] p-7 relative overflow-hidden min-h-[180px]">
              <div className="flex items-start justify-between">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Delivery</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">02</div>
              </div>
              <p className="mt-4 font-display font-light text-3xl sm:text-4xl leading-[1.05] tracking-tight">
                Order by <span className="font-display-italic">noon</span>,<br />
                on your desk <span className="text-[var(--magenta)]">tomorrow</span>.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-2)]">
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--magenta)]" /> JHB / PTA — own drivers, COD</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--ink)]" /> Nationwide — courier</span>
              </div>
            </article>

            <article data-reveal className="bento-card sm:col-span-3 bg-[var(--paper)] border border-[var(--ink)]/10 rounded-[24px] p-7 relative overflow-hidden min-h-[180px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Compatible with</div>
              <div className="flex flex-wrap gap-1.5">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => router.push(`/products?brand=${encodeURIComponent(b)}`)}
                    className="text-[11px] font-medium px-2.5 py-1 border border-[var(--ink)]/10 hover:border-[var(--magenta)] hover:text-[var(--magenta)] rounded-full transition-colors cursor-pointer"
                  >
                    {b}
                  </button>
                ))}
              </div>
              <div className="mt-5 font-display text-2xl">
                <span className="font-display-italic text-[var(--magenta)]">{brands.length || 12}</span> brands · <span className="text-[var(--muted)]">660+ models</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────────────── TRENDING PRODUCTS ─────────────── */}
      <section id="shop" className="relative px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-10" data-reveal>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 02 — On the shelves</div>
              <h2 className="font-display font-light text-5xl sm:text-6xl leading-[0.92] tracking-tight">
                This month's <span className="font-display-italic">most ordered</span>.
              </h2>
            </div>
            <a href="/products" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium underline underline-offset-[6px] decoration-1 cursor-pointer hover:text-[var(--magenta)] transition-colors">
              View all 559 cartridges →
            </a>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {trendingProducts.map((p, i) => {
              const variant = p.variants?.[0]
              const sku = variant?.sku ?? '—'
              const priceZar = variant?.calculated_price?.calculated_amount
                ? variant.calculated_price.calculated_amount.toFixed(0)
                : null
              const type = cartridgeTypeLabel(p.metadata?.cartridge_type) ?? 'Laser'

              return (
                <article key={p.id} data-reveal onClick={() => router.push(`/products/${p.handle}`)} className="product-card group relative bg-[var(--paper-2)] rounded-[20px] p-5 sm:p-6 overflow-hidden cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{type}</span>
                  </div>

                  <div className="relative h-32 sm:h-36 flex items-end justify-center mb-4">
                    <div className="product-img relative">
                      {p.images?.[0]?.url ? (
                        <Image
                          src={p.images[0].url}
                          alt={p.title}
                          width={220}
                          height={280}
                          sizes="(max-width: 640px) 45vw, 220px"
                          className="h-28 sm:h-44 w-auto object-contain drop-shadow-lg"
                        />
                      ) : (
                        <div className={`w-20 h-28 sm:w-24 sm:h-32 rounded-[8px] shadow-[0_18px_30px_-15px_rgba(10,10,10,0.4)] relative overflow-hidden ${
                          i % 3 === 0 ? 'bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A]' :
                          i % 3 === 1 ? 'bg-gradient-to-br from-[#41e0f5] to-[#0fb8d4]' :
                          'bg-gradient-to-br from-[#1a1a2e] to-[#3a3a5c]'
                        }`}>
                          <div className="absolute top-0 left-0 right-0 h-2 bg-[var(--paper)]/30" />
                          <div className="absolute top-3 left-2 right-2 text-[6px] uppercase tracking-[0.15em] text-[var(--paper)]/70">{sku.slice(0, 10)}</div>
                          <div className="absolute bottom-3 left-2 right-2 flex items-end justify-between">
                            <div className="font-display text-[var(--paper)] text-sm leading-none">TSE</div>
                            <div className="w-3 h-3 rounded-full border border-[var(--paper)]/40" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display text-lg sm:text-xl leading-tight tracking-tight">{p.title}</h3>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">SKU {sku}</div>

                  <div className="mt-4 flex items-end justify-between">
                    <div className="font-display text-2xl sm:text-3xl">
                      {priceZar ? `R${priceZar}` : <span className="text-[var(--muted)] text-lg">POA</span>}
                    </div>
                    <button
                      aria-label={`Add ${p.title} to cart`}
                      onClick={(e) => {
                        e.stopPropagation()
                        addItem({ id: p.id, title: p.title, sku, price: priceZar ? Number(priceZar) : null })
                      }}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--ink)] text-[var(--paper)] group-hover:bg-[var(--magenta)] group-hover:text-[var(--on-accent)] transition-colors duration-300 cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── EDITORIAL SPLIT ─────────────── */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5" data-reveal>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 03 — Field note</div>
            <h3 className="font-display font-light text-5xl sm:text-6xl leading-[0.95] tracking-tight">
              The print<br /><span className="font-display-italic">economy</span>,<br />re-engineered<span className="text-[var(--magenta)]">.</span>
            </h3>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6" data-reveal>
            {[
              { stat: '↓60%', copy: 'Average cost-per-page reduction vs. matching OEM cartridge across the top 50 SKUs.' },
              { stat: '2,400', copy: 'Pages from a single Canon 737 compatible at R300 — that\'s R0.13 a page, black-and-white.' },
              { stat: '<24h', copy: 'Next-day delivery across Johannesburg and Pretoria on orders placed before 12:00.' },
              { stat: '1987', copy: 'The year TSE started servicing offices out of Kya Sands. We\'ve been refining the recipe ever since.' },
            ].map(({ stat, copy }) => (
              <div key={stat} className="border-t border-[var(--ink)]/15 pt-5">
                <div className="font-display font-light text-5xl sm:text-6xl leading-none tracking-tight">{stat}</div>
                <p className="mt-3 text-sm text-[var(--ink-2)]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FAQ ─────────────── */}
      <section id="faq" className="relative px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12" data-reveal>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 04 — Frequently asked</div>
            <h2 className="font-display font-light text-5xl sm:text-6xl leading-[0.92] tracking-tight">
              The <span className="font-display-italic">honest</span> answers.
            </h2>
          </div>

          <div className="divide-y divide-[var(--ink)]/10 border-y border-[var(--ink)]/10">
            {faqs.map((f, i) => {
              const open = openFaq === i
              return (
                <button key={f.q} onClick={() => setOpenFaq(open ? null : i)} className="w-full text-left py-6 flex items-start gap-6 group cursor-pointer" data-reveal aria-expanded={open}>
                  <span className="font-display text-sm text-[var(--muted)] pt-2 tabular-nums">0{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-2xl sm:text-3xl font-light leading-tight tracking-tight group-hover:text-[var(--magenta)] transition-colors">{f.q}</h3>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ink)]/15 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-45 bg-[var(--magenta)] border-[var(--magenta)] text-[var(--on-accent)]' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      </span>
                    </div>
                    <div className="grid transition-all duration-500 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}>
                      <p className="overflow-hidden text-[var(--ink-2)] text-[15px] leading-relaxed pr-12 mt-3">{f.a}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── CTA BAND ─────────────── */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-12">
        <div className="mx-auto max-w-7xl bg-[var(--magenta)] text-[var(--on-accent)] rounded-[28px] p-8 sm:p-12 relative overflow-hidden" data-reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--on-accent)]/80 mb-3">Need a quote?</div>
              <h3 className="font-display font-light text-4xl sm:text-5xl leading-[0.95] tracking-tight">
                Offices, schools, print shops.<br /><span className="font-display-italic">Talk to a human.</span>
              </h3>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
              <a href={siteConfig.phone.tel} className="inline-flex items-center justify-center gap-2 bg-[var(--on-accent)] text-[var(--magenta)] hover:bg-[var(--ink)] hover:text-[var(--paper)] rounded-full px-5 py-3 text-sm font-medium transition-colors duration-300 cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {siteConfig.phone.display}
              </a>
              <a href={siteConfig.email.mailto} className="inline-flex items-center justify-center gap-2 border border-[var(--on-accent)]/50 hover:bg-[var(--on-accent)] hover:text-[var(--magenta)] rounded-full px-5 py-3 text-sm font-medium transition-colors duration-300 cursor-pointer">
                {siteConfig.email.sales}
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
