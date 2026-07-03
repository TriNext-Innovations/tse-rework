import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

export const metadata: Metadata = {
  title: 'Privacy Policy — TSE Online',
  description: 'How TSE (Technical Systems Engineering) collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
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

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-28 pb-20">
        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Legal</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Privacy <span className="font-display-italic">Policy</span>
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Last updated: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="prose text-[var(--ink-2)] text-[15px]">
          <p>
            Technical Systems Engineering (<strong>"TSE"</strong>, <strong>"we"</strong>, <strong>"us"</strong>) operates{' '}
            <strong>tse-cartridges.co.za</strong>. This policy explains what personal information we collect, why we
            collect it, and your rights under the Protection of Personal Information Act 4 of 2013 (<strong>POPIA</strong>).
          </p>

          <h2>1. Who we are</h2>
          <p>
            TSE is the Responsible Party under POPIA.<br />
            <strong>Address:</strong> Unit 34, A.P.D. Industrial Park, Kya Sands, Johannesburg 2163<br />
            <strong>Phone:</strong> {siteConfig.phone.display} / {siteConfig.whatsapp.display}<br />
            <strong>Email:</strong> <a href={siteConfig.email.mailto}>{siteConfig.email.sales}</a>
          </p>

          <h2>2. What personal information we collect</h2>
          <table>
            <thead>
              <tr><th>Category</th><th>Examples</th><th>Purpose</th></tr>
            </thead>
            <tbody>
              <tr><td>Contact details</td><td>Name, email address, phone number</td><td>Process and communicate about your order</td></tr>
              <tr><td>Delivery address</td><td>Street, suburb, city, province, postal code</td><td>Arrange courier or own-driver delivery</td></tr>
              <tr><td>Order data</td><td>Items ordered, quantities, prices, payment reference</td><td>Fulfil your order and meet our SARS obligations</td></tr>
              <tr><td>Device / usage data</td><td>IP address, browser type, pages visited (via cookies)</td><td>Analytics and security (with your consent)</td></tr>
            </tbody>
          </table>
          <p>We do not collect payment card numbers — payments are processed directly by PayFast on their secure servers.</p>

          <h2>3. How we use your information</h2>
          <ul>
            <li>Process and deliver your order</li>
            <li>Send transactional emails (order confirmation, shipping updates)</li>
            <li>Respond to enquiries or complaints</li>
            <li>Comply with legal obligations (SARS record-keeping, 5-year retention)</li>
            <li>Improve our website (only with your cookie consent)</li>
          </ul>
          <p>We do not sell, rent, or trade your personal information to third parties for marketing.</p>

          <h2>4. Third-party processors</h2>
          <table>
            <thead>
              <tr><th>Processor</th><th>Purpose</th><th>Location</th></tr>
            </thead>
            <tbody>
              <tr><td>PayFast</td><td>Online payment processing</td><td>South Africa</td></tr>
              <tr><td>The Courier Guy</td><td>Courier delivery</td><td>South Africa</td></tr>
              <tr><td>Resend</td><td>Transactional email delivery</td><td>United States / EU</td></tr>
              <tr><td>Cloudflare</td><td>CDN / DNS / DDoS protection (in-transit only, no persistence)</td><td>Global (JHB PoP)</td></tr>
            </tbody>
          </table>
          <p>
            Resend processes email addresses outside South Africa. This transfer is covered by section 72(1)(c) of POPIA
            (necessary for performance of your contract) and is governed by a Data Processing Agreement with Resend.
            All compute infrastructure (website, database, API) is hosted in Johannesburg by Vultr.
          </p>

          <h2>5. Your rights under POPIA</h2>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal information we hold about you</li>
            <li><strong>Correction</strong> — ask us to correct inaccurate information</li>
            <li><strong>Deletion</strong> — ask us to delete your data (subject to legal retention requirements)</li>
            <li><strong>Objection</strong> — object to our processing of your information</li>
            <li><strong>Complaint</strong> — lodge a complaint with the Information Regulator at{' '}
              <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">inforegulator.org.za</a>
            </li>
          </ul>
          <p>
            To exercise your rights, email <a href={siteConfig.email.mailto}>{siteConfig.email.sales}</a> or call {siteConfig.phone.display}.
            We will respond within 30 days.
          </p>

          <h2>6. Data retention</h2>
          <ul>
            <li>Order records: 5 years (SARS requirement)</li>
            <li>Enquiry / contact data: 2 years</li>
            <li>Cookie analytics data: 13 months</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>
            We use cookies to make the site work and (with your consent) to understand how visitors use it. See our{' '}
            <Link href="/legal/cookies">Cookie Policy</Link> for details.
          </p>

          <h2>8. Security</h2>
          <p>
            All data is transmitted over TLS (HTTPS). Passwords are hashed. Databases are hosted in a private network
            accessible only from our application servers. We review access controls regularly.
          </p>

          <h2>9. Changes to this policy</h2>
          <p>
            We may update this policy. The "Last updated" date at the top will reflect any changes. Material changes
            will be communicated via email to registered customers.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--line-3)] text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">← Back to store</Link>
        </div>
      </div>
    </div>
  )
}
