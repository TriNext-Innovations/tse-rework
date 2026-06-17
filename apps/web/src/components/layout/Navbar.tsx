'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Logo } from './Logo'
import { CartButton } from '@/components/CartButton'
import { useAuth } from '@/contexts/AuthContext'
import { SearchModal } from '@/components/SearchModal'

type Category = { id: string; name: string }
type BrandEntry = { name: string; ids: string[] }

const TYPE_CATEGORIES = new Set(['Inkjet Cartridges', 'Laser Cartridges'])

const FALLBACK_BRANDS: BrandEntry[] = [
  { name: 'HP', ids: ['HP'] },
  { name: 'Canon', ids: ['Canon'] },
  { name: 'Epson', ids: ['Epson'] },
  { name: 'Brother', ids: ['Brother'] },
  { name: 'Samsung', ids: ['Samsung'] },
  { name: 'Lexmark', ids: ['Lexmark'] },
  { name: 'Xerox', ids: ['Xerox'] },
  { name: 'Pantum', ids: ['Pantum'] },
  { name: 'Ricoh', ids: ['Ricoh'] },
  { name: 'Kyocera', ids: ['Kyocera'] },
  { name: 'Konica Minolta', ids: ['Konica Minolta'] },
  { name: 'OKI', ids: ['OKI'] },
  { name: 'Olivetti', ids: ['Olivetti'] },
]

type NavbarProps = {
  categories?: Category[]
  right?: React.ReactNode
}

