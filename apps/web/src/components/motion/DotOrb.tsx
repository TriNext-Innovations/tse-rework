'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

type RGB = readonly [number, number, number]

const INK: RGB = [17, 24, 39] // #111827
const PAPER: RGB = [242, 243, 240] // --ink on the dark theme
const CYAN: RGB = [65, 224, 245] // #41e0f5

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const TILT = 0.42 // the sphere leans towards the viewer so its top shows
const SPIN = 0.9 // rad/s
const SCAN = 2.3 // rad/s the cyan meridian travels round the sphere
const SCAN_WIDTH = 0.5 // rad either side of the meridian that light up

/**
 * Which ink the near dots use. `auto` follows the page theme (ink on paper,
 * paper on the dark theme); `inverse` is for orbs sitting on an ink surface,
 * such as a dark button; `light` is for surfaces that are dark in both themes.
 */
export type DotOrbInk = 'auto' | 'inverse' | 'light'

/** Evenly spread points on a unit sphere (a Fibonacci spiral). */
function spherePoints(count: number): Float32Array {
  const pts = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count
    const ring = Math.sqrt(1 - y * y)
    const a = i * GOLDEN_ANGLE
    pts[i * 3] = ring * Math.cos(a)
    pts[i * 3 + 1] = y
    pts[i * 3 + 2] = ring * Math.sin(a)
  }
  return pts
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Dot count and dot radius per size: small orbs get fewer, larger dots so they stay legible. */
function tuning(size: number): { count: number; dot: number } {
  if (size >= 48) return { count: 240, dot: size * 0.017 }
  if (size >= 28) return { count: 110, dot: size * 0.026 }
  return { count: 44, dot: Math.max(0.75, size * 0.045) }
}

/**
 * The storefront's loading orb: a sphere of dots that turns in 3D. Depth is
 * carried by dot size and weight, with near dots in ink and far ones fading
 * into TSE cyan, while a cyan meridian sweeps round it. Drawn on a small 2D
 * canvas; with reduced motion it holds one still frame.
 *
 * Decorative: the caller supplies the words screen readers hear.
 */
export function DotOrb({ size = 64, ink = 'auto', className = '' }: { size?: number; ink?: DotOrbInk; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    // jsdom and very old browsers have no 2D canvas; the orb is decoration.
    const ctx = typeof CanvasRenderingContext2D === 'undefined' ? null : canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)

    const { count, dot } = tuning(size)
    const pts = spherePoints(count)
    // Each dot's longitude on the sphere, fixed: the scan is measured against it.
    const lon = new Float32Array(count)
    for (let i = 0; i < count; i++) lon[i] = Math.atan2(pts[i * 3 + 2]!, pts[i * 3]!)
    const radius = size * 0.4
    const half = size / 2
    const sx = new Float32Array(count)
    const sy = new Float32Array(count)
    const depth = new Float32Array(count)
    const lit = new Float32Array(count)
    const order = Array.from({ length: count }, (_, i) => i)
    const ct = Math.cos(TILT)
    const st = Math.sin(TILT)
    const still = prefersReducedMotion()
    const started = performance.now()
    let frame = 0

    const draw = (now: number) => {
      const t = still ? 1.1 : (now - started) / 1000
      const darkPage = document.documentElement.dataset.theme === 'dark'
      const lightDots = ink === 'light' || (ink === 'auto' ? darkPage : !darkPage)
      const near = lightDots ? PAPER : INK

      const yaw = t * SPIN
      const cy = Math.cos(yaw)
      const sy2 = Math.sin(yaw)
      const scan = t * SCAN
      for (let i = 0; i < count; i++) {
        const x = pts[i * 3]!
        const y = pts[i * 3 + 1]!
        const z = pts[i * 3 + 2]!
        // spin about the vertical axis, then lean towards the viewer
        const x1 = x * cy + z * sy2
        const z1 = -x * sy2 + z * cy
        const y2 = y * ct - z1 * st
        const z2 = y * st + z1 * ct
        sx[i] = half + x1 * radius
        sy[i] = half - y2 * radius
        depth[i] = (z2 + 1) / 2
        // distance of this dot's longitude from the travelling meridian
        const off = Math.atan2(Math.sin(lon[i]! - scan), Math.cos(lon[i]! - scan))
        lit[i] = Math.max(0, 1 - Math.abs(off) / SCAN_WIDTH)
      }
      order.sort((a, b) => depth[a]! - depth[b]!)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      for (const i of order) {
        const d = depth[i]!
        const h = lit[i]! * lit[i]!
        const [r, g, b] = mix(mix(CYAN, near, d), CYAN, h * 0.85)
        const alpha = (0.16 + 0.84 * d) * (0.8 + 0.2 * h)
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(sx[i]!, sy[i]!, dot * (0.45 + 0.7 * d) * (1 + 0.8 * h), 0, Math.PI * 2)
        ctx.fill()
      }
      if (!still) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [size, ink])

  return <canvas ref={ref} aria-hidden className={`dot-orb ${className}`} style={{ width: size, height: size }} />
}
