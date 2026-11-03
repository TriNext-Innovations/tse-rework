import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { sendStatusEmail } from '../lib/send-status-email'
import { fulfillmentCreatedEmail } from '../emails/order-status-messages'

// Admin "Create fulfillment": packed (courier/Pudo) or ready for collection.
// For Courier Guy orders this is also when the waybill is booked, so the
// tracking number is already on the fulfilment.
export default async function orderFulfillmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; fulfillment_id: string; no_notification?: boolean }>) {
  if (data.no_notification) return
  await sendStatusEmail(container, 'fulfillment-created', data.fulfillment_id, fulfillmentCreatedEmail)
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
}
