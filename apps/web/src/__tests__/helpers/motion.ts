import { vi } from 'vitest'

// jsdom has no matchMedia, which lib/motion reads as "reduced motion" — so by
// default nothing animates in tests. These helpers switch motion on, and stub
// the Web Animations API that jsdom also lacks.

export function allowMotion() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
}

export function preferReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
}

/** Stub element.animate(); each call returns an animation that finishes when `land()` is called. */
export function stubAnimate() {
  let land!: () => void
  const finished = new Promise<void>((resolve) => {
    land = resolve
  })
  const animate = vi.fn(() => ({ finished }))
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, writable: true, value: animate })
  return { animate, land: () => land() }
}

export function resetMotion() {
  delete (window as { matchMedia?: unknown }).matchMedia
  delete (HTMLElement.prototype as { animate?: unknown }).animate
}
