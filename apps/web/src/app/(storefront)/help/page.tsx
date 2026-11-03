import type { Metadata } from 'next'
import Link from 'next/link'
import { siteConfig } from '@/lib/site-config'
import { SITE_URL } from '@/lib/structured-data'
import { Navbar } from '@/components/layout'
import { siteUrl } from '@/lib/site-url'

// AWStats, Sep 2026: /help/ was requested 41 times a month and 404'd (#479).
// People reach for help when the printer is already out of ink, so this page
// answers the questions they actually ask and sends them to the page that
// owns each answer — the finder, /legal/returns, /contact — instead of
// restating policy. Every fact here is already published elsewhere on the
// site (terms §6, the returns page, the homepage FAQ); change it there first.

export const metadata: Metadata = {
  title: 'Help — TSE Online',
  description:
    'Will this cartridge fit my printer, how long delivery takes, how to track an order, and what to do if a cartridge is wrong or faulty.',
  alternates: { canonical: siteUrl('/help') },
}

type Faq = { id: string; q: string; a: string; body: React.ReactNode }

const FAQS: Faq[] = [
  {
    id: 'fit',
    q: 'Will this cartridge fit my printer?',
    a: 'Search your printer model in our cartridge finder: it lists every cartridge that fits that printer. You can also search the code printed on your old cartridge. Not sure? Call or WhatsApp us with your printer model and we will tell you.',
    body: (
      <>
        <p>
          Search your printer model in the <Link href="/compatibility">cartridge finder</Link> — it lists every
          cartridge that fits that printer. The model is usually printed on the front or top of the printer
          (for example <em>LaserJet P1102</em> or <em>DCP-L2540DW</em>). You can also search the code printed on
          your old cartridge.
        </p>
        <p>
          Still not sure? Call <a href={siteConfig.phone.tel}>{siteConfig.phone.display}</a> or WhatsApp{' '}
          <a href={siteConfig.whatsapp.href}>{siteConfig.whatsapp.display}</a> with your printer model and
          we&apos;ll tell you which one you need.
        </p>
      </>
    ),
  },
  {
    id: 'delivery',
    q: 'How long does delivery take?',
    a: 'We deliver countrywide with The Courier Guy. Economy takes 3–4 business days (R150). Overnight aims for the next business day (R200); Johannesburg and Pretoria orders placed before 12:00 are normally delivered the next business day. Delivery is free on orders over R2,000, and collection from our Kya Sands warehouse is always free.',
    body: (
      <>
        <ul>
          <li>
            <strong>Economy</strong> — 3&ndash;4 business days, R150.
          </li>
          <li>
            <strong>Overnight</strong> — aims for the next business day, R200. Johannesburg and Pretoria
            orders placed before 12:00 on a business day are normally delivered the next business day.
          </li>
          <li>
            <strong>Free</strong> on orders over R2,000, and collection from our Kya Sands warehouse is always
            free.
          </li>
        </ul>
        <p>
          We deliver countrywide with The Courier Guy. Timeframes are estimates — see{' '}
          <Link href="/legal/terms">our terms</Link> for the detail.
        </p>
      </>
    ),
  },
  {
    id: 'track',
    q: 'How do I track my order?',
    a: 'When your parcel ships we email you a Courier Guy tracking link. If you have an account, your orders are listed under My account. Can’t find the email? Contact us with your order number.',
    body: (
      <>
        <p>
          When your parcel ships we email you a Courier Guy tracking link — look for{' '}
          <em>Track your parcel</em> in the email. If you ordered with an account, your orders are under{' '}
          <Link href="/account/orders">My account</Link>.
        </p>
        <p>
          Can&apos;t find the email? <Link href="/contact">Contact us</Link> with your order number and
          we&apos;ll tell you where it is.
        </p>
      </>
    ),
  },
  {
    id: 'faulty',
    q: 'What if a cartridge is wrong or faulty?',
    a: 'A faulty cartridge is covered for 6 months from delivery: repair, replacement or refund, your choice. If we sent the wrong item or it arrived damaged, tell us as soon as you notice and we replace or refund it at no cost to you. You can also change your mind within 7 days of delivery.',
    body: (
      <>
        <ul>
          <li>
            <strong>Faulty</strong> — covered for 6 months from delivery: repair, replacement or refund, your
            choice.
          </li>
          <li>
            <strong>Wrong item or damaged in transit</strong> — tell us as soon as you notice; we replace or
            refund it at no cost to you. Keep the packaging if you can.
          </li>
          <li>
            <strong>Changed your mind</strong> — within 7 days of delivery.
          </li>
        </ul>
        <p>
          How to send it back and how refunds are paid: <Link href="/legal/returns">Returns &amp; refunds</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'warranty',
    q: 'Will a generic cartridge void my printer’s warranty?',
    a: 'No. Using a compatible cartridge does not void your printer’s warranty: a manufacturer may not void a warranty simply because you used another supplier’s consumable. Our compatibles are made to spec for each printer model, and if one doesn’t print properly we replace it.',
    body: (
      <p>
        No. A manufacturer may not void a warranty simply because you used another supplier&apos;s
        consumable. Our compatibles are made to spec for each printer model, and if one doesn&apos;t print
        properly it&apos;s covered by the guarantee above.
      </p>
    ),
  },
  {
    id: 'business',
    q: 'Do you do business or bulk pricing?',
    a: `Yes. Offices, schools and print shops can call ${siteConfig.phone.display} or email ${siteConfig.email.sales} for a quote.`,
    body: (
      <p>
        Yes — offices, schools and print shops: <Link href="/b2b/quote">request a quote</Link> or call{' '}
        <a href={siteConfig.phone.tel}>{siteConfig.phone.display}</a>.
      </p>
    ),
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  url: `${SITE_URL}/help`,
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .prose h2 { margin-top: 2.25rem; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 500; scroll-margin-top: 7rem; }
        .prose p { margin-bottom: 1rem; line-height: 1.7; }
        .prose ul { margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .prose li { margin-bottom: 0.4rem; line-height: 1.65; }
        .prose a { text-decoration: underline; text-underline-offset: 3px; }
        .prose a:hover { color: #41e0f5; }
      `}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Help</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            How can we <span className="font-display-italic">help?</span>
          </h1>
          <p className="mt-4 text-[15px] text-[var(--ink-2)]">
            Quick answers below. Rather talk to someone? Call{' '}
            <a href={siteConfig.phone.tel} className="underline underline-offset-[3px]">{siteConfig.phone.display}</a>{' '}
            ({siteConfig.openingHours.map((h) => `${h.label} ${h.display}`).join(', ')}) or{' '}
            <Link href="/contact" className="underline underline-offset-[3px]">contact us</Link>.
          </p>
        </div>

        <nav aria-label="Questions" className="mb-4 text-sm">
          <ul className="flex flex-col gap-1.5">
            {FAQS.map(({ id, q }) => (
              <li key={id}>
                <a href={`#${id}`} className="text-[var(--ink-2)] hover:text-[var(--ink)] underline-offset-[3px] hover:underline">
                  {q}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose text-[var(--ink-2)] text-[15px]">
          {FAQS.map(({ id, q, body }) => (
            <section key={id} aria-labelledby={id}>
              <h2 id={id}>{q}</h2>
              {body}
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
          <Link href="/compatibility" className="hover:text-[var(--ink)] transition-colors">Find my cartridge</Link>
          <Link href="/legal/returns" className="hover:text-[var(--ink)] transition-colors">Returns &amp; refunds</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
