import * as Sentry from '@sentry/node'

let initialized = false

export function initSentry(): void {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.httpIntegration()],
  })

  initialized = true
  console.log('[sentry] initialized')
}

export { Sentry }
