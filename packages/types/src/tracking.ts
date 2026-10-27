/**
 * Shipment tracking vocabulary shared by the backend tracking route and the
 * storefront's /track page (#330).
 *
 * ShipLogic (The Courier Guy's platform) emits a wider, less stable set of
 * status strings than a customer needs to see, so the backend collapses them
 * onto these five stages and the storefront only ever renders these.
 */

export const TRACKING_STAGES = [
  'preparing',
  'collected',
  'in_transit',
  'out_for_delivery',
  'delivered',
] as const

export type TrackingStage = (typeof TRACKING_STAGES)[number]

/**
 * Terminal states that are not `delivered`. These sit outside the linear
 * timeline — rendering them as "step 3 of 5" would be a lie.
 */
export const TRACKING_EXCEPTIONS = ['returned', 'cancelled', 'exception'] as const
export type TrackingException = (typeof TRACKING_EXCEPTIONS)[number]

export type TrackingStatus = TrackingStage | TrackingException

export const TRACKING_STAGE_LABELS: Record<TrackingStage, string> = {
  preparing: 'Preparing your order',
  collected: 'Collected by the courier',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
}

export const TRACKING_EXCEPTION_LABELS: Record<TrackingException, string> = {
  returned: 'Returned to sender',
  cancelled: 'Shipment cancelled',
  exception: 'Delayed — contact us',
}

export function isTrackingException(status: TrackingStatus): status is TrackingException {
  return (TRACKING_EXCEPTIONS as readonly string[]).includes(status)
}

export function trackingStatusLabel(status: TrackingStatus): string {
  return isTrackingException(status)
    ? TRACKING_EXCEPTION_LABELS[status]
    : TRACKING_STAGE_LABELS[status]
}

/** One entry in the customer-facing timeline. */
export type TrackingEvent = {
  status: TrackingStatus
  /** ISO 8601. */
  date: string | null
  description: string
}

export type TrackingResult = {
  order_number: number
  order_date: string
  status: TrackingStatus
  /** Courier reference, shown so a customer can phone the courier directly. */
  tracking_reference: string | null
  /** The courier's own tracking page, when we have a reference. */
  tracking_url: string | null
  events: TrackingEvent[]
  /**
   * True when the order exists but the courier has no shipment yet, or the
   * courier API could not be reached. The page still renders the order, just
   * without live progress.
   */
  live_tracking_available: boolean
}

/**
 * Normalise a ShipLogic tracking payload into the customer-facing vocabulary
 * defined above (#330).
 *
 * This parser lives beside the vocabulary rather than in the backend because it
 * is pure and worth testing, and apps/web is where the repo's vitest setup runs.
 *
 * `CourierGuyClient.getTracking` is typed `Record<string, unknown>` because
 * ShipLogic does not publish a schema for it and the shape has moved before.
 * Everything here is therefore defensive: unknown statuses degrade to the
 * nearest sane stage rather than throwing, and a payload we cannot read at all
 * yields an empty timeline instead of an error page.
 */

/**
 * ShipLogic status strings seen in their docs and in waybill payloads, mapped
 * onto our five stages. Matching is done on a normalised (lowercased,
 * non-alphanumerics collapsed to `-`) form, so `Out For Delivery`,
 * `out-for-delivery` and `OUT_FOR_DELIVERY` all land in the same bucket.
 */
const STATUS_MAP: Record<string, TrackingStatus> = {
  // pre-collection
  'submitted': 'preparing',
  'pending': 'preparing',
  'booked': 'preparing',
  'waiting-for-collection': 'preparing',
  'collection-assigned': 'preparing',
  'collection-scheduled': 'preparing',
  // collected
  'collected': 'collected',
  'picked-up': 'collected',
  // in transit
  'in-transit': 'in_transit',
  'at-hub': 'in_transit',
  'at-destination-hub': 'in_transit',
  'in-progress': 'in_transit',
  'sorting': 'in_transit',
  // final leg
  'out-for-delivery': 'out_for_delivery',
  'with-driver': 'out_for_delivery',
  // done
  'delivered': 'delivered',
  'pod-received': 'delivered',
  // exceptions
  'returned': 'returned',
  'return-to-sender': 'returned',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'failed': 'exception',
  'failed-delivery': 'exception',
  'failed-collection': 'exception',
  'exception': 'exception',
  'on-hold': 'exception',
}

function normaliseKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Map one raw ShipLogic status. Unknown values fall back to `in_transit` when
 * a shipment demonstrably exists — claiming "preparing" for a parcel already
 * moving is worse than being vague, and claiming "delivered" is far worse.
 */
export function mapStatus(raw: unknown, fallback: TrackingStatus = 'in_transit'): TrackingStatus {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  return STATUS_MAP[normaliseKey(raw)] ?? fallback
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function firstArray(...candidates: unknown[]): unknown[] {
  for (const c of candidates) if (Array.isArray(c)) return c
  return []
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function asText(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim()
  }
  return ''
}

/** Rank of a stage in the linear timeline; exceptions rank -1. */
function stageRank(status: TrackingStatus): number {
  return (TRACKING_STAGES as readonly string[]).indexOf(status)
}

export type ParsedTracking = {
  status: TrackingStatus
  events: TrackingEvent[]
}

/**
 * Pull a timeline out of whatever ShipLogic returned.
 *
 * Handles the shapes we know about — `{ shipments: [...] }`, a bare shipment
 * object, and either `tracking_events` or `checkpoints` for the event list —
 * and returns an empty timeline for anything else rather than throwing.
 */
export function parseTracking(payload: unknown): ParsedTracking {
  const root = asRecord(payload)
  if (!root) return { status: 'preparing', events: [] }

  const shipments = firstArray(root.shipments, root.data, root.results)
  const shipment = asRecord(shipments[0]) ?? root

  const rawEvents = firstArray(
    shipment.tracking_events,
    shipment.events,
    shipment.checkpoints,
    root.tracking_events,
  )

  const events: TrackingEvent[] = rawEvents
    .map((raw) => {
      const e = asRecord(raw)
      if (!e) return null
      const status = mapStatus(e.status ?? e.state ?? e.event)
      return {
        status,
        date: asIsoDate(e.date ?? e.timestamp ?? e.created_at ?? e.time),
        description: asText(e.message, e.description, e.status_description, e.source),
      }
    })
    .filter((e): e is TrackingEvent => e !== null)
    // Oldest first — the UI reads top to bottom as the parcel's journey.
    .sort((a, b) => {
      if (a.date === null || b.date === null) return 0
      return a.date.localeCompare(b.date)
    })

  // Prefer the shipment's own status field; fall back to the furthest stage
  // any event reached. An exception anywhere wins, since a returned parcel is
  // not "in transit" no matter what the header says.
  const headline = shipment.status ?? root.status
  let status: TrackingStatus = mapStatus(headline, events.length ? 'in_transit' : 'preparing')

  const exceptional = events.find((e) => stageRank(e.status) === -1)
  if (exceptional) {
    status = exceptional.status
  } else if (typeof headline !== 'string' || !STATUS_MAP[normaliseKey(headline)]) {
    const furthest = events.reduce<TrackingStage | null>((acc, e) => {
      const rank = stageRank(e.status)
      if (rank === -1) return acc
      const accRank = acc ? stageRank(acc) : -1
      return rank > accRank ? (e.status as TrackingStage) : acc
    }, null)
    if (furthest) status = furthest
  }

  return { status, events }
}
