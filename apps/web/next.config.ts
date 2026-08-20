import path from 'path'
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Derive cross-origin connect targets from the public env so the CSP stays
// correct across dev/prod (api host + Sentry change per environment). The
// Meilisearch host is same-origin (served under /meili), so 'self' covers it.
function originOf(url?: string): string | null {
  if (!url) return null
  try { return new URL(url).origin } catch { return null }
}

const connectSrc = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL),
  originOf(process.env.NEXT_PUBLIC_MEILISEARCH_HOST),
  originOf(process.env.NEXT_PUBLIC_SENTRY_DSN),
  'https://*.sentry.io',
].filter(Boolean).join(' ')

// GA4 (consent-gated — see components/analytics). gtag.js is fetched from
// googletagmanager.com and then beacons measurement data to google-analytics.com,
// so BOTH a script-src and a connect-src entry are required. Missing either one
// fails silently: the tag simply never reports and the property reads zero.
// google-analytics.com is wildcarded because GA4 routes to regional collectors
// (regionN.google-analytics.com) chosen at runtime, not to a fixed host.
const GTM_SCRIPT_SRC = 'https://www.googletagmanager.com'
const GA_CONNECT_SRC = [
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://www.googletagmanager.com',
].join(' ')

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js relies on inline runtime bootstrap; eval kept for safety with some
  // deps. maps.googleapis/gstatic host the Places autocomplete library.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com ${GTM_SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  // https: covers R2/Supabase product images without enumerating every CDN host.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // maps.googleapis.com loads the JS bootstrap; places.googleapis.com serves the
  // Places (New) Autocomplete data calls used by the checkout address field.
  `connect-src ${connectSrc} https://maps.googleapis.com https://places.googleapis.com ${GA_CONNECT_SRC}`,
  // Checkout posts to www.payfast.co.za/eng/process, which 302-redirects the
  // browser to payment.payfast.io to complete payment. form-action is enforced on
  // EVERY hop, so BOTH domains must be listed — the payment page lives on the
  // separate payfast.io domain, not payfast.co.za. Apex entries are needed too:
  // a leading-* source matches sub-domains only, never the bare apex.
  "form-action 'self' https://*.payfast.co.za https://payfast.co.za https://*.payfast.io https://payfast.io",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  // @tse/types ships raw TS (main: src/index.ts) and is consumed straight from
  // the workspace symlink. Under output:'standalone' it has to be transpiled
  // explicitly or the B2B constants shared with the backend won't compile.
  transpilePackages: ['@tse/types'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Product images are moving off the pub-*.r2.dev endpoint (a Cloudflare
      // development URL, rate-limited at their discretion) onto a custom domain
      // bound to the same R2 bucket. Both are listed while the DB URLs migrate.
      // Note: remotePatterns matches hostnames exactly, so the apex entry below
      // does NOT cover images.* — it needs its own line or next/image 400s.
      { protocol: 'https', hostname: 'images.tse-cartridges.co.za' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'tse.co.za' },
      { protocol: 'https', hostname: 'www.tse.co.za' },
      { protocol: 'https', hostname: 'tse-cartridges.co.za' },
    ],
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingExcludes: {
    '*': ['**/node_modules/**'],
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  automaticVercelMonitors: false,
})
