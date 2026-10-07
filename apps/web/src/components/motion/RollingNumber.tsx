'use client'

import { useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

type Direction = 'up' | 'down'

function numeric(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, ''))
}

function directionOf(from: string, to: string): Direction {
  const a = numeric(from)
  const b = numeric(to)
  return Number.isFinite(a) && Number.isFinite(b) && b < a ? 'down' : 'up'
}

/**
 * Renders `value`. When it changes, only the characters that differ roll into
 * place: up when the number grew, down when it shrank (.roll in motion.css).
 * The DOM text is always the current value; the outgoing digit is drawn by a
 * pseudo-element.
 */
export function RollingNumber({ value, className }: { value: string | number; className?: string }) {
  const text = String(value)
  const [roll, setRoll] = useState<{ current: string; previous: string | null; dir: Direction; gen: number }>({
    current: text,
    previous: null,
    dir: 'up',
    gen: 0,
  })

  // Record the change during render (React's derived-state pattern), so the
  // new value and its roll paint in the same frame.
  if (roll.current !== text) {
    setRoll({ current: text, previous: roll.current, dir: directionOf(roll.current, text), gen: roll.gen + 1 })
  }

  const previous = roll.previous
  if (previous === null || prefersReducedMotion()) return <span className={className}>{text}</span>

  // Align from the right: a number grows and shrinks on its left edge.
  const chars = [...text]
  const offset = previous.length - chars.length
  return (
    <span className={className}>
      {chars.map((ch, i) => {
        const before = previous[i + offset] ?? ''
        if (before === ch) return ch
        return (
          <span key={`${roll.gen}-${i}`} className="roll" data-prev={before} data-dir={roll.dir}>
            <span>{ch}</span>
          </span>
        )
      })}
    </span>
  )
}
