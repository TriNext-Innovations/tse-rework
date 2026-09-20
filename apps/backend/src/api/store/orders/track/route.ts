import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { parseTracking, type TrackingResult } from '@tse/types'
import { CourierGuyClient } from '../../../../modules/courier-guy/client'

type TrackBody = { order_number?: string | number; email?: string }

/**
 * The same response for "no such order" and "wrong email". Distinguishing them
 * would turn this unauthenticated endpoint into an order-number oracle: order
 * numbers are sequential, so an attacker could otherwise enumerate which ones
 * exist and harvest the associated email domains.
 */
const NOT_FOUND = {
  error: "We couldn't find an order with that number and email address.",
}

/**
 * Rate limit per IP. The lookup is unauthenticated and each miss is a cheap DB
 * hit but each hit costs a call to a third-party API, so this exists mostly to
 * stop someone walking the order-number space.
 *
 * In-process on purpose: the backend runs as a single container (see
 * docker-compose.prod.yml), so a shared store would be complexity without
 * benefit today. If the API is ever scaled horizontally this must move to
 * Redis, or each replica will allow the full quota.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

/**
 * Cache courier responses briefly. A customer waiting on a parcel refreshes;
 * ShipLogic statuses change on the order of hours, not seconds, so serving a
 * 60s-old timeline is invisible to them and keeps us well clear of any rate
 * limit on their side.
 */
const TRACKING_CACHE_TTL_MS = 60_000
const trackingCache = new Map<string, { at: number; payload: unknown }>()

/** Keep the two in-process maps from growing without bound on a long-lived container. */
function prune(): void {
  const now = Date.now()
  for (const [key, entry] of attempts) if (now > entry.resetAt) attempts.delete(key)
  for (const [key, entry] of trackingCache) {
    if (now - entry.at > TRACKING_CACHE_TTL_MS) trackingCache.delete(key)
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  prune()

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many lookups. Please try again in a minute.' })
  }

  const { order_number, email } = (req.body ?? {}) as TrackBody

  const displayId = Number(String(order_number ?? '').replace(/[^0-9]/g, ''))
  const normalisedEmail = String(email ?? '').trim().toLowerCase()

  if (!Number.isInteger(displayId) || displayId <= 0 || normalisedEmail === '') {
    return res.status(400).json({ error: 'An order number and email address are required.' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let order: any
  try {
    const { data: orders } = await query.graph({
      entity: 'order',
      filters: { display_id: displayId },
      fields: ['id', 'display_id', 'email', 'created_at', 'fulfillments.*'],
    })
    order = orders?.[0]
  } catch (err: any) {
    console.error('[track] order lookup failed:', err?.message ?? err)
    return res.status(500).json({ error: 'Something went wrong looking up your order.' })
  }

  if (!order || String(order.email ?? '').trim().toLowerCase() !== normalisedEmail) {
    return res.status(404).json(NOT_FOUND)
  }

  // Newest fulfillment wins: a split or re-booked shipment leaves older
  // fulfillment rows behind, and the customer cares about the live one.
  const fulfillments: any[] = Array.isArray(order.fulfillments) ? [...order.fulfillments] : []
  fulfillments.sort(
    (a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime(),
  )
  const fulfillment = fulfillments[0]

  // Same fallback chain as the order-shipment-created subscriber: where the
  // reference lives depends on how the waybill was created.
  const trackingReference: string | null =
    fulfillment?.tracking_numbers?.[0] ??
    fulfillment?.data?.tracking_reference ??
    fulfillment?.data?.waybill_number ??
    null

  const trackingUrl = trackingReference
    ? (process.env.TCG_TRACKING_URL_TEMPLATE ?? 'https://www.thecourierguy.co.za/track?ref={ref}')
        .replace('{ref}', encodeURIComponent(trackingReference))
    : null

  const base: TrackingResult = {
    order_number: order.display_id,
    order_date: new Date(order.created_at).toISOString(),
    status: 'preparing',
    tracking_reference: trackingReference,
    tracking_url: trackingUrl,
    events: [],
    live_tracking_available: false,
  }

  // No waybill yet — a real state, not an error. The order is being picked.
  if (!trackingReference) return res.json(base)

  const apiKey = process.env.TCG_API_KEY
  if (!apiKey) {
    console.warn('[track] TCG_API_KEY is unset — serving order state without live tracking')
    return res.json(base)
  }

  let payload: unknown
  const cached = trackingCache.get(trackingReference)
  if (cached && Date.now() - cached.at < TRACKING_CACHE_TTL_MS) {
    payload = cached.payload
  } else {
    try {
      // The fulfillment provider service owns a client, but it is registered
      // under the fulfillment module's provider container and is not
      // resolvable from a store route; constructing one here is cheaper than
      // reaching through that, and matches how the service builds its own.
      const client = new CourierGuyClient(apiKey, process.env.TCG_API_URL || undefined)
      payload = await client.getTracking(trackingReference)
      trackingCache.set(trackingReference, { at: Date.now(), payload })
    } catch (err: any) {
      // The courier being down is not the customer's problem: show the order
      // and the reference, and let them use the courier's own page.
      console.error(`[track] courier lookup failed for ${trackingReference}:`, err?.message ?? err)
      return res.json(base)
    }
  }

  const { status, events } = parseTracking(payload)
  return res.json({ ...base, status, events, live_tracking_available: true })
}
