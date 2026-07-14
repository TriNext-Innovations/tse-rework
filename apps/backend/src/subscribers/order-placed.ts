import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { sendEmail, salesEmail, salesCc } from '../lib/email'
import { orderConfirmationHtml } from '../emails/order-confirmation'

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount)
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
  // Fetch via the Query graph, NOT the order module's retrieveOrder: the
  // monetary totals (total/subtotal/shipping_total/tax_total) are computed
  // fields that only hydrate through the graph. retrieveOrder leaves them
  // undefined, which rendered every order email — customer invoice + team
  // alert — with a R0,00 total.
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  let order: any
  try {
    const { data: orders } = await query.graph({
      entity: 'order',
      filters: { id: data.id },
      fields: [
        'id', 'display_id', 'email', 'currency_code', 'created_at',
        'total', 'subtotal', 'shipping_total', 'tax_total',
        'items.*',
        'shipping_address.*',
        'shipping_methods.*',
      ],
    })
    order = orders?.[0]
    if (!order) throw new Error('order not found')
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

  // #135: the team notification is owned by the backend (was duplicated in the
  // storefront PayFast ITN). Recipient driven by SALES_EMAIL since #271.
  const teamEmail = salesEmail()
  const customerName = addr ? [addr.first_name, addr.last_name].filter(Boolean).join(' ') : 'Customer'
  const teamHtml = `
    <h2 style="font-family:sans-serif">New order #${order.display_id ?? order.id}</h2>
    <table style="font-family:sans-serif;border-collapse:collapse">
      <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Customer</strong></td><td style="padding:6px 10px;border:1px solid #eee">${customerName}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:6px 10px;border:1px solid #eee">${email}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Total</strong></td><td style="padding:6px 10px;border:1px solid #eee">${formatPrice(order.total ?? 0, currency)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Delivery</strong></td><td style="padding:6px 10px;border:1px solid #eee">${shippingMethod?.name ?? 'Standard Courier'}</td></tr>
    </table>
    <p style="font-family:sans-serif;color:#666;font-size:13px">Process this order in Medusa admin.</p>
  `
  try {
    await sendEmail({ to: teamEmail, cc: salesCc(), subject: `🛒 New order #${order.display_id ?? order.id}`, html: teamHtml, replyTo: email })
    console.log(`[order-placed] team notification sent for order ${data.id}`)
  } catch (err: any) {
    console.error(`[order-placed] failed to send team email for order ${data.id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
