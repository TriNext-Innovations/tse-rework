import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  prefersReducedMotion,
  flyToCart,
  flightsInProgress,
  bubbleImage,
  announceNavigation,
  NAVIGATION_START_EVENT,
  revealFrom,
} from '@/lib/motion'
import { allowMotion, preferReducedMotion, resetMotion, stubAnimate } from '../helpers/motion'

afterEach(() => {
  resetMotion()
  document.body.innerHTML = ''
  document.documentElement.className = ''
  delete (document as { startViewTransition?: unknown }).startViewTransition
})

function stage() {
  document.body.innerHTML = '<button id="add">+</button><button data-cart-target></button>'
  return document.getElementById('add')
}

describe('prefersReducedMotion', () => {
  it('reads a missing matchMedia (SSR, jsdom) as reduced', () => {
    expect(prefersReducedMotion()).toBe(true)
  })

  it('follows the OS setting', () => {
    preferReducedMotion()
    expect(prefersReducedMotion()).toBe(true)
    allowMotion()
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('flyToCart', () => {
  it('sends nothing when the shopper prefers reduced motion', async () => {
    preferReducedMotion()
    stubAnimate()
    await flyToCart(stage(), 'https://images.example/hp-85a.jpg')
    expect(document.querySelector('.cart-bubble')).toBeNull()
    expect(flightsInProgress()).toBeNull()
  })

  it('sends nothing when there is no cart button to go to', async () => {
    allowMotion()
    stubAnimate()
    document.body.innerHTML = '<button id="add">+</button>'
    await flyToCart(document.getElementById('add'), 'https://images.example/a.jpg')
    expect(document.querySelector('.cart-bubble')).toBeNull()
  })

  it('sends a bubble with the product picture from the button to the cart, then cleans up', async () => {
    allowMotion()
    const { animate, land } = stubAnimate()
    const arrived = flyToCart(stage(), 'https://images.example/hp-85a.jpg')

    const bubble = document.querySelector('.cart-bubble')
    expect(bubble).not.toBeNull()
    expect(bubble?.getAttribute('aria-hidden')).toBe('true')
    expect(bubble?.querySelector('img')?.getAttribute('src')).toBe('https://images.example/hp-85a.jpg')
    // It pops up on the button, then travels the arc.
    expect(animate).toHaveBeenCalledTimes(2)
    const [frames, timing] = animate.mock.calls[1] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(frames.length).toBeGreaterThan(10)
    expect(timing.delay).toBeGreaterThan(0)
    expect(flightsInProgress()).not.toBeNull()

    land()
    await arrived
    expect(document.querySelector('.cart-bubble')).toBeNull()
    expect(flightsInProgress()).toBeNull()
  })

  it('uses a plain cyan bubble when there is no picture', async () => {
    allowMotion()
    const { land } = stubAnimate()
    const arrived = flyToCart(stage())
    expect(document.querySelector('.cart-bubble-inner.is-blank')).not.toBeNull()
    land()
    await arrived
  })
})

describe('bubbleImage', () => {
  it("prefers the card's loaded image over the fallback", () => {
    document.body.innerHTML = '<article><img src="https://images.example/card.jpg" alt=""></article>'
    expect(bubbleImage(document.querySelector('article'), 'https://images.example/raw.jpg')).toBe(
      'https://images.example/card.jpg',
    )
  })

  it('falls back to the thumbnail, then to nothing', () => {
    document.body.innerHTML = '<article></article>'
    expect(bubbleImage(document.querySelector('article'), 'https://images.example/raw.jpg')).toBe(
      'https://images.example/raw.jpg',
    )
    expect(bubbleImage(null)).toBeNull()
  })
})

describe('announceNavigation', () => {
  it('signals the progress bar for a navigation to another page', () => {
    const heard = vi.fn()
    window.addEventListener(NAVIGATION_START_EVENT, heard)
    announceNavigation('/products?type=laser')
    expect(heard).toHaveBeenCalledOnce()
    expect((heard.mock.calls[0]![0] as CustomEvent<{ href: string }>).detail.href).toMatch(/\/products\?type=laser$/)
    window.removeEventListener(NAVIGATION_START_EVENT, heard)
  })

  it('stays quiet for the page already showing, which would never finish loading', () => {
    const heard = vi.fn()
    window.addEventListener(NAVIGATION_START_EVENT, heard)
    announceNavigation(window.location.pathname + window.location.search)
    expect(heard).not.toHaveBeenCalled()
    window.removeEventListener(NAVIGATION_START_EVENT, heard)
  })
})

describe('revealFrom', () => {
  it('applies the update directly when view transitions are unavailable', () => {
    allowMotion()
    const update = vi.fn()
    revealFrom(10, 10, update)
    expect(update).toHaveBeenCalledOnce()
  })

  it('runs the update inside a view transition and tidies up after it', async () => {
    allowMotion()
    let finish!: () => void
    const finished = new Promise<void>((r) => (finish = r))
    const startViewTransition = vi.fn((cb: () => void) => {
      cb()
      return { ready: Promise.resolve(), finished }
    })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    Object.defineProperty(document.documentElement, 'animate', { configurable: true, value: vi.fn() })

    const update = vi.fn()
    revealFrom(40, 20, update)
    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(document.documentElement.classList.contains('theme-reveal')).toBe(true)

    finish()
    await finished
    await Promise.resolve()
    expect(document.documentElement.classList.contains('theme-reveal')).toBe(false)
    delete (document.documentElement as { animate?: unknown }).animate
  })
})
