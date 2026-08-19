import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'
import Link from 'next/link'
import { Navbar } from '@/components/layout'
import { FinalizeOrder } from './FinalizeOrder'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export const metadata: Metadata = {
  title: 'Order Received — TSE Online',
}

async function getCategories(): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND}/store/product-categories?limit=50&include_descendants_tree=true`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const d = await res.json()
    return (d.product_categories ?? []) as any[]
  } catch {
    return []
  }
}

export default async function OrderConfirmedPage() {
  const categories = await getCategories()
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar categories={categories} />

      <div className="mx-auto max-w-lg px-4 sm:px-8 pt-32 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#dfe344]/20 mb-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[#dfe344]/20 border border-[#dfe344]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#dfe344]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium">Order received</span>
        </div>

        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-tight mb-4">
          Thank you for<br />
          your <span className="font-display-italic">order</span>
        </h1>

        <FinalizeOrder />

        <p className="text-[var(--ink-3)] text-base mb-8 leading-relaxed">
          Your payment was received securely via PayFast and your order is in our system. Our team will pack it and get it on its way.
        </p>

        <div className="bg-[var(--surface)] rounded-[20px] p-6 text-left mb-8 space-y-4">
          {[
            { icon: '📬', heading: 'Confirmation', body: "A confirmation email with your order number and details is on its way to your inbox." },
            { icon: '🚚', heading: 'Delivery', body: 'We dispatch with your chosen delivery method. Economy takes 3–4 business days; Overnight orders placed before noon are typically delivered the next business day to JHB & PTA. Other areas may vary.' },
            { icon: '💳', heading: 'Payment', body: 'Paid in full online via PayFast — no further payment is needed.' },
          ].map(({ icon, heading, body }) => (
            <div key={heading} className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <div>
                <p className="text-sm font-medium">{heading}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--paper)] text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors"
          >
            Continue shopping
          </Link>
          <a
            href={siteConfig.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-[var(--line-4)] text-sm text-[var(--ink-2)] hover:border-[var(--line-7)] transition-colors"
          >
            WhatsApp us
          </a>
        </div>

        <p className="text-xs text-[var(--muted-2)]">
          Need help?{' '}
          <a href={siteConfig.whatsapp.tel} className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
            Call {siteConfig.whatsapp.display}
          </a>
          {' '}or{' '}
          <a href={siteConfig.email.mailto} className="underline underline-offset-2 hover:text-[var(--ink)] transition-colors">
            email us
          </a>
        </p>
      </div>
    </div>
  )
}
