'use client'

import { useEffect, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { DotOrb } from './DotOrb'

// A photo that arrives within this never shows the orb (cached, fast network).
const SHOW_AFTER_MS = 250

/**
 * A product photo that shows the dotted loading orb in its place when it is
 * slow to arrive. The orb is positioned over the nearest positioned ancestor
 * (the image box), so that box needs `relative`. next/image also reports
 * photos that finished before hydration, so the orb never sticks.
 */
export function ProductImage({ onLoad, orbSize = 24, ...props }: ImageProps & { orbSize?: number }) {
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (loaded) return
    const timer = setTimeout(() => setSlow(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [loaded])

  return (
    <>
      <Image
        {...props}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
      />
      {slow && !loaded && (
        <span className="img-orb" aria-hidden>
          <DotOrb size={orbSize} />
        </span>
      )}
    </>
  )
}
