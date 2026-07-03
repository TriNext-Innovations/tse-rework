'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { useCart } from '@/contexts/CartContext'
import animationData from '../../public/animations/bag-arrow.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

export function CartButton() {
  const { count, openCart } = useCart()
  const lottieRef = useRef<any>(null)
  const prevCount = useRef(count)

  useEffect(() => {
    if (count > prevCount.current && lottieRef.current) {
      lottieRef.current.goToAndPlay(0, true)
    }
    prevCount.current = count
  }, [count])

  return (
    <button
      onClick={openCart}
      aria-label={`Cart (${count} items)`}
      className="relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-[var(--hover-1)] transition-colors"
    >
      <div style={{ width: 36, height: 36, overflow: 'hidden' }}>
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={false}
          autoplay={false}
          style={{ width: 36, height: 36 }}
        />
      </div>

      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[var(--ink)] text-[var(--paper)] text-[10px] font-medium flex items-center justify-center leading-none pointer-events-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
