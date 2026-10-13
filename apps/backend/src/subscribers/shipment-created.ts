import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { sendStatusEmail } from '../lib/send-status-email'
import { shipmentCreatedEmail } from '../emails/order-status-messages'

// Admin "Mark as shipped". Medusa 2.x emits `shipment.created` with the
// fulfilment id as `id`. The previous subscriber listened for
// `order.shipment_created`, which is never emitted, so this email never sent.
export default async function shipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  await sendStatusEmail(container, 'shipment-created', data.id, shipmentCreatedEmail)
}

export const config: SubscriberConfig = {
  event: 'shipment.created',
}
