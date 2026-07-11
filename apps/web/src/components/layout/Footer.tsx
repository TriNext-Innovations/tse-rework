import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { Logo } from './Logo'

const BRANDS = [
  'HP', 'Canon', 'Epson', 'Brother', 'Samsung',
  'Lexmark', 'Xerox', 'Pantum', 'Ricoh', 'Kyocera',
  'Konica Minolta', 'OKI',
]

const SHOP_LINKS = [
  { label: 'Inkjet cartridges', href: '/products?type=inkjet' },
  { label: 'Laser toner', href: '/products?type=laser' },
  { label: 'All cartridges', href: '/products' },
  { label: 'Find my cartridge', href: '/compatibility' },
  { label: 'B2B & business pricing', href: '/b2b' },
  { label: 'Request a quote', href: '/b2b/quote' },
]

const HELP_LINKS = [
  { label: 'Delivery info', href: '/#delivery' },
  { label: 'Returns & guarantee', href: '/#bento' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Privacy policy', href: '/legal/privacy' },
  { label: 'Cookie policy', href: '/legal/cookies' },
  { label: 'Contact us', href: siteConfig.email.mailto },
]

export function Footer() {
  return (
    <footer className="bg-[#111827] text-white">
      <style>{`
        .footer-font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .footer-font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .brand-strip-track { animation: marquee 28s linear infinite; will-change: transform; }
        .brand-strip-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Brand compatibility strip */}
      <div className="border-b border-white/8 py-4 overflow-hidden">
        <div className="flex brand-strip-track w-max gap-3 px-3">
          {[...BRANDS, ...BRANDS].map((brand, i) => (
            <Link
              key={i}
              href="/products"
              className="flex-shrink-0 px-4 py-1.5 rounded-full border border-white/15 text-[11px] uppercase tracking-[0.18em] text-white/60 hover:border-[#41e0f5]/50 hover:text-[#41e0f5] transition-colors whitespace-nowrap"
            >
              {brand}
            </Link>
          ))}
        </div>
      </div>

      {/* Main footer grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <div className="mb-5">
              <Logo width={88} variant="dark-bg" linked={false} />
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-4 max-w-[220px]">
              Quality generic printer cartridges for all major brands — guaranteed to work as good as the original.
            </p>
            <p className="text-xs text-white/35 leading-relaxed">
              Technical Systems Engineering<br />
              Est. 1987 · Kya Sands, JHB
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-4">Shop</h3>
            <ul className="space-y-2.5">
              {SHOP_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/65 hover:text-[#41e0f5] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-4">Help</h3>
            <ul className="space-y-2.5">
              {HELP_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/65 hover:text-[#41e0f5] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Hours */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-4">Contact</h3>
            <ul className="space-y-2.5 text-sm text-white/65">
              <li>
                <a href={siteConfig.whatsapp.tel} className="hover:text-[#41e0f5] transition-colors">
                  {siteConfig.whatsapp.display}
                </a>
              </li>
              <li>
                <a href={siteConfig.phone.tel} className="hover:text-[#41e0f5] transition-colors">
                  {siteConfig.phone.displayExt}
                </a>
              </li>
              <li>
                <a href={siteConfig.email.mailto} className="hover:text-[#41e0f5] transition-colors">
                  {siteConfig.email.sales}
                </a>
              </li>
              <li className="pt-3 border-t border-white/8">
                <span className="text-white/35 text-[10px] uppercase tracking-[0.15em] block mb-2">Hours</span>
                <span>Mon–Thu · 8am–4:30pm</span>
              </li>
              <li>Fri · 8am–3pm</li>
              <li className="text-white/40 text-xs leading-relaxed pt-2">
                Order before noon for same-day dispatch. Next-day delivery JHB/PTA.
              </li>
            </ul>
          </div>

        </div>

        {/* Address bar */}
        <div className="mt-10 pt-6 border-t border-white/8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-white/35">
          <span>Unit 34, A.P.D. Industrial Park, Kya Sands, Johannesburg</span>
          <span className="hidden sm:block">·</span>
          <span>Prices include VAT</span>
          <span className="hidden sm:block">·</span>
          <span>South Africa only</span>
        </div>

        {/* Copyright bar */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} TSE Online. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <Link href="/legal/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/legal/cookies" className="hover:text-white/50 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
