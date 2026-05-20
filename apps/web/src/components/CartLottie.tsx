'use client'

import dynamic from 'next/dynamic'
import animationData from '../../public/animations/empty-cart.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

export function CartLottie() {
  return (
    <Lottie
      animationData={animationData}
      loop
      style={{ width: 140, height: 140 }}
    />
  )
}
