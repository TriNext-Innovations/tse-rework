'use client'

import { useState, useEffect, useRef } from 'react'
import { MockupNav } from '@/components/mockup-nav'
import './tse4.css'

const PRODUCTS = [
  { id: 'hp-106a', name: 'HP 106A Black Toner', code: 'W1106A', brand: 'HP', type: 'laser', color: 'black', price: 330, compatible: ['HP Laser 107a', 'HP Laser 107w', 'HP Laser MFP 135a', 'HP Laser MFP 137fnw'], generic: true, image: 'https://www.tse.co.za/wp-content/uploads/2020/11/106AW1106A_1K-EMEA.jpg' },
  { id: 'hp-136a', name: 'HP 136A Black Toner', code: 'W1360A', brand: 'HP', type: 'laser', color: 'black', price: 575, compatible: ['HP Laser MFP 136a', 'HP Laser MFP 136w', 'HP LaserJet MFP M236d'], generic: true, image: 'https://www.tse.co.za/wp-content/uploads/2024/08/W1360A-136A-%E8%95%AD%E6%8E%A2.jpg' },
  { id: 'hp-26a', name: 'HP 26A Black Toner', code: 'CF226A', brand: 'HP', type: 'laser', color: 'black', price: 390, compatible: ['HP LaserJet Pro M402dn', 'HP LaserJet Pro M402n', 'HP LaserJet Pro MFP M426fdw'], generic: true, image: 'https://www.tse.co.za/wp-content/uploads/2020/07/CRG-052_CF226A_3.1K-Universal.jpg' },
  { id: 'hp-85a', name: 'HP 85A Black Toner', code: 'CE285A', brand: 'HP', type: 'laser', color: 'black', price: 280, compatible: ['HP LaserJet P1102', 'HP LaserJet P1102w', 'HP LaserJet Pro M1132', 'HP LaserJet Pro M1212nf'], generic: true, image: 'https://www.tse.co.za/wp-content/uploads/2019/04/CB435A_436A_CE285A_CRG-125_312_313_325_712_713_725_912_913_925_2K-Universal.jpg' },
  { id: 'hp-680-black', name: 'HP 680 Black Ink', code: 'F6V27AA', brand: 'HP', type: 'inkjet', color: 'black', price: 230, compatible: ['HP DeskJet 1115', 'HP DeskJet 2135', 'HP DeskJet 3635', 'HP DeskJet 3775'], generic: true },
  { id: 'hp-680-colour', name: 'HP 680 Colour Ink', code: 'F6V26AA', brand: 'HP', type: 'inkjet', color: 'colour', price: 230, compatible: ['HP DeskJet 1115', 'HP DeskJet 2135', 'HP DeskJet 3635', 'HP DeskJet 3775'], generic: true },
  { id: 'bro-tn2090', name: 'Brother TN-2090 Black Toner', code: 'TN2090', brand: 'Brother', type: 'laser', color: 'black', price: 310, compatible: ['Brother HL-2130', 'Brother HL-2132', 'Brother DCP-7055', 'Brother DCP-7057'], generic: true },
  { id: 'bro-lc3319-bk', name: 'Brother LC-3319 Black Ink', code: 'LC3319BK', brand: 'Brother', type: 'inkjet', color: 'black', price: 280, compatible: ['Brother MFC-J5330DW', 'Brother MFC-J5730DW', 'Brother MFC-J6530DW'], generic: true },
  { id: 'can-725', name: 'Canon 725 Black Toner', code: 'CRG725', brand: 'Canon', type: 'laser', color: 'black', price: 300, compatible: ['Canon imageCLASS LBP6018', 'Canon LBP6030', 'Canon LBP6030W', 'Canon MF3010'], generic: true },
  { id: 'can-pg545', name: 'Canon PG-545 Black Ink', code: 'PG545', brand: 'Canon', type: 'inkjet', color: 'black', price: 240, compatible: ['Canon PIXMA MG2550', 'Canon PIXMA MG2950', 'Canon PIXMA MX495', 'Canon PIXMA TS205'], generic: true },
  { id: 'eps-t664-bk', name: 'Epson T664 Black Ink Bottle', code: 'T6641', brand: 'Epson', type: 'inkjet', color: 'black', price: 220, compatible: ['Epson L100', 'Epson L200', 'Epson L300', 'Epson L355', 'Epson L365'], generic: true },
  { id: 'kyo-tk1150', name: 'Kyocera TK-1150 Black Toner', code: 'TK-1150', brand: 'Kyocera', type: 'laser', color: 'black', price: 480, compatible: ['Kyocera ECOSYS M2135dn', 'Kyocera ECOSYS M2635dn', 'Kyocera ECOSYS P2235dn'], generic: true, badge: 'NEW' },
]

