/**
 * Where to send the shopper after they sign in or register (`?next=`).
 * Internal paths only: "//evil.com", "/\evil.com" (browsers read the backslash
 * as a slash) or "https://…" must never become an open redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  const value = raw ?? ''
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}

/** Append `?next=` to an auth page link, keeping the destination through login ⇄ register. */
export function withNext(href: string, next: string | null): string {
  return next ? `${href}?next=${encodeURIComponent(next)}` : href
}
