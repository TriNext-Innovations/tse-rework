'use client'

import { useState } from 'react'
import type { AddStatus } from '@/lib/add-to-cart'
import { DotOrb } from './DotOrb'

const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const

/**
 * The icon inside a round add-to-cart button. Three glyphs stacked in one cell;
 * motion.css cross-fades them from the button's data-status: + at rest, the
 * loading orb while the cart call is in flight, and a tick that draws itself
 * once the line is in the cart.
 */
export function AddToCartIcon({ size = 12, strokeWidth = 2.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <span className="atc-icon" aria-hidden>
      <svg {...ICON} className="atc-plus" width={size} height={size} strokeWidth={strokeWidth}>
        <path d="M12 5v14M5 12h14" />
      </svg>
      <DotOrb size={size + 6} ink="inverse" className="atc-orb" />
      <svg {...ICON} className="atc-check" width={size} height={size} strokeWidth={strokeWidth + 0.5}>
        <path d="M4.5 12.5l5 5L19.5 7" />
      </svg>
    </span>
  )
}

/**
 * The label of a wide add-to-cart button. It follows the request: the orb and
 * "Adding…" while it runs, a drawn tick once the item is in the cart, a retry
 * prompt if it failed.
 */
export function AddToCartLabel({ status, idle }: { status: AddStatus; idle: string }) {
  // Only animate once the button has been used: the resting label must not
  // slide in on page load.
  const [used, setUsed] = useState(false)
  if (!used && status !== 'idle') setUsed(true)

  let content: React.ReactNode = idle
  if (status === 'pending')
    content = (
      <>
        <DotOrb size={18} ink="inverse" />
        Adding…
      </>
    )
  if (status === 'error') content = "Couldn't add — try again"
  if (status === 'added')
    content = (
      <>
        <svg {...ICON} width={15} height={15} strokeWidth={2.5}>
          <path d="M4.5 12.5l5 5L19.5 7" />
        </svg>
        Added to cart
      </>
    )

  return (
    <span className="atc-label">
      {used ? <span key={status}>{content}</span> : content}
    </span>
  )
}

/** Polite live region announcing the outcome of an add to screen readers. */
export function AddStatusAnnouncer({ message }: { message: string }) {
  return (
    <span className="sr-only" aria-live="polite">
      {message}
    </span>
  )
}
