import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-secondary text-brand-secondary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">

          {/* Brand column */}
          <div className="space-y-4">
            {/* White pill keeps the colourful logo visible on the dark footer */}
            <Logo width={100} variant="dark-bg" linked={false} />
            <p className="text-sm text-white/60 leading-relaxed">
              South Africa&apos;s trusted supplier of printer cartridges since 1987.
              OEM &amp; compatible options for all major brands.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Shop</h3>
            <ul className="space-y-2 text-sm text-white/70">
              {['HP Cartridges', 'Canon Cartridges', 'Epson Cartridges', 'Brother Cartridges', 'All Brands'].map(l => (
                <li key={l}><a href="/shop" className="hover:text-brand-primary transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Help</h3>
            <ul className="space-y-2 text-sm text-white/70">
              {['Find Your Cartridge', 'Delivery Info', 'Returns Policy', 'FAQ', 'Contact Us'].map(l => (
                <li key={l}><a href="/" className="hover:text-brand-primary transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Contact</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>Kya Sands, Johannesburg</li>
              <li><a href="mailto:sales@tse.co.za" className="hover:text-brand-primary transition-colors">sales@tse.co.za</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} TSE Online. All rights reserved.</p>
          <p>Prices include VAT. South Africa only.</p>
        </div>
      </div>
    </footer>
  )
}
