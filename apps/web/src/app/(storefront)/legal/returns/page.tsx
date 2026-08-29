import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

// Google Merchant Center reviews the storefront, not just the product feed, and
// the absence of a findable returns policy is the most common reason a Shopping
// account is suspended. A footer link into a homepage FAQ anchor does not count —
// it needs its own URL.
//
// Every timeframe below is a South African statutory minimum (ECTA s44 cooling-off,
// CPA s55/56 defective goods), so the page is accurate as written. If TSE chooses to
// offer more than the law requires, that is an upgrade for Leon to approve — never
// less, which would be unenforceable.

export const metadata: Metadata = {
  title: 'Returns & Refunds — TSE Online',
  description:
    'How to return or exchange a cartridge bought from TSE Online: 7-day cooling-off, 6-month guarantee on defective cartridges, and how refunds are paid.',
}

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .prose h2 { margin-top: 2rem; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 500; }
        .prose h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; font-weight: 500; }
        .prose p { margin-bottom: 1rem; line-height: 1.7; }
        .prose ul { margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .prose li { margin-bottom: 0.4rem; line-height: 1.65; }
        .prose a { text-decoration: underline; text-underline-offset: 3px; }
        .prose a:hover { color: #41e0f5; }
        .prose table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem; }
        .prose th, .prose td { border: 1px solid rgba(0,0,0,0.1); padding: 0.6rem 0.8rem; text-align: left; vertical-align: top; }
        .prose th { background: rgba(0,0,0,0.04); font-weight: 600; }
      `}</style>

      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Legal</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Returns &amp; <span className="font-display-italic">Refunds</span>
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Last updated: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="prose text-[var(--ink-2)] text-[15px]">
          <p>
            We want the cartridge to work. If it doesn&apos;t, we&apos;ll make it right — that is the
            guarantee we sell on. This page sets out exactly how, and what the law entitles you to.
          </p>

          <h2>1. The short version</h2>
          <table>
            <thead>
              <tr><th>Situation</th><th>You have</th><th>You get</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Changed your mind</td>
                <td>7 days from delivery</td>
                <td>Full refund of the price paid</td>
              </tr>
              <tr>
                <td>Cartridge is faulty or doesn&apos;t print properly</td>
                <td>6 months from delivery</td>
                <td>Repair, replacement or refund — your choice</td>
              </tr>
              <tr>
                <td>Wrong item delivered, or damaged in transit</td>
                <td>Tell us as soon as you notice</td>
                <td>Replacement or full refund, at no cost to you</td>
              </tr>
            </tbody>
          </table>

          <h2>2. Changed your mind — 7-day cooling-off</h2>
          <p>
            Because you bought online, section 44 of the Electronic Communications and Transactions
            Act 25 of 2002 gives you <strong>7 days from the date you receive the goods</strong> to
            cancel, without giving a reason and without penalty.
          </p>
          <ul>
            <li>The cartridge must be unused and in its original, unopened packaging.</li>
            <li>You arrange and pay for returning it to us — the Act places that cost on the buyer.</li>
            <li>We refund the full purchase price within <strong>30 days</strong> of cancellation.</li>
          </ul>
          <p>
            A cartridge that has been installed or had its seal broken can&apos;t be resold as new, so
            it falls outside cooling-off. It is still fully covered by the guarantee below if it
            doesn&apos;t work.
          </p>

          <h2>3. Faulty cartridges — 6-month guarantee</h2>
          <p>
            Section 56 of the Consumer Protection Act 68 of 2008 entitles you to return goods that
            are defective, unsafe, or don&apos;t do what they are supposed to, for{' '}
            <strong>6 months after delivery</strong>. It is your choice whether we repair, replace,
            or refund — not ours.
          </p>
          <ul>
            <li>This covers a cartridge that leaks, prints poorly, isn&apos;t recognised by your printer, or fails early.</li>
            <li><strong>We pay the cost of collecting and returning it.</strong> The Act does not allow us to charge you for that.</li>
            <li>We don&apos;t charge a handling or restocking fee on a faulty item.</li>
          </ul>
          <p>
            We may test the returned cartridge to confirm the fault. If a cartridge was damaged by
            misuse, or altered after delivery, the guarantee doesn&apos;t apply — we&apos;ll tell you why
            and send it back to you.
          </p>

          <h2>4. Wrong or damaged on arrival</h2>
          <p>
            If we send the wrong item, or it arrives damaged, that is our problem and not yours.
            Contact us as soon as you notice and we will collect it and send the correct item — or
            refund you in full — at no cost to you. Please keep the packaging where you can; it
            helps us claim against the courier.
          </p>

          <h2>5. How to start a return</h2>
          <p>Contact us with your order number and what went wrong:</p>
          <ul>
            <li><strong>Phone:</strong> <a href={siteConfig.phone.tel}>{siteConfig.phone.displayExt}</a></li>
            <li><strong>WhatsApp:</strong> <a href={siteConfig.whatsapp.href} target="_blank" rel="noopener noreferrer">{siteConfig.whatsapp.display}</a></li>
            <li><strong>Email:</strong> <a href={siteConfig.email.mailto}>{siteConfig.email.sales}</a></li>
          </ul>
          <p>
            We&apos;ll confirm the return and arrange collection or give you the return address. Please
            don&apos;t send anything back before speaking to us — unannounced parcels are easy to lose
            and slow everything down.
          </p>

          <h2>6. How refunds are paid</h2>
          <ul>
            <li>Refunds go back via the method you paid with. Card and instant-EFT payments made through PayFast are refunded to the same account.</li>
            <li>We process refunds within <strong>7 business days</strong> of receiving and checking the returned item; your bank may take a few days more to show it.</li>
            <li>Delivery charges are refunded when the return is our fault — a faulty, wrong, or damaged item. On a change-of-mind cancellation the original delivery charge isn&apos;t refunded.</li>
          </ul>

          <h2>7. Business and trade orders</h2>
          <p>
            The Consumer Protection Act does not apply to every business-to-business transaction.
            If you buy on a trade account, the statutory rights above may not apply in the same way —
            but our practical guarantee does: if a cartridge doesn&apos;t work, tell us and we&apos;ll
            sort it out. Talk to us about volume returns before sending anything back.
          </p>

          <h2>8. Nothing here limits your rights</h2>
          <p>
            This policy sets out how we handle returns. It does not, and cannot, take away any right
            you have under the Consumer Protection Act, the Electronic Communications and
            Transactions Act, or any other South African law. Where this page and the law differ,
            the law wins.
          </p>
          <p>
            If we can&apos;t resolve a complaint between us, you may refer it to the National Consumer
            Commission at{' '}
            <a href="https://www.thencc.gov.za" target="_blank" rel="noopener noreferrer">thencc.gov.za</a>.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
          <Link href="/legal/terms" className="hover:text-[var(--ink)] transition-colors">Terms &amp; conditions</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Contact us</Link>
        </div>
      </div>
    </div>
  )
}
