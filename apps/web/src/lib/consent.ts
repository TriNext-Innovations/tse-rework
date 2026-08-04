/**
 * Cookie-consent state, shared by the banner that captures it and anything
 * that has to wait for it (currently GA4).
 *
 * POPIA: analytics is not "strictly necessary", so nothing that sets an
 * analytics cookie may load before the visitor has chosen "Accept all".
 * `necessary` is treated exactly like no answer at all for that purpose.
 */

export const CONSENT_STORAGE_KEY = 'tse_cookie_consent'
export const CONSENT_EVENT = 'tse:consent'

export type ConsentLevel = 'all' | 'necessary'

export function readConsent(): ConsentLevel | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
    return stored === 'all' || stored === 'necessary' ? stored : null
  } catch {
    // localStorage unavailable (private mode, or called during SSR)
    return null
  }
}

/**
 * Persist the visitor's choice and tell the current page about it, so consent
 * takes effect on the click rather than on the next navigation.
 */
export function writeConsent(level: ConsentLevel): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, level)
  } catch {
    // Non-fatal: the banner still dismisses, it just reappears next visit.
  }
  window.dispatchEvent(new CustomEvent<ConsentLevel>(CONSENT_EVENT, { detail: level }))
}
