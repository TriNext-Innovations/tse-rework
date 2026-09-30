import { describe, it, expect } from 'vitest'
import { orderConfirmationHtml, isCollectMethod, type OrderConfirmationData } from '../../emails/order-confirmation'

const base: OrderConfirmationData = {
  orderNumber: 1001,
  orderDate: '30 September 2026',
  customerName: 'Test Customer',
  email: 'test@example.com',
  items: [],
  subtotal: 'R100,00',
  shippingCost: 'R0,00',
  vatContent: 'R13,04',
  total: 'R100,00',
  shippingAddress: { name: 'Test Customer', line1: '1 Home Street', city: 'Durban' },
  serviceName: 'Collect from Kya Sands Warehouse',
}

describe('isCollectMethod', () => {
  it('matches the collect option but not courier or Pudo', () => {
    expect(isCollectMethod('Collect from Kya Sands Warehouse')).toBe(true)
    expect(isCollectMethod('The Courier Guy — Economy (3–4 business days)')).toBe(false)
    expect(isCollectMethod('Pudo Locker Delivery')).toBe(false)
    expect(isCollectMethod(undefined)).toBe(false)
  })
})

describe('orderConfirmationHtml', () => {
  it('gives the collection point, not the home address, for a collect order', () => {
    const html = orderConfirmationHtml({ ...base, isCollect: true })
    expect(html).toContain('Collect from')
    expect(html).toContain('Kya Sands, Johannesburg, 2163')
    expect(html).toContain('will not be couriered')
    expect(html).not.toContain('1 Home Street')
  })

  it('gives the delivery address and no collection wording for a courier order', () => {
    const html = orderConfirmationHtml({ ...base, serviceName: 'The Courier Guy — Economy', isCollect: false })
    expect(html).toContain('Delivery address')
    expect(html).toContain('1 Home Street')
    expect(html).not.toContain('ready for you to collect')
  })
})
