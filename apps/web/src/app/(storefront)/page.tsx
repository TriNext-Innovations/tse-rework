'use client'

import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/layout'

type Theme = 'editorial' | 'brand'

const brands = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Lexmark', 'Xerox', 'Pantum', 'Ricoh', 'Kyocera', 'Konica Minolta', 'OKI', 'Olivetti']

const trending = [
  { name: 'HP 678 Black Ink', sku: 'CZ107AA', price: 299, type: 'Inkjet', tag: 'Bestseller' },
  { name: 'Canon 737 Black Toner', sku: 'CRG-737', price: 300, type: 'Laser', tag: 'Most ordered' },
  { name: 'HP 106A Black Toner', sku: 'W1106A', price: 330, type: 'Laser', tag: null },
  { name: 'Brother TN-2455 Toner', sku: 'TN2455', price: 330, type: 'Laser', tag: null },
  { name: 'Epson T6641 EcoTank', sku: 'C13T664100', price: 310, type: 'Inkjet', tag: 'Best value' },
  { name: 'Samsung MLT-D111S', sku: 'MLT-D111S', price: 325, type: 'Laser', tag: null },
]

const faqs = [
  { q: 'Will a generic cartridge work in my printer?', a: 'Yes. Our compatibles are engineered to spec for each printer model and meet or exceed OEM page yield. If it doesn\'t print as well as the original — we replace it.' },
  { q: 'How does delivery work?', a: 'Order before noon and we deliver next day in Johannesburg and Pretoria via our own drivers (COD available). Nationwide courier ships same day on prepayment.' },
  { q: 'What if a cartridge is faulty?', a: 'Every cartridge is covered by our guarantee. Faulty unit? We replace it, no fuss. That\'s the deal we\'ve held since 1992.' },
  { q: 'Do you do bulk / business pricing?', a: 'Yes. Offices, schools, print shops — call 011 708 2304 or email sales@tse.co.za for a quote.' },
]

