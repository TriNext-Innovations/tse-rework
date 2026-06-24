'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

type OrderItem = { id: string; title: string; quantity: number; unit_price: number }
type Order = {
  id: string
  display_id: number
  status: string
  payment_status: string
  fulfillment_status: string
  total: number
  created_at: string
  items: OrderItem[]
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  pending:   { label: 'Pending',   class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  completed: { label: 'Completed', class: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', class: 'bg-red-50 text-red-700 border-red-200' },
  processing:{ label: 'Processing',class: 'bg-blue-50 text-blue-700 border-blue-200' },
}

export default function OrdersPage() {
  const { token, customer } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !customer) return
    fetch(
      `${BACKEND}/store/orders?customer_id=${customer.id}&fields=*items,+display_id,+status,+payment_status,+fulfillment_status,+total,+created_at`,
      { headers: { Authorization: `Bearer ${token}`, 'x-publishable-api-key': PUB_KEY }, cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [token, customer])

  return (
    <div>
      <h2 className="font-display font-light text-3xl mb-6">Orders</h2>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-black/20 border-t-[#111827] rounded-full animate-spin" />
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="bg-white rounded-[20px] p-10 text-center">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="font-display text-xl font-light mb-2">No orders yet</h3>
          <p className="text-sm text-[#6B6B66] max-w-xs mx-auto mb-6 leading-relaxed">
            Orders placed via WhatsApp or PayFast will appear here once your account is linked.
            For previous orders, call{' '}
            <a href="tel:0117082304" className="underline">011 708 2304</a>.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-[#111827] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors"
          >
            Shop cartridges
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status] ?? { label: order.status, class: 'bg-black/5 text-[#374151] border-black/10' }
            const date = new Date(order.created_at).toLocaleDateString('en-ZA', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
            const total = (order.total / 100).toFixed(0)
            return (
              <div key={order.id} className="bg-white rounded-[20px] p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-medium text-sm">Order #{order.display_id}</div>
                    <div className="text-xs text-[#6B6B66] mt-0.5">{date}</div>
                  </div>
                  <span className={`text-[10px] font-medium uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${badge.class}`}>
                    {badge.label}
                  </span>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {(order.items ?? []).map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-[#374151]">{item.quantity}× {item.title}</span>
                      <span className="text-[#6B6B66]">R{(item.unit_price * item.quantity / 100).toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-black/8 pt-4 flex justify-between items-center">
                  <span className="text-sm text-[#6B6B66]">Total</span>
                  <span className="font-display text-xl">R{total}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
