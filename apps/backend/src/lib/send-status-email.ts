import type { MedusaContainer } from '@medusajs/framework/types'
import { sendEmail } from './email'
import { loadFulfillmentContext, type FulfillmentEmailContext } from './order-for-email'
import type { StatusEmail } from '../emails/order-status-messages'

// Shared body of the fulfilment-stage subscribers: resolve the order behind a
// fulfilment, build the stage's email, send it. Failures are logged, never
// thrown — an email problem must not fail the admin action that triggered it.
export async function sendStatusEmail(
  container: MedusaContainer,
  tag: string,
  fulfillmentId: string | undefined,
  build: (ctx: FulfillmentEmailContext) => StatusEmail | null,
): Promise<void> {
  if (!fulfillmentId) {
    console.warn(`[${tag}] event carried no fulfillment id — skipping`)
    return
  }

  let ctx: FulfillmentEmailContext | null
  try {
    ctx = await loadFulfillmentContext(container, fulfillmentId)
  } catch (err: any) {
    console.error(`[${tag}] failed to load fulfillment ${fulfillmentId}:`, err.message)
    return
  }
  if (!ctx) {
    console.warn(`[${tag}] no order for fulfillment ${fulfillmentId} — skipping`)
    return
  }
  if (!ctx.order.email) {
    console.warn(`[${tag}] order ${ctx.order.id} has no email — skipping`)
    return
  }

  const email = build(ctx)
  if (!email) return

  try {
    await sendEmail({ to: ctx.order.email, subject: email.subject, html: email.html })
    console.log(`[${tag}] sent to ${ctx.order.email} for order ${ctx.order.id}`)
  } catch (err: any) {
    console.error(`[${tag}] failed to send for order ${ctx.order.id}:`, err.message)
  }
}