export function Navbar({ categories = [], right }: NavbarProps) {
  const [shopOpen, setShopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [brandsExpanded, setBrandsExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const shopRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
const { customer, loading: authLoading } = useAuth()

  // CMD+K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function openShop() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setShopOpen(true)
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setShopOpen(false), 200)
  }

  const hasRealCategories = categories.some((c) => !TYPE_CATEGORIES.has(c.name))

  // Deduplicate brands by name — Brother appears under both Inkjet and Laser
  const brandMap = new Map<string, string[]>()
  for (const c of categories) {
    if (TYPE_CATEGORIES.has(c.name)) continue
    const ids = brandMap.get(c.name) ?? []
    ids.push(c.id)
    brandMap.set(c.name, ids)
  }
  const uniqueBrands = [...brandMap.entries()].map(([name, ids]) => ({ name, ids }))
  const brands: BrandEntry[] = uniqueBrands.length > 0 ? uniqueBrands : FALLBACK_BRANDS

  function brandHref(b: BrandEntry) {
    return hasRealCategories
      ? `/products?category=${b.ids.join(',')}`
      : `/products?brand=${encodeURIComponent(b.name)}`
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShopOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <>
      <style>{`
        .navbar-glass {
          background: rgba(255,255,255,0.19);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(255,255,255,0.1);
          overflow: visible;
          /* Intentionally no position here. The Tailwind "fixed" utility on the
             header must win; this style block previously set position relative,
             which (since component styles win the cascade) overrode fixed,
             making the navbar full-width and shifting it 16px right via left-4
             — a horizontal overflow on every page. fixed already establishes
             the positioning context the ::before highlight anchors to. */
        }
        .navbar-glass::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
          border-radius: 9999px;
          pointer-events: none;
        }
        .nav-link {
          position: relative;
          padding: 6px 12px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--ink-2, #374151);
          transition: color 0.2s;
          border-radius: 9999px;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          left: 12px; right: 12px; bottom: 4px;
          height: 2px;
          background: #41e0f5;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.35s cubic-bezier(.22,1,.36,1);
        }
        .nav-link:hover::after { transform: scaleX(1); }
        .nav-link:hover { color: #111827; }

        /* Mega-menu panel */
        .mega-panel {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 20px 60px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06);
          padding: 20px;
          width: 420px;
          z-index: 50;
          animation: megaIn .2s cubic-bezier(.22,1,.36,1);
        }
        @keyframes megaIn {
          from { opacity:0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }

        /* Mobile drawer */
        .mobile-drawer-overlay {
          position: fixed; inset: 0; z-index: 60;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: fadeIn .2s ease;
        }
        .mobile-drawer {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(320px, 88vw);
          background: #F5F4F0;
          z-index: 61;
          display: flex;
          flex-direction: column;
          box-shadow: -20px 0 60px -10px rgba(0,0,0,0.15);
          animation: slideIn .3s cubic-bezier(.22,1,.36,1);
        }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>

      {/* ─── FLOATING NAVBAR ─── */}
      <header className="navbar-glass fixed top-4 left-4 right-4 z-40 flex items-center justify-between px-3 sm:px-5 py-2.5">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pl-1 flex-shrink-0">
          <Logo width={80} variant="color" linked={false} />
          <span className="hidden lg:inline text-[10px] uppercase tracking-[0.18em] text-[#6B6B66] ml-1">Est. 1987</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">

          {/* Shop with mega-menu */}
          <div
            ref={shopRef}
            className="relative"
            onMouseEnter={openShop}
            onMouseLeave={scheduleClose}
          >
            <Link
              href="/products"
              className="nav-link inline-flex items-center gap-1"
              aria-haspopup="true"
              aria-expanded={shopOpen}
            >
              Shop
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                style={{ transition: 'transform .2s', transform: shopOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Link>

            {shopOpen && (
              <div className="mega-panel" role="menu" onMouseEnter={openShop} onMouseLeave={scheduleClose}>
                <div className="text-[9px] uppercase tracking-[0.2em] text-[#9ca3af] mb-3 px-1">Shop by brand</div>
                <div className="grid grid-cols-3 gap-1">
                  {brands.map((b) => (
                    <Link
                      key={b.name}
                      href={brandHref(b)}
                      role="menuitem"
                      onClick={() => setShopOpen(false)}
                      className="text-[13px] px-3 py-2 rounded-xl hover:bg-[#F5F4F0] hover:text-[#41e0f5] transition-colors font-medium text-[#374151]"
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-black/8">
                  <Link
                    href="/products"
                    onClick={() => setShopOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F5F4F0] hover:bg-[#111827] hover:text-white transition-colors text-[13px] font-medium group"
                  >
                    <span>View all cartridges</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <a href="/#finder" className="nav-link">Find by printer</a>
          <a href="/#delivery" className="nav-link">Delivery</a>
          <Link href="/b2b" className="nav-link">B2B</Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {right}

          <button
            aria-label="Search products"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/8 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          {!authLoading && (
            <Link
              href={customer ? '/account/orders' : '/account/login'}
              aria-label={customer ? 'My account' : 'Sign in'}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/8 transition-colors relative"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {customer && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#dfe344]" aria-hidden />
              )}
            </Link>
          )}

          <CartButton />

          {/* Mobile hamburger */}
          <button
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/8 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ─── MOBILE DRAWER ─── */}
      {mobileOpen && (
        <>
          <div
            className="mobile-drawer-overlay"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
              <Logo width={72} variant="color" linked={false} />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/8 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-0.5">
              <button
                onClick={() => { setMobileOpen(false); setSearchOpen(true) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white text-sm font-medium transition-colors text-[#374151] cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Search cartridges
              </button>
              <Link
                href="/products"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white text-sm font-semibold transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                All cartridges
              </Link>
              <a
                href="/#finder"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white text-sm font-medium transition-colors text-[#374151]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Find by printer
              </a>
              <a
                href="/#delivery"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white text-sm font-medium transition-colors text-[#374151]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Delivery info
              </a>
              <Link
                href="/b2b"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white text-sm font-medium transition-colors text-[#374151]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                B2B pricing
              </Link>

              {/* Brand accordion */}
              <div className="pt-2">
                <button
                  onClick={() => setBrandsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white text-sm font-medium transition-colors text-[#374151]"
                  aria-expanded={brandsExpanded}
                >
                  <span className="flex items-center gap-3">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Shop by brand
                  </span>
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ transition: 'transform .25s', transform: brandsExpanded ? 'rotate(180deg)' : 'rotate(0)' }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {brandsExpanded && (
                  <div className="mt-1 grid grid-cols-2 gap-0.5 pl-2">
                    {brands.map((b) => (
                      <Link
                        key={b.name}
                        href={brandHref(b)}
                        onClick={() => setMobileOpen(false)}
                        className="px-3 py-2.5 rounded-lg text-[13px] text-[#374151] hover:bg-white hover:text-[#41e0f5] transition-colors font-medium"
                      >
                        {b.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            {/* Drawer footer — contact */}
            <div className="px-5 py-5 border-t border-black/8 space-y-2.5">
              <Link
                href={customer ? '/account/orders' : '/account/login'}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 text-sm font-medium text-[#111827] hover:text-[#41e0f5] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {customer ? `My account — ${customer.first_name ?? customer.email}` : 'Sign in'}
              </Link>
              <a
                href="tel:0117082304"
                className="flex items-center gap-2.5 text-sm text-[#6B6B66] hover:text-[#111827] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                011 708 2304
              </a>
              <a
                href="mailto:sales@tse.co.za"
                className="flex items-center gap-2.5 text-sm text-[#6B6B66] hover:text-[#111827] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
                sales@tse.co.za
              </a>
              <p className="text-[11px] text-[#9ca3af] pt-1">Mon–Fri · Kya Sands, JHB</p>
            </div>
          </div>
        </>
      )}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