export default function StorefrontPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [mouse, setMouse] = useState({ x: -1000, y: -1000 })
  const [theme, setTheme] = useState<Theme>('editorial')
  const heroRef = useRef<HTMLDivElement>(null)

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
    <div data-theme={theme} className="storefront font-[var(--font-inter)] text-[var(--ink)] bg-[var(--paper)] min-h-screen overflow-x-hidden transition-colors duration-500">
      <style>{`
        .storefront[data-theme="editorial"] {
          --paper: #F5F4F0;
          --paper-2: #EDEAE2;
          --ink: #111827;
          --ink-2: #374151;
          --magenta: #41e0f5;
          --magenta-soft: #d9f8fc;
          --cyan: #41e0f5;
          --lime: #dfe344;
          --glow: #ee75e9;
          --muted: #6B6B66;
          --on-accent: #111827;
          --grain-blend: multiply;
          --grain-opacity: 0.06;
        }
        .storefront[data-theme="brand"] {
          --paper: #374151;
          --paper-2: #4b5563;
          --ink: #f3f0e8;
          --ink-2: #e5e7eb;
          --magenta: #dfe344;
          --magenta-soft: #2a2d12;
          --cyan: #41e0f5;
          --lime: #dfe344;
          --glow: #dfe344;
          --muted: #9ca3af;
          --on-accent: #111827;
          --grain-blend: screen;
          --grain-opacity: 0.08;
        }
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
      <header className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between px-3 sm:px-5 py-2.5 bg-[var(--paper)]/85 backdrop-blur-xl border border-[var(--ink)]/10 rounded-full shadow-[0_8px_30px_-12px_rgba(10,10,10,0.18)] transition-colors duration-500">
        <a href="#top" className="flex items-center gap-2 pl-2 cursor-pointer">
          <Logo width={80} variant="color" linked={false} />
          <span className="hidden md:inline text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] ml-1">Est. 1992</span>
        </a>
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-[var(--ink-2)]">
          <a href="#shop" className="pill-nav-item px-3 py-1.5 cursor-pointer">Shop</a>
          <a href="#bento" className="pill-nav-item px-3 py-1.5 cursor-pointer">Why generic</a>
          <a href="#finder" className="pill-nav-item px-3 py-1.5 cursor-pointer">Find your cartridge</a>
          <a href="#delivery" className="pill-nav-item px-3 py-1.5 cursor-pointer">Delivery</a>
        </nav>
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Colour theme"
            className="relative flex items-center bg-[var(--ink)]/5 border border-[var(--ink)]/10 rounded-full p-0.5 text-[11px] font-medium overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-[var(--ink)] shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
              style={{ transform: theme === 'editorial' ? 'translateX(2px)' : 'translateX(calc(100% + 0px))' }}
            />
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'editorial'}
              onClick={() => setTheme('editorial')}
              className="relative z-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 cursor-pointer transition-colors duration-300"
            >
              <span className="flex gap-[3px]">
                <span className="w-2 h-2 rounded-full bg-[#F5F4F0] border border-black/10" />
                <span className="w-2 h-2 rounded-full bg-[#111827]" />
                <span className="w-2 h-2 rounded-full bg-[#41e0f5]" />
              </span>
              <span className={`hidden md:inline transition-colors duration-300 ${theme === 'editorial' ? 'text-[var(--paper)]' : 'text-[var(--muted)]'}`}>Editorial</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'brand'}
              onClick={() => setTheme('brand')}
              className="relative z-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 cursor-pointer transition-colors duration-300"
            >
              <span className="flex gap-[3px]">
                <span className="w-2 h-2 rounded-full bg-[#04060b]" />
                <span className="w-2 h-2 rounded-full bg-[#dfe344]" />
                <span className="w-2 h-2 rounded-full bg-[#41e0f5]" />
              </span>
              <span className={`hidden md:inline transition-colors duration-300 ${theme === 'brand' ? 'text-[var(--paper)]' : 'text-[var(--muted)]'}`}>Brand</span>
            </button>
          </div>

          <button aria-label="Search" className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--ink)]/5 transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="inline-flex items-center gap-1.5 bg-[var(--magenta)] text-[var(--on-accent)] hover:opacity-90 transition-opacity duration-200 rounded-full px-4 py-2 text-sm font-medium cursor-pointer shadow-[0_4px_16px_-4px_rgba(65,224,245,0.5)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            <span>Cart</span>
            <span className="bg-black/20 text-[var(--on-accent)] rounded-full text-[10px] font-bold w-4 h-4 inline-flex items-center justify-center">0</span>
          </button>
        </div>
      </header>

      {/* ─────────────── HERO ─────────────── */}
      <section
        id="top"
        ref={heroRef}
        className="relative pt-32 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-8 lg:px-12 overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            background: `radial-gradient(420px circle at ${mouse.x}px ${mouse.y}px, rgba(238,117,233,0.12), transparent 60%)`,
          }}
          aria-hidden
        />
        <div className="grain absolute inset-0" aria-hidden />

        <div className="relative mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-end">
          <div className="lg:col-span-7" data-reveal>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--magenta)]" /> Est. 1992 · South Africa
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
              South Africa's printer-cartridge specialist since 1992. We make compatibles that print as well as the
              original — sometimes better — at a fraction of the price. Order before noon, on your desk tomorrow.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#shop" className="group inline-flex items-center gap-2 bg-[var(--magenta)] text-[var(--on-accent)] hover:opacity-90 transition-opacity duration-200 rounded-full pl-6 pr-2 py-2.5 text-sm font-semibold cursor-pointer shadow-[0_8px_24px_-8px_rgba(65,224,245,0.55)]">
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
                <div className="font-display text-3xl sm:text-4xl font-light leading-none">33<span className="text-[var(--magenta)]">.</span></div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--muted)] mt-2">Yrs in business</div>
              </div>
              <div data-reveal>
                <div className="font-display text-3xl sm:text-4xl font-light leading-none">13</div>
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
                  <defs>
                    <path id="hero-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                  </defs>
                  <text fontSize="14" fontFamily="var(--font-fraunces), serif" letterSpacing="6" fill="var(--ink)">
                    <textPath href="#hero-ring">GENERIC · GUARANTEED · GENERIC · GUARANTEED · </textPath>
                  </text>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-[var(--magenta)] text-3xl sm:text-4xl">★</span>
                </div>
              </div>

              <div className="relative bg-[var(--ink)] text-[var(--paper)] rounded-[28px] p-6 sm:p-8 overflow-hidden">
                <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-[var(--glow)] opacity-30 blur-3xl" />
                <div className="relative flex items-start justify-between mb-8">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/70">
                    <span className="w-1 h-1 rounded-full bg-[var(--magenta)] animate-pulse" /> Bestseller
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/50">№ 001</span>
                </div>

                <div className="relative flex justify-center py-6">
                  <div className="animate-float relative">
                    <div className="w-40 h-56 sm:w-48 sm:h-64 rounded-[14px] bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#0A0A0A] shadow-[0_30px_60px_-20px_rgba(65,224,245,0.45)] relative overflow-hidden">
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
                  </div>
                </div>

                <div className="relative mt-6 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/60 mb-1">Canon · Compatible</div>
                    <div className="font-display text-xl sm:text-2xl leading-tight">737 Black Toner</div>
                    <div className="text-[11px] text-[var(--paper)]/50 mt-1">SKU CRG-737 · Up to 2,400 pages</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--paper)]/50">From</div>
                    <div className="font-display text-3xl sm:text-4xl">R300</div>
                  </div>
                </div>

                <button className="relative mt-6 w-full bg-[var(--paper)] hover:bg-[var(--magenta)] text-[var(--ink)] hover:text-[var(--on-accent)] rounded-full py-3 text-sm font-medium transition-colors duration-300 cursor-pointer">
                  Add to cart — R300
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
              Over thirty years engineering compatibles that hold up under real office use. If a cartridge fails, we replace it — that's the deal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 grid-rows-[auto] gap-3 sm:gap-4 auto-rows-[minmax(140px,_auto)]">
            <article data-reveal className="bento-card sm:col-span-3 sm:row-span-2 bg-[var(--ink)] text-[var(--paper)] rounded-[24px] p-7 sm:p-10 relative overflow-hidden flex flex-col justify-between min-h-[360px]">
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[var(--glow)] opacity-30 blur-3xl" />
              <div className="absolute top-7 right-7 text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/50">The Guarantee</div>
              <div className="relative">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--magenta)] mb-4">01</div>
                <p className="font-display font-light text-3xl sm:text-4xl leading-[1.05] tracking-tight">
                  <span className="font-display-italic">"</span>Works as good, or even
                  <span className="font-display-italic"> better </span>
                  than the original.<span className="font-display-italic">"</span>
                </p>
                <p className="mt-6 text-sm text-[var(--paper)]/70 max-w-md">
                  Failure? Wrong fit? Print quality off? We replace it. No tickets, no run-around — call us and it's sorted.
                </p>
              </div>
              <div className="relative mt-8 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/50">— TSE · Kya Sands, JHB</div>
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-[var(--paper)]/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                </span>
              </div>
            </article>

            <article data-reveal className="bento-card sm:col-span-3 bg-[var(--paper-2)] rounded-[24px] p-7 relative overflow-hidden min-h-[180px]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2">Est.</div>
              <div className="flex items-baseline gap-3">
                <div className="font-display font-light text-7xl sm:text-8xl leading-none tracking-[-0.04em]">1992</div>
                <div className="font-display-italic text-[var(--magenta)] text-2xl">.</div>
              </div>
              <p className="mt-3 text-sm text-[var(--ink-2)] max-w-sm">
                Family-run from Unit 34, Kya Sands Industrial — supplying offices, schools and print shops since 1992.
              </p>
            </article>

            <article data-reveal className="bento-card sm:col-span-2 bg-[var(--magenta)] text-[var(--on-accent)] rounded-[24px] p-6 relative overflow-hidden min-h-[180px] flex flex-col justify-between cursor-pointer">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--on-accent)]/70">Category</div>
              <div>
                <div className="font-display font-light text-4xl sm:text-5xl leading-none">Inkjet</div>
                <div className="mt-1 text-xs text-[var(--on-accent)]/80">For HP, Canon, Epson, Brother</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>120+ SKUs</span>
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--on-accent)] text-[var(--magenta)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </article>

            <article data-reveal className="bento-card sm:col-span-1 bg-[var(--ink-2)] text-[var(--paper)] rounded-[24px] p-5 relative overflow-hidden min-h-[180px] flex flex-col justify-between cursor-pointer">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/60">Category</div>
              <div className="font-display font-light text-3xl leading-none">Laser</div>
              <div className="text-[10px] text-[var(--paper)]/70">200+ SKUs</div>
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
                  <span key={b} className="text-[11px] font-medium px-2.5 py-1 border border-[var(--ink)]/10 hover:border-[var(--magenta)] hover:text-[var(--magenta)] rounded-full transition-colors cursor-pointer">
                    {b}
                  </span>
                ))}
              </div>
              <div className="mt-5 font-display text-2xl">
                <span className="font-display-italic text-[var(--magenta)]">13</span> brands · <span className="text-[var(--muted)]">320+ models</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────────────── COMPATIBILITY FINDER ─────────────── */}
      <section id="finder" className="relative px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl bg-[var(--ink)] text-[var(--paper)] rounded-[32px] p-8 sm:p-14 relative overflow-hidden" data-reveal>
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[var(--glow)]/30 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-[var(--cyan)]/15 blur-3xl" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/60 mb-4">№ 02 — Compatibility Finder</div>
              <h3 className="font-display font-light text-4xl sm:text-5xl leading-[0.95] tracking-tight">
                Tell us your printer.<br />
                <span className="font-display-italic text-[var(--magenta)]">We'll do the rest.</span>
              </h3>
              <p className="mt-4 text-sm text-[var(--paper)]/70 max-w-sm">
                Brand, model, done. We'll pull every cartridge that fits — black, colour, high-yield — with stock and pricing in one shot.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-[var(--paper)] text-[var(--ink)] rounded-2xl p-2 sm:p-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4 relative">
                  <label className="block text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] px-3 pt-3">Brand</label>
                  <select className="w-full bg-transparent pl-3 pr-8 pb-3 text-sm font-medium focus:outline-none appearance-none cursor-pointer">
                    {brands.map((b) => <option key={b}>{b}</option>)}
                  </select>
                  <svg className="absolute right-3 bottom-4 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                </div>
                <div className="sm:col-span-5 relative border-l border-[var(--ink)]/10">
                  <label className="block text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] px-3 pt-3">Printer model</label>
                  <input
                    type="text"
                    placeholder="e.g. LaserJet Pro M404dn"
                    className="w-full bg-transparent px-3 pb-3 text-sm font-medium focus:outline-none placeholder:text-[var(--muted)]"
                  />
                </div>
                <button className="sm:col-span-3 bg-[var(--ink)] hover:bg-[var(--magenta)] transition-colors duration-300 text-[var(--paper)] hover:text-[var(--on-accent)] rounded-xl px-4 py-3 text-sm font-medium cursor-pointer inline-flex items-center justify-center gap-2">
                  Find cartridges
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper)]/50 mr-1">Popular:</span>
                {['HP LaserJet M404', 'Canon MF273dw', 'Brother HL-L2375DW', 'Epson L3250'].map((q) => (
                  <button key={q} className="text-xs px-3 py-1.5 border border-[var(--paper)]/15 rounded-full hover:border-[var(--magenta)] hover:text-[var(--magenta)] transition-colors cursor-pointer">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── TRENDING PRODUCTS ─────────────── */}
      <section id="shop" className="relative px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-10" data-reveal>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 03 — On the shelves</div>
              <h2 className="font-display font-light text-5xl sm:text-6xl leading-[0.92] tracking-tight">
                This month's <span className="font-display-italic">most ordered</span>.
              </h2>
            </div>
            <a href="#" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium underline underline-offset-[6px] decoration-1 cursor-pointer hover:text-[var(--magenta)] transition-colors">
              View all 320+ cartridges →
            </a>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {trending.map((p, i) => (
              <article
                key={p.sku}
                data-reveal
                className="product-card group relative bg-[var(--paper-2)] rounded-[20px] p-5 sm:p-6 overflow-hidden cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{p.type}</span>
                  {p.tag && (
                    <span className="text-[9px] uppercase tracking-[0.16em] bg-[var(--ink)] text-[var(--paper)] px-2 py-1 rounded-full">{p.tag}</span>
                  )}
                </div>

                <div className="relative h-32 sm:h-36 flex items-end justify-center mb-4">
                  <div className="product-img relative">
                    <div className={`w-20 h-28 sm:w-24 sm:h-32 rounded-[8px] shadow-[0_18px_30px_-15px_rgba(10,10,10,0.4)] relative overflow-hidden ${
                      i % 3 === 0 ? 'bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A]' :
                      i % 3 === 1 ? 'bg-gradient-to-br from-[#41e0f5] to-[#0fb8d4]' :
                      'bg-gradient-to-br from-[#1a1a2e] to-[#3a3a5c]'
                    }`}>
                      <div className="absolute top-0 left-0 right-0 h-2 bg-[var(--paper)]/30" />
                      <div className="absolute top-3 left-2 right-2 text-[6px] uppercase tracking-[0.15em] text-[var(--paper)]/70">{p.sku.slice(0, 8)}</div>
                      <div className="absolute bottom-3 left-2 right-2 flex items-end justify-between">
                        <div className="font-display text-[var(--paper)] text-sm leading-none">TSE</div>
                        <div className="w-3 h-3 rounded-full border border-[var(--paper)]/40" />
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="font-display text-lg sm:text-xl leading-tight tracking-tight">{p.name}</h3>
                <div className="mt-1 text-[11px] text-[var(--muted)]">SKU {p.sku}</div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="font-display text-2xl sm:text-3xl">R{p.price}</div>
                  <button
                    aria-label={`Add ${p.name} to cart`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--ink)] text-[var(--paper)] group-hover:bg-[var(--magenta)] group-hover:text-[var(--on-accent)] transition-colors duration-300 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── EDITORIAL SPLIT ─────────────── */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5" data-reveal>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 04 — Field note</div>
            <h3 className="font-display font-light text-5xl sm:text-6xl leading-[0.95] tracking-tight">
              The print<br />
              <span className="font-display-italic">economy</span>,<br />
              re-engineered<span className="text-[var(--magenta)]">.</span>
            </h3>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6" data-reveal>
            <div className="border-t border-[var(--ink)]/15 pt-5">
              <div className="font-display font-light text-5xl sm:text-6xl leading-none tracking-tight">↓60%</div>
              <p className="mt-3 text-sm text-[var(--ink-2)]">
                Average cost-per-page reduction vs. matching OEM cartridge across the top 50 SKUs.
              </p>
            </div>
            <div className="border-t border-[var(--ink)]/15 pt-5">
              <div className="font-display font-light text-5xl sm:text-6xl leading-none tracking-tight">2,400</div>
              <p className="mt-3 text-sm text-[var(--ink-2)]">
                Pages from a single Canon 737 compatible at R300 — that's R0.13 a page, black-and-white.
              </p>
            </div>
            <div className="border-t border-[var(--ink)]/15 pt-5">
              <div className="font-display font-light text-5xl sm:text-6xl leading-none tracking-tight">{`<24h`}</div>
              <p className="mt-3 text-sm text-[var(--ink-2)]">
                Next-day delivery across Johannesburg and Pretoria on orders placed before 12:00.
              </p>
            </div>
            <div className="border-t border-[var(--ink)]/15 pt-5">
              <div className="font-display font-light text-5xl sm:text-6xl leading-none tracking-tight">1992</div>
              <p className="mt-3 text-sm text-[var(--ink-2)]">
                The year TSE started servicing offices out of Kya Sands. We've been refining the recipe ever since.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── FAQ ─────────────── */}
      <section className="relative px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12" data-reveal>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">№ 05 — Frequently asked</div>
            <h2 className="font-display font-light text-5xl sm:text-6xl leading-[0.92] tracking-tight">
              The <span className="font-display-italic">honest</span> answers.
            </h2>
          </div>

          <div className="divide-y divide-[var(--ink)]/10 border-y border-[var(--ink)]/10">
            {faqs.map((f, i) => {
              const open = openFaq === i
              return (
                <button
                  key={f.q}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full text-left py-6 flex items-start gap-6 group cursor-pointer"
                  data-reveal
                  aria-expanded={open}
                >
                  <span className="font-display text-sm text-[var(--muted)] pt-2 tabular-nums">0{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-2xl sm:text-3xl font-light leading-tight tracking-tight group-hover:text-[var(--magenta)] transition-colors">
                        {f.q}
                      </h3>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--ink)]/15 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-45 bg-[var(--magenta)] border-[var(--magenta)] text-[var(--on-accent)]' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      </span>
                    </div>
                    <div
                      className="grid transition-all duration-500 ease-out"
                      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
                    >
                      <p className="overflow-hidden text-[var(--ink-2)] text-[15px] leading-relaxed pr-12 mt-3">
                        {f.a}
                      </p>
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
                Offices, schools, print shops.<br />
                <span className="font-display-italic">Talk to a human.</span>
              </h3>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
              <a href="tel:0117082304" className="inline-flex items-center justify-center gap-2 bg-[var(--on-accent)] text-[var(--magenta)] hover:bg-[var(--ink)] hover:text-[var(--paper)] rounded-full px-5 py-3 text-sm font-medium transition-colors duration-300 cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                011 708 2304
              </a>
              <a href="mailto:sales@tse.co.za" className="inline-flex items-center justify-center gap-2 border border-[var(--on-accent)]/50 hover:bg-[var(--on-accent)] hover:text-[var(--magenta)] rounded-full px-5 py-3 text-sm font-medium transition-colors duration-300 cursor-pointer">
                sales@tse.co.za
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer className="px-4 sm:px-8 lg:px-12 pt-8 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="border-t border-[var(--ink)]/10 pt-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6">
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <Logo width={90} variant="mono-dark" linked={false} />
                </div>
                <p className="text-sm text-[var(--ink-2)] max-w-sm leading-relaxed">
                  Technical Systems Engineering — South Africa's quality-generic printer-cartridge specialist.
                </p>
                <p className="mt-4 text-xs text-[var(--muted)] leading-relaxed">
                  Unit 34, A.P.D. Industrial Park,<br />
                  Kya Sands, Johannesburg.
                </p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-4">Shop</div>
                <ul className="space-y-2 text-sm">
                  <li><a href="#" className="hover:text-[var(--magenta)] cursor-pointer transition-colors">Inkjet cartridges</a></li>
                  <li><a href="#" className="hover:text-[var(--magenta)] cursor-pointer transition-colors">Laser toner</a></li>
                  <li><a href="#" className="hover:text-[var(--magenta)] cursor-pointer transition-colors">By brand</a></li>
                  <li><a href="#" className="hover:text-[var(--magenta)] cursor-pointer transition-colors">Bulk &amp; business</a></li>
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mb-4">Hours</div>
                <ul className="space-y-2 text-sm">
                  <li>Mon–Thu · 8am–5pm</li>
                  <li>Fri · 8am–4pm</li>
                  <li className="text-[var(--muted)]">079 873 3558</li>
                  <li className="text-[var(--muted)]">011 708 2304/5</li>
                </ul>
              </div>
            </div>

            <div className="mt-12 flex items-baseline justify-between border-t border-[var(--ink)]/10 pt-6">
              <div className="text-xs text-[var(--muted)]">© {new Date().getFullYear()} TSE. All compatibles guaranteed.</div>
              <div className="font-display text-[10vw] sm:text-[8vw] leading-none tracking-[-0.05em] text-[var(--ink)]/8 select-none pointer-events-none -mb-4 sm:-mb-6">
                TSE<span className="font-display-italic">.</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
