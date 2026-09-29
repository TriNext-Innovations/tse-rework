'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/contexts/CartContext'
import { RollingNumber } from '@/components/motion'
import { flightsInProgress, prefersReducedMotion } from '@/lib/motion'
import animationData from '../../public/animations/bag-arrow.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

const RING = [
  { transform: 'scale(.85)', opacity: 0.85 },
  { transform: 'scale(2.1)', opacity: 0 },
]

export function CartButton() {
  const { count, addSeq, openCart } = useCart()
  const lottieRef = useRef<any>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const ringA = useRef<HTMLSpanElement>(null)
  const ringB = useRef<HTMLSpanElement>(null)
  // The count the badge shows. While an added item's bubble is still on its way
  // here (lib/motion flyToCart), it trails the real count, so the number ticks
  // over — and the button pulses — the moment the bubble arrives.
  const [shown, setShown] = useState(count)
  const [arrivals, setArrivals] = useState(0)
  const handledSeq = useRef(addSeq)

  useEffect(() => {
    let cancelled = false
    // Wait a tick so the bubble launched by the add behind this change has
    // registered before we look for it.
    const timer = setTimeout(async () => {
      const added = addSeq !== handledSeq.current
      handledSeq.current = addSeq
      if (added) await flightsInProgress()
      if (cancelled) return
      setShown(count)
      // Only a real add is announced — not a stored cart loading, not a removal.
      if (added) setArrivals((n) => n + 1)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [count, addSeq])

  // Draw the eye to the cart: two cyan rings ripple out from the bag and the
  // badge bumps. With reduced motion, a brief tint of the button instead.
  useEffect(() => {
    if (arrivals === 0) return
    lottieRef.current?.goToAndPlay(0, true)
    const button = buttonRef.current
    if (!button || typeof button.animate !== 'function') return
    if (prefersReducedMotion()) {
      button.animate([{ backgroundColor: 'rgba(65, 224, 245, .35)' }, { backgroundColor: 'rgba(65, 224, 245, 0)' }], {
        duration: 1200,
        easing: 'ease-out',
      })
      return
    }
    ringA.current?.animate(RING, { duration: 750, easing: 'cubic-bezier(.22, 1, .36, 1)' })
    ringB.current?.animate(RING, { duration: 750, delay: 170, easing: 'cubic-bezier(.22, 1, .36, 1)' })
    badgeRef.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.45)', offset: 0.35 },
        { transform: 'scale(.9)', offset: 0.65 },
        { transform: 'scale(1)' },
      ],
      { duration: 480, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    )
  }, [arrivals])

  return (
    <button
      ref={buttonRef}
      onClick={openCart}
      aria-label={`Cart (${count} items)`}
      data-cart-target
      className="relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-[var(--hover-1)] transition-colors"
    >
      <span ref={ringA} aria-hidden className="cart-ring" />
      <span ref={ringB} aria-hidden className="cart-ring" />
      <div style={{ width: 36, height: 36, overflow: 'hidden' }}>
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={false}
          autoplay={false}
          style={{ width: 36, height: 36 }}
        />
      </div>

      {shown > 0 && (
        <span
          ref={badgeRef}
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[var(--ink)] text-[var(--paper)] text-[10px] font-medium flex items-center justify-center leading-none pointer-events-none"
        >
          <RollingNumber value={shown > 99 ? '99+' : shown} />
        </span>
      )}
    </button>
  )
}
