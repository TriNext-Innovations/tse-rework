import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navbar } from '@/components/layout'
import { CancelSurvey } from './CancelSurvey'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export const metadata: Metadata = {
  title: 'Payment Cancelled — TSE Online',
  robots: { index: false },
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

export default async function PaymentCancelledPage() {
  const categories = await getCategories()
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar categories={categories} />

      <div className="mx-auto max-w-lg px-4 sm:px-8 pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--line-4)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium">Payment cancelled</span>
        </div>

        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-tight mb-4">
          No payment<br />
          was <span className="font-display-italic">taken</span>
        </h1>

        <p className="text-[var(--ink-3)] text-base mb-8 leading-relaxed">
          Your cart is exactly as you left it — you can pick up where you stopped whenever you&apos;re ready.
        </p>

        <Suspense>
          <CancelSurvey />
        </Suspense>
      </div>
    </div>
  )
}
