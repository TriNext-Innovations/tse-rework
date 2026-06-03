import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/layout'

export const metadata: Metadata = { title: 'Request Received — TSE B2B' }

export default function B2BConfirmedPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const isQuote = searchParams?.type === 'quote'

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />

      <div className="mx-auto max-w-lg px-4 sm:px-8 pt-32 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#dfe344]/20 mb-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[#dfe344]/20 border border-[#dfe344]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#dfe344]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium">
            {isQuote ? 'Quote request received' : 'Application received'}
          </span>
        </div>

        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-tight mb-4">
          {isQuote ? (
            <>We'll get back to you <span className="font-display-italic">shortly</span>.</>
          ) : (
            <>Application <span className="font-display-italic">sent</span>.</>
          )}
        </h1>

        <p className="text-[#4B4B46] text-base mb-8 leading-relaxed">
          {isQuote
            ? "Our team will review your quote request and respond with pricing within 2 business hours."
            : "We review every B2B application manually and will contact you within 1 business day to set up your account."}
        </p>

        <div className="bg-white rounded-[20px] p-6 text-left mb-8 space-y-4">
          {isQuote ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-sm font-medium">Pricing within 2 hours</p>
                  <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">Our team will email you a full quote with line-item pricing.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🚚</span>
                <div>
                  <p className="text-sm font-medium">Fast delivery</p>
                  <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">Orders before noon deliver next day to JHB & PTA. Nationwide courier available.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-medium">Approval within 1 business day</p>
                  <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">We'll review your application and email you your approved pricing tier.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">💳</span>
                <div>
                  <p className="text-sm font-medium">Account set up for you</p>
                  <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">Once approved, your discount applies automatically to every order.</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#111827] text-white text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors"
          >
            Browse cartridges
          </Link>
          <a
            href="tel:0117082304"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-black/15 text-sm text-[#374151] hover:border-black/40 transition-colors"
          >
            Call 011 708 2304
          </a>
        </div>
      </div>
    </div>
  )
}