function getProductImg(p: typeof PRODUCTS[0]) {
  const isColour = p.color === 'colour'
  const bg = isColour ? '%230a0f1e' : '%230a0d15'
  const accent = isColour ? '%23e84393' : '%2300AAAA'
  const label = p.type === 'laser' ? 'LASER+TONER' : 'INK+CART.'
  const color2 = isColour ? 'COLOUR' : 'BLACK'
  const code = encodeURIComponent(p.code)
  const brand = encodeURIComponent(p.brand.toUpperCase())
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='${bg}'/%3E%3Crect width='4' height='300' fill='${accent}'/%3E%3Crect x='30' y='80' width='240' height='140' rx='0' fill='%23080c16' stroke='${accent}' stroke-width='1' opacity='.4'/%3E%3Ctext x='150' y='115' font-family='sans-serif' font-size='11' fill='${accent}' text-anchor='middle' letter-spacing='5'%3E${brand}%3C/text%3E%3Ctext x='150' y='155' font-family='sans-serif' font-size='28' font-weight='700' fill='%23f3f6fb' text-anchor='middle' letter-spacing='1'%3E${code}%3C/text%3E%3Ctext x='150' y='182' font-family='sans-serif' font-size='10' fill='%23555' text-anchor='middle' letter-spacing='3'%3E${label}+%C2%B7+${color2}%3C/text%3E%3C/svg%3E`
}

type CartItem = { id: string; name: string; code: string; brand: string; price: number; qty: number }
type ThemeState = { tse: boolean; dark: boolean }

const BRANDS = ['HP', 'BROTHER', 'CANON', 'EPSON', 'SAMSUNG', 'LEXMARK', 'MINOLTA', 'OLIVETTI', 'RICOH', 'PANTUM']
const TRUST_ITEMS = ['100% Quality Guarantee', 'Next-Day Delivery Gauteng', 'Nationwide Courier', 'WhatsApp Ordering', 'Bulk Discounts']
const WHY_ITEMS = [
  { num: '01', heading: 'EST. 1992', body: "Over 30 years supplying South African businesses and homes. We started with ribbon re-inking machines and grew into one of SA's leading generic cartridge suppliers." },
  { num: '02', heading: 'IMPORTED INKS', body: 'We source only the best imported inks and toners, tested against OEM standards. Our remanufacturing specialists are trained to exacting quality benchmarks.' },
  { num: '03', heading: 'TESTED & GUARANTEED', body: 'Every cartridge is guaranteed to work as good as or better than the original. Faulty product? Bring invoice + test printout + cartridge — we replace it on the spot.' },
  { num: '04', heading: 'SA-WIDE DELIVERY', body: 'Own drivers cover Johannesburg and Pretoria with next-day delivery for orders before 12:00 noon. Nationwide courier for all other areas — payment required on order.' },
]

export default function PocFourPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false })
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState<ThemeState>({ tse: true, dark: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function showToast(msg: string) {
    setToast({ msg, show: true })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2500)
  }

  function addToCart(id: string) {
    const p = PRODUCTS.find(x => x.id === id)
    if (!p) return
    setCart(prev => {
      const ex = prev.find(i => i.id === id)
      if (ex) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, code: p.code, brand: p.brand, price: p.price, qty: 1 }]
    })
    setAddedIds(prev => new Set(prev).add(id))
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(id); return s }), 1500)
    showToast(`${p.name} added to cart`)
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const featured = PRODUCTS.slice(0, 4)

  const wrapperClass = [
    'tse4',
    !theme.tse ? 'tse4-default' : '',
    theme.dark ? 'tse4-dark' : '',
  ].filter(Boolean).join(' ')

  const panelClass = [
    'tse4-theme-panel',
    theme.tse ? 'tse-on' : '',
    theme.dark ? 'dark-on' : '',
  ].filter(Boolean).join(' ')

  return (
  <>
    <div className={wrapperClass}>

        {/* NAV */}
        <nav className={`tse4-nav${scrolled ? ' scrolled' : ''}`}>
          <div className="tse4-nav-inner">
            <a href="#" className="tse4-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="tse4-logo-badge">
                <img src="/logo.png" alt="TSE Logo" className="tse4-logo-img" />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#888888', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cartridges</span>
            </a>
            <ul className="tse4-nav-links">
              {['Home', 'Shop', 'About', 'Delivery', 'Contact'].map((l, i) => (
                <li key={l}><a href="#" className={i === 0 ? 'active' : ''}>{l}</a></li>
              ))}
            </ul>
            <div className="tse4-nav-right">
              <a href="#" className="tse4-cart-link">
                CART{' '}
                <span className={`tse4-cart-badge${cartCount === 0 ? ' hidden' : ''}`}>{cartCount}</span>
              </a>
              <a href="https://wa.me/27798733558" className="tse4-wa-btn" target="_blank" rel="noopener">WHATSAPP ORDER</a>
            </div>
            <button className="tse4-hamburger" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <span /><span /><span />
            </button>
          </div>
        </nav>

        {/* MOBILE MENU */}
        <div className={`tse4-mobile-menu${mobileOpen ? ' open' : ''}`}>
          <span className="tse4-mob-close" onClick={() => setMobileOpen(false)}>✕ CLOSE</span>
          <ul>
            {['Home', 'Shop', 'About', 'Delivery', 'Contact'].map(l => (
              <li key={l}><a href="#" onClick={() => setMobileOpen(false)}>{l}</a></li>
            ))}
          </ul>
        </div>

        <main>

          {/* HERO */}
          <section className="tse4-hero">
            <div className="tse4-hero-left">
              <div className="tse4-hero-label">TECHNICAL SYSTEMS ENGINEERING · KYA SANDS · EST. 1992</div>
              <h1 className="tse4-hero-h1">
                QUALITY<br />
                <span className="accent">Cartridges.</span>
                GUARANTEED.
              </h1>
              <p className="tse4-hero-sub">
                Generic and original ink and toner for HP, Brother, Canon, Epson, Samsung, Lexmark, Kyocera and more.
                Next-day Gauteng delivery. 100% satisfaction guaranteed since 1992.
              </p>
              <div className="tse4-hero-cta">
                <a href="#featured" className="tse4-btn-primary">SHOP CARTRIDGES</a>
                <a href="#" className="tse4-btn-outline">GET A QUOTE</a>
              </div>
              <div className="tse4-hero-stats">
                {['Since 1992', '100% Guarantee', 'Next-Day Gauteng', '11 Brands'].map(s => (
                  <span key={s} className="tse4-hero-stat">{s}</span>
                ))}
              </div>
            </div>
            <div className="tse4-hero-right">
              <div className="tse4-hero-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1650094980833-7373de26feb6?q=80&w=1074&auto=format&fit=crop"
                  alt="HP LaserJet MFP"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x800/1a1a1a/555555?text=HP+LaserJet+Pro' }}
                />
              </div>
              <div className="tse4-hero-img-tag">HP LaserJet — Generic &amp; Original Available</div>
            </div>
          </section>

          {/* TRUST BAR */}
          <div className="tse4-trust-bar">
            {TRUST_ITEMS.map(t => <span key={t} className="tse4-trust-item">{t}</span>)}
          </div>

          {/* FEATURED PRODUCTS */}
          <section className="tse4-featured" id="featured">
            <div className="tse4-section-header">
              <div>
                <h2>BESTSELLERS</h2>
                <p>Shop our most popular cartridges</p>
              </div>
              <a href="#" className="tse4-view-all-link">VIEW ALL PRODUCTS →</a>
            </div>
            <div className="tse4-product-grid">
              {featured.map(p => (
                <div key={p.id} className="tse4-product-card">
                  <div className="tse4-card-img-wrap">
                    <img src={'image' in p && p.image ? p.image as string : getProductImg(p)} alt={p.name} loading="lazy" />
                    <span className="tse4-card-brand">{p.brand}</span>
                    {'badge' in p && p.badge && <span className="tse4-card-new">{p.badge as string}</span>}
                  </div>
                  <div className="tse4-card-body">
                    <div className="tse4-card-name">{p.name}</div>
                    <div className="tse4-card-code">{p.code}</div>
                    <div className="tse4-card-compat">{p.compatible.slice(0, 2).join(' · ')}</div>
                    <div className="tse4-card-price">R{p.price}</div>
                    <div className="tse4-card-meta">{p.generic ? 'Generic' : 'Original'} · {p.type === 'laser' ? 'Laser Toner' : 'Inkjet'}</div>
                    <button
                      className={`tse4-btn-atc${addedIds.has(p.id) ? ' added' : ''}`}
                      onClick={() => addToCart(p.id)}
                    >
                      {addedIds.has(p.id) ? '✓ ADDED' : 'ADD TO CART'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="tse4-view-all-wrap">
              <a href="#" className="tse4-btn-primary" style={{ fontSize: '1rem', padding: '12px 40px' }}>
                VIEW ALL PRODUCTS →
              </a>
            </div>
          </section>

          {/* BRANDS */}
          <section className="tse4-brands-strip">
            <div className="tse4-brands-label">BRANDS WE STOCK</div>
            <div className="tse4-brands-list">
              {BRANDS.map(b => <a key={b} href="#" className="tse4-brand-link">{b}</a>)}
              <a href="#" className="tse4-brand-link">KYOCERA<span className="tse4-brand-new">NEW</span></a>
            </div>
          </section>

          {/* COMPATIBILITY FINDER */}
          <section className="tse4-compat">
            <div className="tse4-compat-img">
              <img
                src="https://images.unsplash.com/photo-1650094980833-7373de26feb6?q=80&w=1074&auto=format&fit=crop"
                alt="Printer"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x480/0d0e1a/333355?text=Printer' }}
              />
            </div>
            <div className="tse4-compat-content">
              <div className="tse4-compat-label">FIND YOUR CARTRIDGE</div>
              <h2 className="tse4-compat-h2">Compatible with over 200 printer models</h2>
              <p className="tse4-compat-body">
                We stock cartridges for legacy and current models. Search by cartridge code — enter numbers only
                for best results e.g. &ldquo;106A&rdquo; not &ldquo;HP 106A&rdquo;.
              </p>
              <form
                className="tse4-search-bar"
                onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) showToast(`Searching for "${searchQuery}"…`) }}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. 106A, TN2090, PG545…"
                  autoComplete="off"
                />
                <button type="submit">SEARCH</button>
              </form>
            </div>
          </section>

          {/* WHY TSE */}
          <section className="tse4-why">
            <div className="tse4-section-header">
              <div>
                <h2>WHY CHOOSE TSE</h2>
                <p>South Africa&apos;s trusted generic cartridge supplier</p>
              </div>
            </div>
            <div className="tse4-why-grid">
              {WHY_ITEMS.map(item => (
                <div key={item.num} className="tse4-why-item">
                  <div className="tse4-why-num">{item.num}</div>
                  <div className="tse4-why-heading">{item.heading}</div>
                  <p className="tse4-why-body">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="tse4-footer">
          <div className="tse4-footer-grid">
            <div className="tse4-footer-col">
              <div className="tse4-footer-logo">T<span className="tse4-footer-logo-s">S</span>E</div>
              <div className="tse4-footer-brand-sub">Technical Systems Engineering CC</div>
              <address>
                Unit 34, A.P.D. Industrial Park<br />
                Cnr Bernie &amp; Elsecar Str<br />
                Kya Sands, 2169, Gauteng<br /><br />
                Tel: +27 11 708 2304 / +27 11 708 2305<br />
                Cell: +27 79 873 3558<br />
                <a href="mailto:sales@tse.co.za">sales@tse.co.za</a>
              </address>
              <a href="https://wa.me/27734794851" className="tse4-footer-wa" target="_blank" rel="noopener">
                WhatsApp: 073 794 8451
              </a>
            </div>
            <div className="tse4-footer-col">
              <h4>Shop</h4>
              <ul>
                {['HP Cartridges', 'Brother Cartridges', 'Canon Cartridges', 'Epson Cartridges', 'Samsung Toner', 'Kyocera Toner'].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>
            <div className="tse4-footer-col">
              <h4>Information</h4>
              <ul>
                {['About TSE', 'Our Guarantee', 'Delivery & Payment', 'Bulk Orders', 'Contact Us'].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>
            <div className="tse4-footer-col">
              <div className="tse4-footer-hours-label">TRADING HOURS</div>
              <div className="tse4-hours-list">
                <div>Mon–Thu: <span>08:00–16:30</span></div>
                <div>Friday: <span>08:00–15:00</span></div>
                <div>Saturday: <span>Closed</span></div>
              </div>
              <div className="tse4-footer-wa-note">WhatsApp orders accepted anytime</div>
            </div>
          </div>
          <div className="tse4-footer-bottom">
            <span>© 2025 Technical Systems Engineering CC · Kya Sands, Gauteng, South Africa</span>
            <div className="tse4-footer-badges">
              <span>Est. 1992</span>
              <span>Proudly South African</span>
              <span>Eco Responsible</span>
            </div>
          </div>
        </footer>

        {/* TOAST */}
        <div className={`tse4-toast${toast.show ? ' show' : ''}`}>{toast.msg}</div>

        {/* BACK TO HUB */}
        <a href="/" className="tse4-back">← BACK TO POCS</a>

        {/* THEME TOGGLE PANEL */}
        <div className={panelClass}>
          <div
            className={`tse4-tgl-row${theme.tse ? ' tse-active' : ''}`}
            onClick={() => setTheme(t => ({ ...t, tse: !t.tse }))}
          >
            <span className="tse4-tgl-label">TSE THEME</span>
            <span className="tse4-tgl-pill" />
          </div>
          <div
            className={`tse4-tgl-row${theme.dark ? ' dark-active' : ''}`}
            onClick={() => setTheme(t => ({ ...t, dark: !t.dark }))}
          >
            <span className="tse4-tgl-label">DARK MODE</span>
            <span className="tse4-tgl-pill" />
          </div>
        </div>

      </div>
    <MockupNav />
  </>
  )
}
