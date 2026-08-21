import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout'
import {
  findCartridges,
  findPrinterBySlug,
  printerLabel,
  printerSlug,
  fetchPrinterModels,
  withPricing,
  type CompatibleCartridge,
  type PrinterModel,
} from '@/lib/printers'
import { AddToCartButton } from '../../products/AddToCartButton'

const BASE = 'https://tse-cartridges.co.za'

type Props = { params: Promise<{ slug: string }> }

// No generateStaticParams — same reason as the category pages: CI builds the
// image with no backend reachable, so prerendering 903 routes would resolve
// every one to its empty-result notFound() and ship them as cached 404s.

/**
 * Counted from the cartridges actually listed, never from the model's
 * `cartridge_count`. That field counts SKUs (one per colour) while the lookup
 * returns grouped products — on a 4-colour printer it says 8 where the page
 * shows 2. Rendering it would put a contradiction on the page.
 */
function lede(printer: PrinterModel, cartridges: CompatibleCartridge[]): string {
  const n = cartridges.length
  const noun = n === 1 ? 'cartridge' : 'cartridges'
  return `${n} generic ${noun} in the TSE range fit the ${printerLabel(printer)}.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const printer = await findPrinterBySlug(slug)
  if (!printer) return {}
  const cartridges = await findCartridges(printer.brand, printer.model)
  if (cartridges.length === 0) return {}

  const label = printerLabel(printer)
  const url = `${BASE}/printers/${slug}`
  const title = `${label} cartridges`
  const description = `${lede(printer, cartridges)} Compatible replacements with SKU and price, delivered across South Africa.`
  // "with SKU and price" is only true because the cards below are enriched by
  // withPricing(). If that enrichment is ever dropped, this line becomes a
  // claim the page does not honour — change both together.

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description },
    twitter: { card: 'summary', title, description },
  }
}

export default async function PrinterPage({ params }: Props) {
  const { slug } = await params
  const printer = await findPrinterBySlug(slug)
  if (!printer) notFound()

  const found = await findCartridges(printer.brand, printer.model)
  // A printer page with nothing to sell is thin content and a dead end for a
  // shopper who arrived on a buying query. 404 rather than publish it.
  if (found.length === 0) notFound()
  const cartridges = await withPricing(found)

  const label = printerLabel(printer)
  const url = `${BASE}/printers/${slug}`

  // Other models of the same brand, for internal linking between printer pages.
  const all = await fetchPrinterModels()
  const siblings = all
    .filter((m) => m.brand === printer.brand && m.model !== printer.model)
    .slice(0, 24)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'Home', item: BASE },
      { name: 'Printers', item: `${BASE}/printers` },
      { name: label, item: url },
    ].map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.item })),
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} cartridges`,
    url,
    description: lede(printer, cartridges),
    isPartOf: { '@type': 'WebSite', name: 'TSE Online', url: BASE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cartridges.length,
      itemListElement: cartridges.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.title,
        url: `${BASE}/products/${c.handle}`,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-[var(--font-inter)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-32 pb-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[var(--muted)]">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-[var(--ink)] transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/printers" className="hover:text-[var(--ink)] transition-colors">Printers</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--ink)]">{label}</li>
          </ol>
        </nav>

        <header className="mb-10 max-w-2xl">
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            {label} <span className="font-display-italic">cartridges</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
            {lede(printer, cartridges)}
          </p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {cartridges.map((c, i) => (
            <Link
              key={c.product_id ?? c.sku}
              href={`/products/${c.handle}`}
              className="group relative bg-[var(--surface)] rounded-[16px] p-4 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="relative h-28 flex items-end justify-center mb-3">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    width={180}
                    height={220}
                    sizes="180px"
                    className="h-31 w-auto object-contain"
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
                  </div>
                )}
              </div>
              <h2 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{c.title}</h2>
              <div className="text-[10px] text-[var(--muted-2)] mb-3">SKU {c.sku}</div>

              <div className="flex items-end justify-between">
                <div className="font-display text-lg">
                  {typeof c.price === 'number'
                    ? `R${Math.round(c.price)}`
                    : <span className="text-[var(--muted-2)] text-sm">POA</span>}
                </div>
                <AddToCartButton
                  id={c.product_id}
                  title={c.title}
                  sku={c.sku}
                  price={typeof c.price === 'number' ? Math.round(c.price) : null}
                  variantId={c.variantId ?? undefined}
                  thumbnail={c.image ?? undefined}
                />
              </div>
            </Link>
          ))}
        </div>

        {/* The same set as plain text links, so the cartridge names for this
            printer are in the HTML as words a search engine can match. */}
        <section className="mt-16 border-t border-[var(--line-4)] pt-8">
          <h2 className="font-display text-xl mb-4">Cartridges that fit the {label}</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
            {cartridges.map((c) => (
              <li key={`link-${c.product_id ?? c.sku}`}>
                <Link href={`/products/${c.handle}`} className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-[var(--line-4)]">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {siblings.length > 0 && (
          <section className="mt-12 border-t border-[var(--line-4)] pt-8">
            <h2 className="font-display text-xl mb-4">Other {printer.brand} printers</h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
              {siblings.map((m) => (
                <li key={`${m.brand}-${m.model}`}>
                  <Link href={`/printers/${printerSlug(m.brand, m.model)}`} className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-[var(--line-4)]">
                    {m.model}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              <Link href="/printers" className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
                All printers we carry cartridges for
              </Link>
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
