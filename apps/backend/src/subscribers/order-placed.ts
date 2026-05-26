import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { sendEmail } from '../lib/email'
import { orderConfirmationHtml } from '../emails/order-confirmation'

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderService = container.resolve(Modules.ORDER) as any

  let order: any
  try {
    order = await orderService.retrieveOrder(data.id, {
      relations: ['items', 'shipping_address', 'shipping_methods'],
    })
  } catch (err: any) {
    console.error(`[order-placed] failed to retrieve order ${data.id}:`, err.message)
    return
  }

  const email = order.email
  if (!email) {
    console.warn(`[order-placed] order ${data.id} has no email — skipping`)
    return
  }

  const currency = order.currency_code ?? 'ZAR'
  const addr = order.shipping_address
  const shippingMethod = order.shipping_methods?.[0]

  const items = (order.items ?? []).map((item: any) => ({
    title: item.title ?? item.variant?.product?.title ?? 'Product',
    quantity: item.quantity,
    unitPrice: formatPrice(item.unit_price, currency),
    lineTotal: formatPrice(item.unit_price * item.quantity, currency),
  }))

  const html = orderConfirmationHtml({
    orderNumber: order.display_id ?? order.id,
    orderDate: formatDate(order.created_at),
    customerName: addr
      ? [addr.first_name, addr.last_name].filter(Boolean).join(' ')
      : 'Customer',
    email,
    items,
    subtotal: formatPrice(order.subtotal ?? 0, currency),
    shippingCost: formatPrice(order.shipping_total ?? 0, currency),
    total: formatPrice(order.total ?? 0, currency),
    shippingAddress: addr
      ? {
          name: [addr.first_name, addr.last_name].filter(Boolean).join(' '),
          line1: addr.address_1 ?? '',
          city: addr.city ?? '',
          province: addr.province ?? undefined,
          postalCode: addr.postal_code ?? undefined,
        }
      : { name: '', line1: '', city: '' },
    serviceName: shippingMethod?.name ?? 'Standard Courier',
  })

  try {
    await sendEmail({
      to: email,
      subject: `Order confirmed — #${order.display_id ?? order.id}`,
      html,
    })
    console.log(`[order-placed] confirmation sent to ${email} for order ${data.id}`)
  } catch (err: any) {
    console.error(`[order-placed] failed to send email for order ${data.id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
