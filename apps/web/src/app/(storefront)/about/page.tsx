import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { ORGANIZATION_ID, SITE_URL, organizationRef, websiteRef } from '@/lib/structured-data'
import { Navbar } from '@/components/layout'
import { PremisesPhoto } from '@/components/about/PremisesPhoto'
import { siteUrl } from '@/lib/site-url'

// AWStats, Sep 2026: /about-us/ was requested 40 times in a month and 404'd,
// plus /about-us 9 and /about 1 (#478). A cartridge is often a distress
// purchase, and the category is full of thin drop-shippers, so this page has
// one job: show that TSE is a real business with a real counter.
//
// Every claim below is already published elsewhere on the site — the terms
// (§1, §2), the help page, the contact page, the homepage — and the business
// details come from site-config.ts. Change a fact there first. No staff names,
// customer counts, testimonials or awards: none have been supplied.
//
// No imagery. Product photos on this store are supplier stock; an about page
// illustrated with stock undermines itself. <PremisesPhoto /> is the one slot
// for a real photograph and renders nothing until the client supplies one.

const TITLE = 'About TSE'
const DESCRIPTION = `Family-run printer cartridge supplier in Kya Sands, Johannesburg, since ${siteConfig.company.foundedYear}. What generic cartridges are, and where to find us.`

const OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630 }

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: siteUrl('/about') },
  openGraph: {
    type: 'website',
    siteName: siteConfig.company.brandName,
    locale: 'en_ZA',
    url: siteUrl('/about'),
    title: `${TITLE} — ${siteConfig.company.brandName}`,
    description: DESCRIPTION,
    // A page-level openGraph object replaces the root one, so the sitewide
    // image from app/opengraph-image.tsx has to be named again here.
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} — ${siteConfig.company.brandName}`,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
}

// No business facts here — the entity is emitted once, sitewide, by the root
// layout. This node only says "this page is about that entity".
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: `About ${siteConfig.company.brandName}`,
  url: `${SITE_URL}/about`,
  isPartOf: websiteRef,
  about: organizationRef,
  mainEntity: { '@id': ORGANIZATION_ID },
}

const ADDRESS = siteConfig.address
const YEAR = siteConfig.company.foundedYear

const FACTS = [
  { value: YEAR, label: 'Supplying printer consumables in South Africa' },
  { value: ADDRESS.suburb, label: 'Our premises in Johannesburg — collection is free' },
  { value: 'Family-run', label: 'Supplying offices, schools and print shops' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .prose h2 { margin-top: 2.75rem; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 400; scroll-margin-top: 7rem; }
        .prose p { margin-bottom: 1rem; line-height: 1.7; }
        .prose section > ul { margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .prose section > ul > li { margin-bottom: 0.5rem; line-height: 1.65; }
        .prose a { text-decoration: underline; text-underline-offset: 3px; }
        .prose a:hover { color: #41e0f5; }
      `}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">About TSE</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            A real shop, <span className="font-display-italic">since {YEAR}.</span>
          </h1>
          <p className="mt-5 text-[15px] text-[var(--ink-2)] leading-relaxed">
            {siteConfig.company.legalName} has supplied printer consumables in South Africa since {YEAR}.
            We&apos;re family-run, from our unit in {ADDRESS.suburb}, Johannesburg — you can walk in and
            collect your order, and when you phone, there is a person on the other end.
          </p>
        </div>

        <dl className="grid sm:grid-cols-3 border-y border-[var(--line-3)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--line-3)]">
          {FACTS.map(({ value, label }) => (
            <div key={label} className="py-5 sm:px-5 first:sm:pl-0 last:sm:pr-0">
              <dt className="font-display font-light text-3xl tracking-tight leading-none">{value}</dt>
              <dd className="mt-2 text-sm text-[var(--ink-2)] leading-snug">{label}</dd>
            </div>
          ))}
        </dl>

        <div className="prose text-[var(--ink-2)] text-[15px]">
          <section aria-labelledby="premises">
            <h2 id="premises" className="font-display text-[var(--ink)]">Where to find us</h2>
            <p>
              We are not an online-only shop. Our counter is in {ADDRESS.suburb} Industrial, and collection
              from here is always free.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-[16px] border border-[var(--line-3)] p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">Address</div>
                <address className="not-italic text-[15px] leading-relaxed text-[var(--ink)]">
                  {ADDRESS.street}<br />
                  {ADDRESS.suburb}, {ADDRESS.city} {ADDRESS.postalCode}<br />
                  {ADDRESS.country}
                </address>
              </div>
              <div className="rounded-[16px] border border-[var(--line-3)] p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">Counter hours</div>
                <ul className="text-[15px] leading-relaxed text-[var(--ink)]">
                  {siteConfig.openingHours.map((h) => (
                    <li key={h.label}>
                      {h.label} · {h.display}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p>
              Not sure which cartridge you need? WhatsApp{' '}
              <a href={siteConfig.whatsapp.href} target="_blank" rel="noopener noreferrer">
                {siteConfig.whatsapp.display}
              </a>{' '}
              with a photo of your old one, or call{' '}
              <a href={siteConfig.phone.tel}>{siteConfig.phone.display}</a>. Every way to reach us is on the{' '}
              <Link href="/contact">contact page</Link>.
            </p>
            <PremisesPhoto />
          </section>

          <section aria-labelledby="generic">
            <h2 id="generic" className="font-display text-[var(--ink)]">What a generic cartridge is</h2>
            <p>
              A generic — or compatible — cartridge is made by a third party to fit specific printers. It is
              not made by the printer manufacturer, and we don&apos;t claim otherwise: brand names on this
              site only tell you which printers a cartridge fits.
            </p>
          </section>

          <section aria-labelledby="not-a-compromise">
            <h2 id="not-a-compromise" className="font-display text-[var(--ink)]">Why it isn&apos;t a compromise</h2>
            <ul>
              <li>
                <strong>Made to spec for each printer model.</strong> Search your printer in the{' '}
                <Link href="/compatibility">cartridge finder</Link> and it lists the cartridges that fit it.
              </li>
              <li>
                <strong>A fraction of the original-brand price.</strong>
              </li>
              <li>
                <strong>Your printer&apos;s warranty stays intact.</strong> A manufacturer may not void a
                warranty simply because you used another supplier&apos;s consumable.
              </li>
              <li>
                <strong>Covered if one fails.</strong> A faulty cartridge is covered for 6 months from
                delivery: repair, replacement or refund, your choice. See{' '}
                <Link href="/legal/returns">returns &amp; refunds</Link>.
              </li>
            </ul>
          </section>

          <section aria-labelledby="who">
            <h2 id="who" className="font-display text-[var(--ink)]">Who we supply</h2>
            <p>
              Offices, schools and print shops buy from us on business pricing —{' '}
              <Link href="/b2b/quote">request a quote</Link> or call{' '}
              <a href={siteConfig.phone.tel}>{siteConfig.phone.display}</a>. If it&apos;s one printer at home
              that has just run dry, order before noon for same-day dispatch; we deliver countrywide with
              The Courier Guy.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
          <Link href="/compatibility" className="hover:text-[var(--ink)] transition-colors">Find my cartridge</Link>
          <Link href="/help" className="hover:text-[var(--ink)] transition-colors">Help centre</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
