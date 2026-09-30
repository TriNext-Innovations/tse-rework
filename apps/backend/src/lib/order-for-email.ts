import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { isCollectMethod } from './collection-point'

// Everything a fulfilment-stage email needs, fetched in one graph query from
// the fulfilment side (fulfillment → order is a module link, not a column).
export type FulfillmentEmailContext = {
  fulfillmentId: string
  providerId: string
  trackingNumber: string | null
  trackingUrl: string | null
  order: {
    id: string
    displayId: string | number
    email: string | null
    customerName: string
    serviceName: string
    serviceCode?: string
    address: {
      name: string
      line1: string
      line2?: string
      city: string
      province?: string
      postalCode?: string
    } | null
  }
  isCollect: boolean
  isCourierGuy: boolean
}

export async function loadFulfillmentContext(
  container: MedusaContainer,
  fulfillmentId: string,
): Promise<FulfillmentEmailContext | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'fulfillment',
    filters: { id: fulfillmentId },
    fields: [
      'id', 'provider_id', 'data',
      'labels.tracking_number', 'labels.tracking_url',
      'order.id', 'order.display_id', 'order.email',
      'order.shipping_address.*',
      'order.shipping_methods.name', 'order.shipping_methods.data',
    ],
  })
  const f: any = data?.[0]
  if (!f?.order) return null

  const o = f.order
  const addr = o.shipping_address
  const method = o.shipping_methods?.[0]
  const name = addr ? [addr.first_name, addr.last_name].filter(Boolean).join(' ') : ''
  const label = f.labels?.[0]

  return {
    fulfillmentId: f.id,
    providerId: f.provider_id ?? '',
    trackingNumber: label?.tracking_number || f.data?.tracking_reference || null,
    trackingUrl: label?.tracking_url || null,
    order: {
      id: o.id,
      displayId: o.display_id ?? o.id,
      email: o.email ?? null,
      customerName: name || 'Customer',
      serviceName: method?.name ?? 'Delivery',
      serviceCode: (f.data?.service_level_code ?? method?.data?.service_level_code) as string | undefined,
      address: addr
        ? {
            name,
            line1: addr.address_1 ?? '',
            line2: [addr.company, addr.address_2].filter(Boolean).join(', ') || undefined,
            city: addr.city ?? '',
            province: addr.province ?? undefined,
            postalCode: addr.postal_code ?? undefined,
          }
        : null,
    },
    isCollect: isCollectMethod(method?.name),
    isCourierGuy: (f.provider_id ?? '').startsWith('shiplogic'),
  }
}
