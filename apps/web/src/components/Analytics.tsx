'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CONSENT_EVENT, readConsent, type ConsentLevel } from '@/lib/consent'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * gtag queues into `dataLayer` and the library drains the queue once it loads,
 * so calls made before the script arrives are not lost — as long as the shim
 * exists. Defining it here (rather than in an inline <Script>) removes any
 * dependence on which of the two executes first.
 */
function ensureGtag(): (...args: unknown[]) => void {
  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    window.gtag = function gtag() {
      // GA reads the raw Arguments object — pushing a copied array breaks it.
      window.dataLayer!.push(arguments)
    }
  }
  return window.gtag
}

/**
 * GA4, loaded only after the visitor accepts all cookies (see `lib/consent`).
 * No measurement ID configured = renders nothing, so non-production
 * environments stay silent without any extra branching.
 *
 * Page views are sent by hand on route change, because App Router navigations
 * are history pushes rather than document loads.
 *
 * TODO(claus): this assumes GA4 Enhanced Measurement has "Page changes based
 * on browser history events" switched OFF for the property. Leave it on and
 * every SPA navigation is counted twice — once by us, once by Google.
 */
export function Analytics() {
  const pathname = usePathname()
  const [granted, setGranted] = useState(false)
  const configured = useRef(false)

  useEffect(() => {
    setGranted(readConsent() === 'all')

    function onConsent(event: Event) {
      setGranted((event as CustomEvent<ConsentLevel>).detail === 'all')
    }

    window.addEventListener(CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(CONSENT_EVENT, onConsent)
  }, [])

  useEffect(() => {
    if (!granted || !GA_ID) return

    const gtag = ensureGtag()

    if (!configured.current) {
      gtag('js', new Date())
      gtag('config', GA_ID, { send_page_view: false })
      configured.current = true
    }

    // Query string is read live rather than via useSearchParams — that hook
    // would opt the whole tree out of static rendering for one analytics field.
    gtag('event', 'page_view', {
      page_path: `${pathname}${window.location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [granted, pathname])

  if (!granted || !GA_ID) return null

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
}
