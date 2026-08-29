import { describe, it, expect } from 'vitest'
import { mapStatus, parseTracking, trackingStatusLabel } from '@tse/types'

// The parser exists because ShipLogic publishes no schema for
// GET /tracking/shipments and the payload shape has moved before (#330).
// These tests are the contract: whatever arrives, a customer sees a sane
// timeline and never a raw error.

describe('mapStatus', () => {
  it('maps the documented ShipLogic statuses onto our stages', () => {
    expect(mapStatus('submitted')).toBe('preparing')
    expect(mapStatus('collected')).toBe('collected')
    expect(mapStatus('in-transit')).toBe('in_transit')
    expect(mapStatus('at-hub')).toBe('in_transit')
    expect(mapStatus('out-for-delivery')).toBe('out_for_delivery')
    expect(mapStatus('delivered')).toBe('delivered')
  })

  it('is insensitive to case and separator style', () => {
    for (const variant of ['Out For Delivery', 'OUT_FOR_DELIVERY', 'out-for-delivery', ' out for delivery ']) {
      expect(mapStatus(variant)).toBe('out_for_delivery')
    }
  })

  it('maps failure states to exceptions, not to timeline stages', () => {
    expect(mapStatus('returned')).toBe('returned')
    expect(mapStatus('cancelled')).toBe('cancelled')
    expect(mapStatus('failed-delivery')).toBe('exception')
  })

  it('falls back rather than throwing on an unknown or absent status', () => {
    expect(mapStatus('some-new-status-shiplogic-invented')).toBe('in_transit')
    expect(mapStatus(undefined)).toBe('in_transit')
    expect(mapStatus(null)).toBe('in_transit')
    expect(mapStatus(42)).toBe('in_transit')
    expect(mapStatus('')).toBe('in_transit')
    expect(mapStatus('', 'preparing')).toBe('preparing')
  })

  it('never invents a delivery', () => {
    // The one wrong answer that would have a customer waiting at the door.
    expect(mapStatus('who-knows')).not.toBe('delivered')
  })
})

describe('parseTracking', () => {
  const payload = {
    shipments: [
      {
        status: 'in-transit',
        tracking_events: [
          { status: 'submitted', date: '2026-08-20T08:00:00Z', message: 'Waybill created' },
          { status: 'collected', date: '2026-08-20T14:30:00Z', message: 'Collected from sender' },
          { status: 'in-transit', date: '2026-08-21T06:15:00Z', message: 'At Johannesburg hub' },
        ],
      },
    ],
  }

  it('reads the shape ShipLogic actually returns', () => {
    const { status, events } = parseTracking(payload)
    expect(status).toBe('in_transit')
    expect(events).toHaveLength(3)
    expect(events[0]!).toMatchObject({ status: 'preparing', description: 'Waybill created' })
  })

  it('orders events oldest first, whatever order they arrived in', () => {
    const shuffled = {
      shipments: [{ status: 'in-transit', tracking_events: [...payload.shipments[0]!.tracking_events].reverse() }],
    }
    const { events } = parseTracking(shuffled)
    expect(events.map((e) => e.date)).toEqual([
      '2026-08-20T08:00:00.000Z',
      '2026-08-20T14:30:00.000Z',
      '2026-08-21T06:15:00.000Z',
    ])
  })

  it('accepts a bare shipment object, not just a shipments array', () => {
    const { status } = parseTracking(payload.shipments[0]!)
    expect(status).toBe('in_transit')
  })

  it('accepts checkpoints as an alias for tracking_events', () => {
    const { events } = parseTracking({
      status: 'delivered',
      checkpoints: [{ status: 'delivered', timestamp: '2026-08-22T10:00:00Z', description: 'Signed for' }],
    })
    expect(events).toHaveLength(1)
    expect(events[0]!.description).toBe('Signed for')
  })

  it('lets an exception in the events override an optimistic headline status', () => {
    // A returned parcel whose header still says in-transit must not render as
    // "step 3 of 5, on its way".
    const { status } = parseTracking({
      shipments: [
        {
          status: 'in-transit',
          tracking_events: [
            { status: 'collected', date: '2026-08-20T14:30:00Z' },
            { status: 'returned', date: '2026-08-23T09:00:00Z' },
          ],
        },
      ],
    })
    expect(status).toBe('returned')
  })

  it('derives status from the furthest event when the headline is unrecognised', () => {
    const { status } = parseTracking({
      shipments: [
        {
          status: 'something-unmapped',
          tracking_events: [
            { status: 'collected', date: '2026-08-20T14:30:00Z' },
            { status: 'out-for-delivery', date: '2026-08-21T07:00:00Z' },
          ],
        },
      ],
    })
    expect(status).toBe('out_for_delivery')
  })

  it('survives garbage instead of throwing', () => {
    for (const junk of [null, undefined, 'a string', 42, [], {}, { shipments: [] }, { shipments: 'nope' }]) {
      const result = parseTracking(junk)
      expect(result.events).toEqual([])
      expect(typeof result.status).toBe('string')
    }
  })

  it('drops unreadable events rather than the whole timeline', () => {
    const { events } = parseTracking({
      shipments: [{ status: 'collected', tracking_events: [null, 'nonsense', { status: 'collected', date: '2026-08-20T14:30:00Z' }] }],
    })
    expect(events).toHaveLength(1)
  })

  it('tolerates events with no usable date', () => {
    const { events } = parseTracking({
      shipments: [{ status: 'collected', tracking_events: [{ status: 'collected', date: 'not-a-date' }] }],
    })
    expect(events[0]!.date).toBeNull()
  })
})

describe('trackingStatusLabel', () => {
  it('gives every status customer-facing wording', () => {
    expect(trackingStatusLabel('out_for_delivery')).toBe('Out for delivery')
    expect(trackingStatusLabel('returned')).toBe('Returned to sender')
  })
})
