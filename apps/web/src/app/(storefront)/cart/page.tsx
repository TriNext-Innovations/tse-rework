import type { Metadata } from 'next'
import { Navbar } from '@/components/layout'
import CartPageClient from './CartPageClient'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export const metadata: Metadata = {
  title: 'Cart — TSE Online',
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

export default async function CartPage() {
  const categories = await getCategories()
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <Navbar categories={categories} />
      <CartPageClient />
    </div>
  )
}
