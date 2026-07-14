'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/contexts/CartContext'
import { completeCart, PAYFAST_PROVIDER_ENABLED } from '@/lib/checkout-cart'

type State = 'idle' | 'finalising' | 'done' | 'pending'

/**
 * On return from PayFast (canonical provider flow only), complete the session
 * cart → order. The ITN authorises the payment session asynchronously (Medusa
 * delays webhook processing ~5s), so we poll `completeCart` a few times. If it
 * never resolves here, the backend subscriber still finalises it from the ITN —
 * so a timeout shows a soft "processing" message rather than an error.
 */
export function FinalizeOrder() {
  const { clearCart } = useCart()
  const [state, setState] = useState<State>('idle')
  const [orderNo, setOrderNo] = useState<string | number | null>(null)

  useEffect(() => {
    if (!PAYFAST_PROVIDER_ENABLED) return
    let cartId: string | null = null
    try {
      cartId = localStorage.getItem('tse_cart_id')
    } catch {}
    if (!cartId) return

    let cancelled = false
    setState('finalising')
    ;(async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        const res = await completeCart(cartId!)
        if (res.type === 'order' && res.order) {
          // Clear the cart via context, not just localStorage — the provider
          // hydrates the (possibly still-uncompleted) cart on mount, so the
          // in-memory drawer state must be dropped too or the paid items keep
          // showing in the header/drawer for the rest of the session.
          clearCart()
          if (!cancelled) {
            setOrderNo(res.order.display_id ?? res.order.id)
            setState('done')
          }
          return
        }
        await new Promise((r) => setTimeout(r, 3000))
      }
      if (!cancelled) setState('pending')
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!PAYFAST_PROVIDER_ENABLED || state === 'idle') return null

  return (
    <p className="text-sm text-[var(--ink-2)] mb-4" role="status">
      {state === 'finalising' && 'Finalising your order…'}
      {state === 'done' && `Order #${orderNo} confirmed.`}
      {state === 'pending' && 'Payment received — we’re finalising your order and will email confirmation shortly.'}
    </p>
  )
}
