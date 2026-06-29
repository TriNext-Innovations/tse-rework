import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

export const metadata: Metadata = {
  title: 'Cookie Policy — TSE Online',
  description: 'How TSE uses cookies and how you can control them.',
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .prose h2 { margin-top: 2rem; margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 500; }
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
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6B6B66] mb-3">Legal</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Cookie <span className="font-display-italic">Policy</span>
          </h1>
          <p className="mt-4 text-sm text-[#6B6B66]">
            Last updated: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="prose text-[#374151] text-[15px]">
          <p>
            This policy explains how <strong>tse-cartridges.co.za</strong> uses cookies and similar technologies,
            and how you can control them.
          </p>

          <h2>What is a cookie?</h2>
          <p>
            A cookie is a small text file stored on your device when you visit a website. Cookies help the site
            remember your preferences and understand how you use it.
          </p>

          <h2>Cookies we use</h2>
          <table>
            <thead>
              <tr><th>Cookie / key</th><th>Category</th><th>Purpose</th><th>Expires</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>tse_cookie_consent</td>
                <td>Necessary</td>
                <td>Remembers whether you accepted or declined non-essential cookies</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>medusa_session</td>
                <td>Necessary</td>
                <td>Keeps you logged in to your account (when using customer accounts)</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>

          <p>
            We do not currently use advertising, social-media, or cross-site tracking cookies. If we add analytics
            cookies in future we will update this policy and ask for your consent again.
          </p>

          <h2>Controlling cookies</h2>
          <p>
            You can change your consent at any time by clearing your browser&apos;s local storage for{' '}
            <strong>tse-cartridges.co.za</strong> and reloading the page — the consent banner will reappear.
          </p>
          <p>
            You can also configure your browser to block or delete cookies:
          </p>
          <ul>
            <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
            <li><strong>Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
          </ul>
          <p>
            Blocking necessary cookies may prevent the site from functioning correctly (e.g. staying logged in).
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy? Email{' '}
            <a href={siteConfig.email.mailto}>{siteConfig.email.sales}</a> or call {siteConfig.phone.display}.
            Also see our <Link href="/legal/privacy">Privacy Policy</Link>.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-black/10 text-sm text-[#6B6B66]">
          <Link href="/" className="hover:text-[#111827] transition-colors">← Back to store</Link>
        </div>
      </div>
    </div>
  )
}
