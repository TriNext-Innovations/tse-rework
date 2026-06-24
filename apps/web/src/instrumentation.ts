export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; renderSource: string },
) => {
  const { captureRequestError } = await import('@sentry/nextjs')
  // Next.js hook shapes diverge from Sentry v10 types — casts are safe at runtime
  captureRequestError(
    err,
    request as Parameters<typeof captureRequestError>[1],
    context as unknown as Parameters<typeof captureRequestError>[2],
  )
}
