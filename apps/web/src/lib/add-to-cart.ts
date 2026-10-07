'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCart, type AddToCartInput } from '@/contexts/CartContext'
import { flyToCart } from '@/lib/motion'

export type AddStatus = 'idle' | 'pending' | 'added' | 'error'

// How long a button holds its outcome before returning to its resting state.
const ADDED_MS = 1800
const ERROR_MS = 2800

/**
 * Add-to-cart with a visible outcome. The status follows the real request:
 * pending while Medusa answers, added only once the line is in the cart (at
 * which point a bubble carrying the product's picture travels from the button
 * up to the cart in the navbar), error if it failed.
 */
export function useAddToCart() {
  const { addItem } = useCart()
  const [status, setStatus] = useState<AddStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const add = useCallback(
    async (
      item: AddToCartInput,
      options: { quantity?: number; from?: Element | null; image?: string | null } = {},
    ): Promise<boolean> => {
      if (timer.current) clearTimeout(timer.current)
      setStatus('pending')
      const ok = await addItem(item, options.quantity ?? 1)
      if (!mounted.current) return ok
      if (ok) void flyToCart(options.from, options.image ?? item.thumbnail)
      setStatus(ok ? 'added' : 'error')
      timer.current = setTimeout(() => {
        if (mounted.current) setStatus('idle')
      }, ok ? ADDED_MS : ERROR_MS)
      return ok
    },
    [addItem],
  )

  return { status, add }
}

/** Screen-reader wording for an add outcome; empty while nothing has happened. */
export function addStatusMessage(status: AddStatus, title: string): string {
  if (status === 'added') return `${title} added to cart`
  if (status === 'error') return `Couldn't add ${title} to the cart. Please try again.`
  return ''
}
