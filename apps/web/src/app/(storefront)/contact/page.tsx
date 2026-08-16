import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

// Google Merchant Center requires contact details a reviewer can actually see.
// Two problems this page solves:
//
//  1. There was no contact page at all — only a mailto: in the footer.
//  2. Cloudflare's Email Address Obfuscation rewrites mailto: links and inline
//     addresses into a /cdn-cgi/l/email-protection stub, so the address is absent
//     from the served HTML. Cloudflare documents `<!--email_off-->` as the opt-out,
//     which needs a real HTML comment — hence dangerouslySetInnerHTML for that one
//     span. Phone, WhatsApp and the physical address are never obfuscated, so they
//     are plain text and satisfy the requirement on their own.
//
// JSON-LD repeats the same details in a form Google parses directly.

export const metadata: Metadata = {
  title: 'Contact Us — TSE Online',
  description:
    'Phone, WhatsApp, email and physical address for TSE Online — printer cartridge supplier in Kya Sands, Johannesburg. Trading since 1987.',
}

const ADDRESS = {
  street: 'Unit 34, A.P.D. Industrial Park, Cnr Bernie & Elsecar Street',
  suburb: 'Kya Sands',
  city: 'Johannesburg',
  postalCode: '2163',
  country: 'South Africa',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: siteConfig.company.legalName,
  alternateName: siteConfig.company.tradingName,
  url: 'https://tse-cartridges.co.za',
  telephone: '+27117082304',
  email: siteConfig.email.sales,
  address: {
    '@type': 'PostalAddress',
    streetAddress: ADDRESS.street,
    addressLocality: ADDRESS.suburb,
    addressRegion: 'Gauteng',
    postalCode: ADDRESS.postalCode,
    addressCountry: 'ZA',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '17:00',
    },
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: '+27117082304',
      email: siteConfig.email.sales,
      areaServed: 'ZA',
      availableLanguage: ['en'],
    },
  ],
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Get in touch</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Contact <span className="font-display-italic">us</span>
          </h1>
          <p className="mt-5 text-[15px] text-[var(--ink-2)] leading-relaxed">
            Not sure which cartridge fits your printer, chasing an order, or need a trade price?
            Phone or WhatsApp is fastest — there is a person on the other end, in Johannesburg.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={siteConfig.phone.tel}
            className="block rounded-[16px] border border-[var(--line-3)] p-5 hover:border-[var(--ink)] transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">Phone</div>
            <div className="font-display text-xl">{siteConfig.phone.displayExt}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Mon–Fri, 08:00–17:00</div>
          </a>

          <a
            href={siteConfig.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-[16px] border border-[var(--line-3)] p-5 hover:border-[var(--ink)] transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">WhatsApp</div>
            <div className="font-display text-xl">{siteConfig.whatsapp.display}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Send us a photo of your cartridge</div>
          </a>

          <a
            href={siteConfig.email.mailto}
            className="block rounded-[16px] border border-[var(--line-3)] p-5 hover:border-[var(--ink)] transition-colors"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">Email</div>
            {/* Opt this address out of Cloudflare email obfuscation so it stays in the
                served HTML — otherwise crawlers and Google's reviewer see a stub. */}
            <div
              className="font-display text-xl break-all"
              dangerouslySetInnerHTML={{ __html: `<!--email_off-->${siteConfig.email.sales}<!--/email_off-->` }}
            />
            <div className="text-xs text-[var(--muted)] mt-1">We reply within one business day</div>
          </a>

          <div className="block rounded-[16px] border border-[var(--line-3)] p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-2">Collect in person</div>
            <address className="not-italic text-[15px] leading-relaxed">
              {ADDRESS.street}<br />
              {ADDRESS.suburb}, {ADDRESS.city} {ADDRESS.postalCode}<br />
              {ADDRESS.country}
            </address>
            <div className="text-xs text-[var(--muted)] mt-2">Collection is free — no delivery charge</div>
          </div>
        </div>

        <div className="mt-10 rounded-[16px] bg-[var(--surface)] p-6">
          <h2 className="font-display text-xl mb-3">Before you call about an order</h2>
          <p className="text-[15px] text-[var(--ink-2)] leading-relaxed">
            Have your order number to hand — it&apos;s in your confirmation email and starts with{' '}
            <code className="text-sm">#</code>. If it&apos;s a faulty cartridge, our{' '}
            <Link href="/legal/returns" className="underline underline-offset-4 hover:text-[#41e0f5]">
              returns policy
            </Link>{' '}
            covers you for six months and we pay the collection cost.
          </p>
        </div>

        <div className="mt-10 text-[15px] text-[var(--ink-2)]">
          <p className="mb-2">
            <strong>{siteConfig.company.legalName}</strong> — supplying printer consumables in South
            Africa since 1987.
          </p>
          <p className="text-sm text-[var(--muted)]">
            Looking for the right cartridge?{' '}
            <Link href="/compatibility" className="underline underline-offset-4 hover:text-[var(--ink)]">
              Find it by printer model
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
          <Link href="/legal/returns" className="hover:text-[var(--ink)] transition-colors">Returns &amp; refunds</Link>
          <Link href="/legal/terms" className="hover:text-[var(--ink)] transition-colors">Terms &amp; conditions</Link>
        </div>
      </div>
    </div>
  )
}
