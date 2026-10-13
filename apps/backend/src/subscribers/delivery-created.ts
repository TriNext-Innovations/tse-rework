import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { sendStatusEmail } from '../lib/send-status-email'
import { deliveryCreatedEmail } from '../emails/order-status-messages'

// Admin "Mark as delivered": delivered, or collected for a Collect order.
// The event carries no no_notification flag.
export default async function deliveryCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendStatusEmail(container, 'delivery-created', data.id, deliveryCreatedEmail)
}

export const config: SubscriberConfig = {
  event: 'delivery.created',
}
