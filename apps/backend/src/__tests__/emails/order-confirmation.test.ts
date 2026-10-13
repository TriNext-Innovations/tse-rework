import { describe, it, expect } from 'vitest'
import { orderConfirmationHtml, type OrderConfirmationData } from '../../emails/order-confirmation'

const base: OrderConfirmationData = {
  orderNumber: 1042,
  orderDate: '30 September 2026',
  customerName: 'Thandi M',
  email: 'c@example.com',
  items: [],
  subtotal: 'R100,00',
  shippingCost: 'R0,00',
  vatContent: 'R13,04',
  total: 'R100,00',
  shippingAddress: { name: 'Thandi M', line1: '1 Home Street', city: 'Durban' },
  serviceName: 'The Courier Guy — Economy',
}

describe('orderConfirmationHtml', () => {
  it('no longer tells courier customers their order will be ready for collection', () => {
    const html = orderConfirmationHtml(base)
    expect(html).not.toContain('collection')
    expect(html).toContain('1 Home Street')
  })

  it('shows the collection point instead of the home address for Collect', () => {
    const html = orderConfirmationHtml({ ...base, serviceName: 'Collect from Kya Sands Warehouse', isCollect: true })
    expect(html).toContain('Collect from')
    expect(html).toContain('Kya Sands, Johannesburg, 2163')
    expect(html).not.toContain('1 Home Street')
  })
})
