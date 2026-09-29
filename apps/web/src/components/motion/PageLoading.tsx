'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { NAVIGATION_START_EVENT } from '@/lib/motion'
import { DotOrb } from './DotOrb'

// Most navigations land before this: nothing is shown for them at all.
const SHOW_AFTER_MS = 300
// If the route never changes (a failed or cancelled navigation), stop anyway.
const GIVE_UP_MS = 10_000

/** What is being replaced: a whole page, or just the results on this one (filters, sort). */
type Kind = 'page' | 'results'

type Pending = { kind: Kind; label: string }

/** Where the shopper is headed, in their words. */
export function destinationLabel(url: URL): string {
  const path = url.pathname
  if (path === '/') return 'Loading home'
  if (path === '/products') return url.search ? 'Finding cartridges' : 'Loading all cartridges'
  if (path.startsWith('/products/')) return 'Loading product'
  if (path.startsWith('/cartridges/')) return 'Loading cartridges'
  if (path.startsWith('/compatibility')) return 'Finding cartridges for your printer'
  if (path.startsWith('/printers')) return 'Loading printer'
  if (path.startsWith('/cart')) return 'Loading your cart'
  if (path.startsWith('/checkout')) return 'Loading checkout'
  if (path.startsWith('/account')) return 'Loading your account'
  if (path.startsWith('/b2b')) return 'Loading business pricing'
  return 'Loading'
}

// '?a=b%20c' and '?a=b+c' are the same query; compare them as the router does.
function normalQuery(search: string): string {
  const q = new URLSearchParams(search).toString()
  return q ? `?${q}` : ''
}

function pendingFor(href: string): Pending | null {
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin) return null
  if (url.pathname !== window.location.pathname) return { kind: 'page', label: destinationLabel(url) }
  // Same path: only a change of query is a navigation. A hash is a scroll.
  if (normalQuery(url.search) !== normalQuery(window.location.search)) {
    return { kind: 'results', label: destinationLabel(url) }
  }
  return null
}

/**
 * When the next page is slow to arrive, the page being left steps back and the
 * dotted orb turns in the middle of the screen, saying what is loading. Quick
 * navigations show nothing. Starts on clicks on in-app links, on
 * announceNavigation() (router.push) and on back/forward; ends when the URL
 * changes.
 *
 * While it shows, <html data-navigating="page|results"> lets CSS dim what is
 * about to be replaced: [data-page-content] or [data-results].
 */
export function PageLoading() {
  const pathname = usePathname()
  const search = useSearchParams()
  const query = search.toString()
  const route = query ? `${pathname}?${query}` : pathname
  const [shown, setShown] = useState<Pending | null>(null)
  const active = useRef(false)
  const currentRoute = useRef(route)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const finish = useRef(() => {})
  finish.current = () => {
    if (!active.current) return
    active.current = false
    clearTimers()
    delete document.documentElement.dataset.navigating
    setShown(null)
  }

  useEffect(() => {
    const start = (pending: Pending | null) => {
      if (!pending || active.current) return
      active.current = true
      clearTimers()
      timers.current.push(
        setTimeout(() => {
          setShown(pending)
          document.documentElement.dataset.navigating = pending.kind
        }, SHOW_AFTER_MS),
        setTimeout(() => finish.current(), GIVE_UP_MS),
      )
    }

    // Capture phase: Next's <Link> prevents the default itself, so by the
    // bubble phase every in-app link click looks "prevented".
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as Element | null
      const link = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link) return
      // A button inside a card link (add to cart) is not a navigation.
      const control = target?.closest('button, input, select, textarea, label')
      if (control && link.contains(control)) return
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return
      start(pendingFor(link.href))
    }
    const onAnnounced = (e: Event) => {
      const href = (e as CustomEvent<{ href?: string }>).detail?.href
      if (href) start(pendingFor(href))
    }
    // Back/forward. Browsers also fire popstate when a same-page #anchor is
    // followed; the URL then differs from the rendered route only by its hash,
    // and nothing is loading.
    const onPop = () => {
      const now = window.location.pathname + normalQuery(window.location.search)
      if (now === currentRoute.current) return
      start({ kind: 'page', label: destinationLabel(new URL(window.location.href)) })
    }

    window.addEventListener('click', onClick, true)
    window.addEventListener(NAVIGATION_START_EVENT, onAnnounced)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener(NAVIGATION_START_EVENT, onAnnounced)
      window.removeEventListener('popstate', onPop)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    currentRoute.current = route
    finish.current()
  }, [route])

  return (
    <div className="page-loading" data-visible={Boolean(shown)} role="status">
      {shown && (
        <div className="page-loading-stage">
          <DotOrb size={72} />
          <span className="page-loading-label">{shown.label}…</span>
        </div>
      )}
    </div>
  )
}
