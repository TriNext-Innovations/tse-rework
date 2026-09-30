import { describe, it, expect } from 'vitest'
import type { FulfillmentEmailContext } from '../../lib/order-for-email'
import {
  fulfillmentCreatedEmail,
  shipmentCreatedEmail,
  deliveryCreatedEmail,
} from '../../emails/order-status-messages'
import { isCollectMethod } from '../../lib/collection-point'

function ctx(over: Partial<FulfillmentEmailContext> = {}): FulfillmentEmailContext {
  return {
    fulfillmentId: 'ful_1',
    providerId: 'shiplogic_shiplogic',
    trackingNumber: 'TCG123',
    trackingUrl: 'https://track.example/TCG123',
    order: {
      id: 'order_1',
      displayId: 1042,
      email: 'c@example.com',
      customerName: 'Thandi M',
      serviceName: 'The Courier Guy — Economy (3–4 business days)',
      serviceCode: 'ECO',
      address: { name: 'Thandi M', line1: '1 Home Street', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '4001' },
    },
    isCollect: false,
    isCourierGuy: true,
    ...over,
  }
}

const collect = () =>
  ctx({
    providerId: 'manual_manual',
    trackingNumber: null,
    trackingUrl: null,
    isCollect: true,
    isCourierGuy: false,
    order: { ...ctx().order, serviceName: 'Collect from Kya Sands Warehouse', serviceCode: undefined },
  })

describe('isCollectMethod', () => {
  it('matches Collect but not courier or Pudo', () => {
    expect(isCollectMethod('Collect from Kya Sands Warehouse')).toBe(true)
    expect(isCollectMethod('The Courier Guy — Overnight (next business day)')).toBe(false)
    expect(isCollectMethod('Pudo Locker Delivery')).toBe(false)
    expect(isCollectMethod(null)).toBe(false)
  })
})

describe('fulfillment created', () => {
  it('tells a Collect customer it is ready, with the warehouse address', () => {
    const e = fulfillmentCreatedEmail(collect())
    expect(e.subject).toContain('ready for collection')
    expect(e.html).toContain('Kya Sands, Johannesburg, 2163')
    expect(e.html).not.toContain('1 Home Street')
  })

  it('tells a courier customer it is packed and booked, with tracking', () => {
    const e = fulfillmentCreatedEmail(ctx())
    expect(e.subject).toContain('is packed')
    expect(e.html).toContain('booked with The Courier Guy')
    expect(e.html).toContain('TCG123')
    expect(e.html).not.toContain('ready for collection')
  })

  it('does not name The Courier Guy for a Pudo order', () => {
    const e = fulfillmentCreatedEmail(ctx({
      providerId: 'manual_manual', isCourierGuy: false, trackingNumber: null, trackingUrl: null,
      order: { ...ctx().order, serviceName: 'Pudo Locker Delivery', serviceCode: undefined },
    }))
    expect(e.html).not.toContain('Courier Guy')
  })
})

describe('shipment created', () => {
  it('sends nothing for a Collect order', () => {
    expect(shipmentCreatedEmail(collect())).toBeNull()
  })

  it('gives courier, tracking link and ETA for a Courier Guy order', () => {
    const e = shipmentCreatedEmail(ctx())!
    expect(e.subject).toContain('on its way')
    expect(e.html).toContain('https://track.example/TCG123')
    expect(e.html).toContain('3–4 business days')
  })
})

describe('delivery created', () => {
  it('says collected for a Collect order and delivered otherwise', () => {
    expect(deliveryCreatedEmail(collect()).subject).toContain('collected')
    expect(deliveryCreatedEmail(ctx()).subject).toContain('delivered')
  })
})
