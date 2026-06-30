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
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar categories={categories} />

      <div className="mx-auto max-w-lg px-4 sm:px-8 pt-28 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#dfe344]/20 mb-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

        <p className="text-[#4B4B46] text-base mb-8 leading-relaxed">
          Your order has been sent to our team via WhatsApp. We&apos;ll confirm stock availability and arrange payment and delivery within 1 business hour.
        </p>

        <div className="bg-white rounded-[20px] p-6 text-left mb-8 space-y-4">
          {[
            { icon: '📬', heading: 'Confirmation', body: "You'll receive an email and/or WhatsApp confirming your order and estimated delivery time." },
            { icon: '🚚', heading: 'Delivery', body: 'Orders confirmed before noon are delivered next business day to JHB & PTA. Other areas may vary.' },
            { icon: '💳', heading: 'Payment', body: 'Our team will send you payment details (EFT or COD available for JHB/PTA).' },
          ].map(({ icon, heading, body }) => (
            <div key={heading} className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <div>
                <p className="text-sm font-medium">{heading}</p>
                <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#111827] text-white text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors"
          >
            Continue shopping
          </Link>
          <a
            href={siteConfig.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-black/15 text-sm text-[#374151] hover:border-black/40 transition-colors"
          >
            WhatsApp us
          </a>
        </div>

        <p className="text-xs text-[#9ca3af]">
          Need help?{' '}
          <a href={siteConfig.whatsapp.tel} className="underline underline-offset-2 hover:text-[#111827] transition-colors">
            Call {siteConfig.whatsapp.display}
          </a>
          {' '}or{' '}
          <a href={siteConfig.email.mailto} className="underline underline-offset-2 hover:text-[#111827] transition-colors">
            email us
          </a>
        </p>
      </div>
    </div>
  )
}
