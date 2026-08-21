import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout'
import { fetchPrinterModels, groupByBrand, printerSlug } from '@/lib/printers'
import { websiteRef } from '@/lib/structured-data'

const BASE = 'https://tse-cartridges.co.za'

// Rendered per request rather than at build. Statically prerendering this page
// bakes in whatever the build could reach: a build without the backend ships
// the "temporarily unavailable" branch and keeps serving it until the first
// revalidation. The underlying fetch is still cached for an hour, so the cost
// of going dynamic is a re-render, not a round trip.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const models = await fetchPrinterModels()
  const description = models.length
    ? `Find the right cartridge for your printer. ${models.length} printer models covered, from HP and Canon to Kyocera and Pantum.`
    : 'Find the right cartridge for your printer.'
  return {
    title: 'Printers we carry cartridges for',
    description,
    alternates: { canonical: `${BASE}/printers` },
    openGraph: { type: 'website', url: `${BASE}/printers`, title: 'Printers we carry cartridges for', description },
  }
}

export default async function PrintersIndexPage() {
  const models = await fetchPrinterModels()
  const groups = groupByBrand(models)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Printers we carry cartridges for',
    url: `${BASE}/printers`,
    isPartOf: websiteRef,
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-[var(--font-inter)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            <li aria-current="page" className="text-[var(--ink)]">Printers</li>
          </ol>
        </nav>

        <header className="mb-12 max-w-2xl">
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Printers we carry <span className="font-display-italic">cartridges for</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
            {models.length > 0
              ? `${models.length} printer models across ${groups.length} brands. Pick yours to see every cartridge we stock that fits it.`
              : 'Printer list is temporarily unavailable — search by model instead.'}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Know the model already?{' '}
            <Link href="/compatibility" className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
              Search by printer
            </Link>
            .
          </p>
        </header>

        {/* Every model as a plain link. This is the crawl hub for the printer
            pages — without it they exist in the sitemap but nothing on the site
            points at them, which is a weak signal to a search engine. */}
        {groups.map((g) => (
          <section key={g.brand} className="mb-10">
            <h2 className="font-display text-xl mb-3">
              {g.brand} <span className="text-sm text-[var(--muted)]">({g.models.length})</span>
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
              {g.models.map((m) => (
                <li key={`${m.brand}-${m.model}`}>
                  <Link
                    href={`/printers/${printerSlug(m.brand, m.model)}`}
                    className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-[var(--line-4)]"
                  >
                    {m.model}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
