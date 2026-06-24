import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { sendEmail } from '../lib/email'
import { shippingUpdateHtml } from '../emails/shipping-update'

const SERVICE_LABELS: Record<string, { name: string; eta: string }> = {
  ECO: { name: 'The Courier Guy', eta: '3–4 business days' },
  OVN: { name: 'The Courier Guy', eta: 'Next business day' },
}

export default async function orderShipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; order_id: string }>) {
  const orderService = container.resolve(Modules.ORDER) as any
  const fulfillmentService = container.resolve(Modules.FULFILLMENT) as any

  let order: any
  try {
    order = await orderService.retrieveOrder(data.order_id, {
      relations: ['shipping_address', 'shipping_methods'],
    })
  } catch (err: any) {
    console.error(`[shipment-created] failed to retrieve order ${data.order_id}:`, err.message)
    return
  }

  const email = order.email
  if (!email) {
    console.warn(`[shipment-created] order ${data.order_id} has no email — skipping`)
    return
  }

  // Get fulfillment data for tracking number
  let fulfillment: any = null
  try {
    fulfillment = await fulfillmentService.retrieveFulfillment(data.id, {})
  } catch {
    // Non-fatal — email sends without tracking number
  }

  const trackingNumber =
    fulfillment?.tracking_numbers?.[0] ??
    fulfillment?.data?.tracking_reference ??
    fulfillment?.data?.waybill_number ??
    null

  const addr = order.shipping_address
  const shippingMethod = order.shipping_methods?.[0]
  const serviceCode = (fulfillment?.data?.service_level_code ??
    shippingMethod?.data?.service_level_code) as string | undefined
  const service = (serviceCode ? SERVICE_LABELS[serviceCode] : undefined) ?? {
    name: 'The Courier Guy',
    eta: '3–5 business days',
  }

  const html = shippingUpdateHtml({
    orderNumber: order.display_id ?? order.id,
    customerName: addr
      ? [addr.first_name, addr.last_name].filter(Boolean).join(' ')
      : 'Customer',
    courierName: service.name,
    trackingNumber,
    serviceName: shippingMethod?.name ?? service.name,
    estimatedDelivery: service.eta,
    shippingAddress: addr
      ? {
          name: [addr.first_name, addr.last_name].filter(Boolean).join(' '),
          line1: addr.address_1 ?? '',
          city: addr.city ?? '',
          province: addr.province ?? undefined,
          postalCode: addr.postal_code ?? undefined,
        }
      : { name: '', line1: '', city: '' },
  })

  try {
    await sendEmail({
      to: email,
      subject: `Your TSE order #${order.display_id ?? order.id} is on its way`,
      html,
    })
    console.log(`[shipment-created] shipping update sent to ${email} for order ${data.order_id}`)
  } catch (err: any) {
    console.error(`[shipment-created] failed to send email for order ${data.order_id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: 'order.shipment_created',
}
