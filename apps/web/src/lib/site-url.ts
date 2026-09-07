// The origin this storefront publishes itself under.
//
// Every canonical, OpenGraph URL, JSON-LD @id, sitemap entry, robots directive
// and Merchant feed link resolves from here. Before this module the apex was
// hardcoded in 13 files, which made a domain change a find-and-replace across
// the codebase — and a missed occurrence would publish a canonical pointing at
// a domain we no longer serve, which is the one class of SEO bug that is both
// silent and expensive.
//
// Set NEXT_PUBLIC_SITE_URL to move the site. It is already threaded through
// apps/web/Dockerfile (ARG + ENV) and the `web` service's build args, so the
// only change needed is the value in `.env` on the server.
//
// ⚠ NEXT_PUBLIC_* is inlined by Next at BUILD time, not read at runtime.
// Changing this env var requires rebuilding the web image — restarting the
// container will not pick it up. See docs/DOMAIN-CUTOVER.md.

/**
 * Only an https origin is accepted. `.env.example` ships
 * `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for the dev server, and quietly
 * inheriting that in a production build would stamp `http://localhost:3000`
 * into every canonical and JSON-LD id on the live site. Falling back to the
 * real apex is the safe failure: worst case we publish the domain we are
 * already on, rather than one that does not resolve.
 */
const FALLBACK = 'https://tse-cartridges.co.za'

const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()

/** Absolute origin, no trailing slash. e.g. `https://tse-cartridges.co.za` */
export const SITE_URL: string = (
  configured?.startsWith('https://') ? configured : FALLBACK
).replace(/\/+$/, '')

/** Bare hostname, for prose that names the site. e.g. `tse-cartridges.co.za` */
export const SITE_HOST: string = new URL(SITE_URL).host

/** Absolute URL for a root-relative path. `siteUrl('/products')` */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
