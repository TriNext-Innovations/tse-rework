// Motion helpers shared across the storefront. Each animation here reports a
// change of state (an item going into the cart, a page loading, the theme
// changing). Movement is skipped when the shopper has asked for reduced
// motion. The CSS side of the vocabulary (tokens, keyframes, view
// transitions) is app/motion.css.

/** True when motion should be skipped: the OS setting asks for it, or there is no window/matchMedia (SSR, jsdom). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ─── Add to cart: the bubble ─────────────────────────────────────────────────

// Bubbles still on their way. The cart button waits on these so its count
// ticks over, and it pulses, the moment the bubble reaches it.
const flights = new Set<Promise<void>>()

/** Resolves when every bubble currently travelling has arrived; null when none are. */
export function flightsInProgress(): Promise<void> | null {
  if (flights.size === 0) return null
  return Promise.all([...flights]).then(() => undefined)
}

const CART_TARGET = '[data-cart-target]'
const POP_MS = 120 // the bubble appears on the button before it sets off
const STEPS = 32 // keyframes sampled along the arc

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Send a bubble from the button that was pressed up to the cart in the navbar,
 * carrying the product's picture, so the shopper's eye follows the item to
 * where it went. Resolves when it arrives (straight away when there is nothing
 * to animate).
 */
export function flyToCart(from: Element | null | undefined, image?: string | null): Promise<void> {
  if (!from || prefersReducedMotion()) return Promise.resolve()
  const target = document.querySelector(CART_TARGET)
  if (!target || typeof HTMLElement.prototype.animate !== 'function') return Promise.resolve()

  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  if (!a.width || !b.width) return Promise.resolve()

  const sx = a.left + a.width / 2
  const sy = a.top + a.height / 2
  const ex = b.left + b.width / 2
  const ey = b.top + b.height / 2
  const dx = ex - sx
  const dy = ey - sy
  // Quadratic arc: the bubble rises first, then sweeps across into the bag,
  // arriving almost level with it rather than dropping in from below.
  const cx = sx + dx * 0.2
  const cy = ey - dy * 0.2
  const travel = Math.round(Math.min(900, 520 + Math.hypot(dx, dy) * 0.28))

  const bubble = document.createElement('div')
  bubble.className = 'cart-bubble'
  bubble.setAttribute('aria-hidden', 'true')
  bubble.style.left = `${sx}px`
  bubble.style.top = `${sy}px`
  const inner = document.createElement('div')
  inner.className = 'cart-bubble-inner'
  if (image) {
    const img = document.createElement('img')
    img.src = image
    img.alt = ''
    inner.appendChild(img)
  } else {
    inner.classList.add('is-blank')
  }
  bubble.appendChild(inner)
  document.body.appendChild(bubble)

  // Keyframes evenly spaced in time; the easing is applied to the position
  // along the curve, so the bubble eases out of the button and into the bag.
  const frames: Keyframe[] = []
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS
    const t = easeInOutCubic(p)
    const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex - sx
    const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey - sy
    const scale = 1 - 0.6 * t
    const opacity = p < 0.82 ? 1 : 1 - ((p - 0.82) / 0.18) * 0.85
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`, opacity })
  }

  const pop = inner.animate(
    [
      { transform: 'scale(.3)', opacity: 0 },
      { transform: 'scale(1.1)', opacity: 1, offset: 0.65 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    { duration: POP_MS + 100, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' },
  )
  const fly = bubble.animate(frames, { duration: travel, delay: POP_MS, easing: 'linear', fill: 'forwards' })

  const arrived = Promise.all([pop.finished, fly.finished])
    .catch(() => undefined)
    .then(() => bubble.remove())
  flights.add(arrived)
  arrived.finally(() => flights.delete(arrived))
  return arrived
}

/** The picture to put in the bubble: the card's image as already loaded, else the product thumbnail. */
export function bubbleImage(card: Element | null | undefined, fallback?: string | null): string | null {
  const img = card?.querySelector('img')
  return img?.currentSrc || img?.src || fallback || null
}

// ─── Navigation progress ─────────────────────────────────────────────────────

/** Fired before a programmatic navigation, with `detail.href`, so PageLoading can watch it. */
export const NAVIGATION_START_EVENT = 'tse:navigation-start'

/**
 * Tell PageLoading a router.push() is starting. Link clicks are picked up on
 * their own; a navigation to the page already showing is ignored, because the
 * route would never change and the loading state would never end.
 */
export function announceNavigation(href: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(href, window.location.href)
  if (url.pathname === window.location.pathname && url.search === window.location.search) return
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: { href: url.href } }))
}

// ─── Theme ───────────────────────────────────────────────────────────────────

/**
 * Run `update` inside a view transition that reveals the new state as a circle
 * growing from (x, y). Falls back to a plain update without the API or with
 * reduced motion.
 */
export function revealFrom(x: number, y: number, update: () => void): void {
  if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
    update()
    return
  }
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const root = document.documentElement
  root.classList.add('theme-reveal')
  const transition = document.startViewTransition(update)
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => undefined)
  const done = () => root.classList.remove('theme-reveal')
  transition.finished.then(done, done)
}
