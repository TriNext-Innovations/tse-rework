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

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js relies on inline runtime bootstrap; eval kept for safety with some
  // deps. maps.googleapis/gstatic host the Places autocomplete library.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  // https: covers R2/Supabase product images without enumerating every CDN host.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc} https://maps.googleapis.com`,
  // Checkout posts to the PayFast hosted page (redirect), never an iframe here.
  "form-action 'self' https://*.payfast.co.za",
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
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
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
