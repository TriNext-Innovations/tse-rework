import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

// Required for Google Merchant Center review, and ECTA s43 requires an online
// seller to disclose its identity, contact details, and trading terms before a
// transaction. Deliberately short and readable — an unreadable wall of clauses
// protects nobody and gets skimmed past.

export const metadata: Metadata = {
  title: 'Terms & Conditions — TSE Online',
  description:
    'The terms you agree to when buying from TSE Online: who we are, pricing, payment, delivery, and how disputes are handled.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .prose h2 { margin-top: 2rem; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 500; }
        .prose p { margin-bottom: 1rem; line-height: 1.7; }
        .prose ul { margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .prose li { margin-bottom: 0.4rem; line-height: 1.65; }
        .prose a { text-decoration: underline; text-underline-offset: 3px; }
        .prose a:hover { color: #41e0f5; }
      `}</style>

      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Legal</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Terms &amp; <span className="font-display-italic">Conditions</span>
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Last updated: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="prose text-[var(--ink-2)] text-[15px]">
          <p>
            These terms apply when you buy from <strong>tse-cartridges.co.za</strong>. Placing an
            order means you accept them.
          </p>

          <h2>1. Who you are buying from</h2>
          <p>
            <strong>{siteConfig.company.legalName}</strong>, trading as {siteConfig.company.tradingName}.<br />
            <strong>Address:</strong> Unit 34, A.P.D. Industrial Park, Cnr Bernie &amp; Elsecar Street, Kya Sands, Johannesburg 2163<br />
            <strong>Phone:</strong> <a href={siteConfig.phone.tel}>{siteConfig.phone.displayExt}</a><br />
            <strong>Email:</strong> <a href={siteConfig.email.mailto}>{siteConfig.email.sales}</a>
          </p>
          <p>TSE has supplied printer consumables in South Africa since 1987.</p>

          <h2>2. Our products</h2>
          <p>
            We supply both original-brand and compatible (generic) cartridges. Compatible cartridges
            are manufactured to work in the printers listed on the product page — they are{' '}
            <strong>not</strong> made by the printer manufacturer, and we don&apos;t claim otherwise.
            Brand names are used only to identify which printers a cartridge fits.
          </p>
          <p>
            Using a compatible cartridge does not void your printer&apos;s warranty. A manufacturer may
            not void a warranty simply because you used another supplier&apos;s consumable.
          </p>

          <h2>3. Prices</h2>
          <ul>
            <li>All prices are in South African Rand and include VAT at 15%.</li>
            <li>Delivery is charged separately and shown before you pay.</li>
            <li>We may change prices at any time, but never after you have placed and paid for an order.</li>
            <li>
              If a price is obviously wrong — a clear pricing error — we will contact you before
              processing, and you may cancel for a full refund. We won&apos;t quietly charge you more.
            </li>
          </ul>

          <h2>4. Placing an order</h2>
          <p>
            Your order is an offer to buy. The contract forms when we confirm the order and payment
            clears. If we can&apos;t fulfil an order — stock we don&apos;t have, or an address we can&apos;t
            deliver to — we&apos;ll tell you and refund you in full.
          </p>

          <h2>5. Payment</h2>
          <p>
            Payments are processed by <strong>PayFast</strong> on their secure servers. We never see
            or store your card details. Goods remain our property until paid for in full.
          </p>

          <h2>6. Delivery</h2>
          <ul>
            <li>We deliver countrywide via The Courier Guy. Economy takes 3&ndash;4 business days; Overnight is charged separately and aims for the next business day.</li>
            <li>Orders to Johannesburg and Pretoria placed before 12:00 on a business day and sent Overnight are normally delivered the next business day.</li>
            <li>Delivery is free on orders over R2,000.</li>
            <li>Collection from our Kya Sands warehouse is free.</li>
            <li>Delivery timeframes are estimates given in good faith, not guarantees — couriers occasionally run late.</li>
            <li>Risk passes to you on delivery. If it arrives damaged, see our <Link href="/legal/returns">Returns &amp; Refunds</Link> policy.</li>
          </ul>

          <h2>7. Returns</h2>
          <p>
            Set out in full in our <Link href="/legal/returns">Returns &amp; Refunds</Link> policy: a
            7-day cooling-off period on unopened items, and a 6-month guarantee on cartridges that
            don&apos;t work properly.
          </p>

          <h2>8. Trade accounts</h2>
          <p>
            Business customers may apply for a trade account with volume pricing. Approval is at our
            discretion, and trade terms are set out when the account is opened. See{' '}
            <Link href="/b2b">business pricing</Link>.
          </p>

          <h2>9. Your information</h2>
          <p>
            We handle personal information in line with POPIA — see our{' '}
            <Link href="/legal/privacy">Privacy Policy</Link> and{' '}
            <Link href="/legal/cookies">Cookie Policy</Link>.
          </p>

          <h2>10. Website content</h2>
          <p>
            We keep product information, images and compatibility data as accurate as we can, but
            specifications change and errors happen. If a product materially differs from its
            description, that is a defect and the returns policy applies.
          </p>
          <p>
            The content and design of this site belong to TSE. Please don&apos;t copy them for
            commercial use without asking.
          </p>

          <h2>11. Limits of our liability</h2>
          <p>
            We are responsible for supplying goods that work as described. We are not liable for
            indirect losses — lost business or lost profit — beyond what South African law requires
            of us. <strong>Nothing in these terms limits your rights under the Consumer Protection
            Act 68 of 2008</strong>, and nothing excludes liability for gross negligence.
          </p>

          <h2>12. Complaints and disputes</h2>
          <p>
            Talk to us first — most things are sorted out with a phone call. If we can&apos;t resolve
            it, you may refer the matter to the National Consumer Commission at{' '}
            <a href="https://www.thencc.gov.za" target="_blank" rel="noopener noreferrer">thencc.gov.za</a>.
            These terms are governed by South African law.
          </p>

          <h2>13. Changes</h2>
          <p>
            We may update these terms. The version that applies to your order is the one published
            when you placed it.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
          <Link href="/legal/returns" className="hover:text-[var(--ink)] transition-colors">Returns &amp; refunds</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
