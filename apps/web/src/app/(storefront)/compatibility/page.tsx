import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Logo } from '@/components/layout'
import { CompatSearch } from './CompatSearch'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const BRAND_CHIPS = [
  'HP', 'Canon', 'Epson', 'Brother', 'Samsung',
  'Lexmark', 'Xerox', 'Pantum', 'Ricoh', 'Kyocera',
  'Konica Minolta', 'OKI',
]

export const metadata: Metadata = {
  title: 'Find Cartridges for Your Printer — TSE Online',
  description: 'Search by printer model and instantly see compatible generic cartridges. Quality guaranteed.',
}

async function searchCompatibility(model: string): Promise<any[]> {
  if (!model) return []
  try {
    const params = new URLSearchParams({ model })
    const res = await fetch(`${BACKEND}/store/compatibility?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 60 },
    })
    const d = await res.json()
    return (d.results ?? []) as any[]
  } catch {
    return []
  }
}

async function fetchSuggestions(): Promise<string[]> {
  try {
    const res = await fetch(`${BACKEND}/store/compatibility/models`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return (d.models ?? []).map((m: { brand: string; model: string }) => `${m.brand} ${m.model}`)
  } catch {
    return []
  }
}

type Props = { searchParams: Promise<{ model?: string }> }

export default async function CompatibilityPage({ searchParams }: Props) {
  const { model = '' } = await searchParams
  const [results, suggestions] = await Promise.all([
    model ? searchCompatibility(model) : Promise.resolve([]),
    fetchSuggestions(),
  ])

  const hasResults = results.length > 0

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[#F5F4F0]/90 backdrop-blur-xl border-b border-black/8 px-4 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl flex items-center justify-between h-14">
          <Link href="/">
            <Logo width={72} variant="color" linked={false} />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-[#374151]">
            <Link href="/products" className="hover:text-[#111827] transition-colors">Shop</Link>
            <Link href="/compatibility" className="font-medium text-[#111827]">Find by printer</Link>
          </nav>
          <Link href="/" className="text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors">
            ← Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="px-4 sm:px-8 lg:px-12 pt-14 pb-14">
        <div className="mx-auto max-w-7xl">

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[#dfe344]/20 border border-[#dfe344]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dfe344]" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-medium">Compatibility Search</span>
            </div>

            <h1 className="font-display font-light text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-4">
              Find cartridges<br />
              for your <span className="font-display-italic">printer</span>
            </h1>
            <p className="text-[#4B4B46] text-base mb-8 leading-relaxed max-w-md">
              Enter your printer model and we&apos;ll show you every compatible generic cartridge we stock — guaranteed to work.
            </p>

            {/* Search form — works without JS via GET redirect */}
            <Suspense fallback={
              <form action="/compatibility" method="GET" className="flex gap-3 max-w-xl">
                <input
                  name="model"
                  defaultValue={model}
                  placeholder="e.g. HP LaserJet 1020"
                  className="flex-1 px-4 py-3 rounded-[14px] bg-white border border-black/8 text-sm outline-none"
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-[14px] bg-[#111827] text-white text-sm font-medium"
                >
                  Search
                </button>
              </form>
            }>
              <CompatSearch initialQuery={model} suggestions={suggestions} />
            </Suspense>
          </div>

          {/* Brand quick-filters */}
          {!model && (
            <div className="mt-10">
              <p className="text-xs text-[#6B6B66] uppercase tracking-[0.16em] mb-3">Search by brand</p>
              <div className="flex flex-wrap gap-2">
                {BRAND_CHIPS.map((brand) => (
                  <Link
                    key={brand}
                    href={`/compatibility?model=${encodeURIComponent(brand)}`}
                    className="px-4 py-1.5 rounded-full border border-black/15 text-sm text-[#374151] hover:border-[#111827] hover:text-[#111827] transition-colors"
                  >
                    {brand}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results / empty state */}
      {model && (
        <div className="px-4 sm:px-8 lg:px-12 pb-16">
          <div className="mx-auto max-w-7xl">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[#6B6B66] mb-6">
              <Link href="/compatibility" className="hover:text-[#111827] transition-colors">All printers</Link>
              <span>/</span>
              <span className="text-[#111827]">{model}</span>
            </div>

            {hasResults ? (
              <>
                <p className="text-sm text-[#6B6B66] mb-6">
                  {results.length} cartridge{results.length !== 1 ? 's' : ''} compatible with <strong className="text-[#111827]">{model}</strong>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {results.map((r: any, i: number) => {
                    // API returns: { sku, printer_brand, printer_model, handle, title, thumbnail }
                    // handle/title/thumbnail are null until products are seeded
                    const href = r.handle ? `/products/${r.handle}` : `/products?q=${encodeURIComponent(r.sku)}`
                    const label = r.title ?? `${r.printer_brand} — ${r.printer_model}`

                    return (
                      <Link
                        key={`${r.printer_model}-${r.sku}`}
                        href={href}
                        className="group bg-white rounded-[16px] p-4 hover:-translate-y-1 transition-transform duration-300"
                      >
                        <div className="relative h-28 flex items-center justify-center mb-3">
                          {r.thumbnail ? (
                            <Image
                              src={r.thumbnail}
                              alt={label}
                              width={112}
                              height={112}
                              className="h-24 w-auto object-contain"
                            />
                          ) : (
                            <div
                              className={`w-16 h-24 rounded-[6px] shadow-[0_12px_24px_-12px_rgba(10,10,10,0.35)] relative overflow-hidden ${
                                i % 4 === 0 ? 'bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A]' :
                                i % 4 === 1 ? 'bg-gradient-to-br from-[#41e0f5] to-[#0fb8d4]' :
                                i % 4 === 2 ? 'bg-gradient-to-br from-[#1a1a2e] to-[#3a3a5c]' :
                                'bg-gradient-to-br from-[#2d1a0e] to-[#5a3520]'
                              }`}
                            >
                              <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/25" />
                              <span className="absolute bottom-2 left-2 font-display text-white text-[9px]">TSE</span>
                            </div>
                          )}
                        </div>

                        <h2 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{label}</h2>
                        <div className="text-[10px] text-[#9ca3af] mb-3">SKU {r.sku}</div>
                        <div className="text-[10px] text-[#6B6B66]">{r.printer_brand} · {r.printer_model}</div>
                      </Link>
                    )
                  })}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="text-center py-24 max-w-md mx-auto">
                <div className="font-display text-5xl mb-4 opacity-20">?</div>
                <h2 className="font-display font-light text-2xl mb-2">
                  No results for <span className="font-display-italic">&ldquo;{model}&rdquo;</span>
                </h2>
                <p className="text-sm text-[#6B6B66] mb-8 leading-relaxed">
                  We couldn&apos;t find a match in our database. Our team can help — call or WhatsApp us and we&apos;ll find the right cartridge for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href={siteConfig.whatsapp.tel}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#111827] text-white text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors"
                  >
                    Call {siteConfig.whatsapp.display}
                  </a>
                  <a
                    href={siteConfig.email.mailto}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-black/15 text-sm text-[#374151] hover:border-black/40 transition-colors"
                  >
                    Email us
                  </a>
                </div>
                <div className="mt-8">
                  <Link
                    href="/compatibility"
                    className="text-sm text-[#6B6B66] hover:text-[#111827] transition-colors"
                  >
                    ← Try a different model
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How it works — shown only on landing state */}
      {!model && (
        <div className="px-4 sm:px-8 lg:px-12 pb-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-black/8">
              {[
                { step: '01', heading: 'Enter your printer', body: 'Type your printer brand and model — e.g. "HP LaserJet 1020" or "Canon PIXMA G3410".' },
                { step: '02', heading: 'See compatible cartridges', body: 'We show every generic cartridge in our range that works with your printer, with price and SKU.' },
                { step: '03', heading: 'Add to cart', body: 'Order online or call us. Order before noon for next-day delivery to JHB/PTA.' },
              ].map(({ step, heading, body }) => (
                <div key={step} className="flex flex-col gap-3">
                  <div className="font-display text-5xl text-[#111827]/8 leading-none">{step}</div>
                  <h3 className="font-display text-lg">{heading}</h3>
                  <p className="text-sm text-[#6B6B66] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
