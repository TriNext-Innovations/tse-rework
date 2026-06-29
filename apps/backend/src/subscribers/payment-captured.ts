import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { completeCartWorkflow } from '@medusajs/medusa/core-flows'

/**
 * Complete the cart → order once PayFast confirms payment.
 *
 * In the canonical flow the storefront redirects to PayFast and the customer's
 * return is unreliable (they may close the tab), so the ITN is the source of
 * truth: it authorizes/captures the payment session via the provider's
 * `getWebhookActionAndData`, which fires this event. We resolve the cart behind
 * the payment collection and complete it.
 *
 * ⚠️ DRAFT — the exact event name and the payment → cart resolution must be
 * verified against a running Medusa + PayFast sandbox. `order-placed` (customer
 * + team email) fires from the resulting order, so no email logic lives here.
 */
export default async function paymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // payment → payment_collection → cart
    const { data: payments } = await query.graph({
      entity: 'payment',
      filters: { id: data.id },
      fields: ['id', 'payment_collection_id'],
    })
    const collectionId = (payments?.[0] as any)?.payment_collection_id
    if (!collectionId) {
      console.warn(`[payment-captured] no payment collection for payment ${data.id}`)
      return
    }

    const { data: carts } = await query.graph({
      entity: 'cart',
      filters: { payment_collection_id: collectionId } as any,
      fields: ['id', 'completed_at'],
    })
    const cart = carts?.[0] as any
    if (!cart) {
      console.warn(`[payment-captured] no cart for payment collection ${collectionId}`)
      return
    }
    if (cart.completed_at) return // already an order (idempotent)

    const { result } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
    console.log(`[payment-captured] completed cart ${cart.id} → order ${(result as any)?.id}`)
  } catch (err: any) {
    console.error(`[payment-captured] failed to complete cart for payment ${data.id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  // TODO(claus): confirm the precise event — 'payment.captured' vs
  // 'payment.authorized' — in the running payment module.
  event: 'payment.captured',
}
