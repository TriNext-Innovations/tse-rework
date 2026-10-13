import type { FulfillmentEmailContext } from '../lib/order-for-email'
import { orderStatusHtml, addressLines, collectionBlock, ordersCta } from './order-status'

// The customer-facing half of the order chain. Each stage maps a Medusa
// admin action to one email; null means "this stage sends nothing for this
// kind of order" (e.g. a Collect order is never "shipped").
//
//   Create fulfilment  → packed / ready for collection
//   Mark as shipped    → on its way           (not for Collect)
//   Mark as delivered  → delivered / collected

export type StatusEmail = { subject: string; html: string }

const COURIER_GUY_ETA: Record<string, string> = {
  ECO: '3–4 business days',
  OVN: 'Next business day',
}

function trackingValue(ctx: FulfillmentEmailContext): string | null {
  if (!ctx.trackingNumber) return null
  return ctx.trackingUrl
    ? `<a href="${ctx.trackingUrl}" style="color:#111827;">${ctx.trackingNumber}</a>`
    : ctx.trackingNumber
}

function orderRef(ctx: FulfillmentEmailContext): string {
  return `#${ctx.order.displayId}`
}

function deliveryBlock(ctx: FulfillmentEmailContext) {
  return ctx.order.address ? { heading: 'Delivering to', lines: addressLines(ctx.order.address) } : undefined
}

export function fulfillmentCreatedEmail(ctx: FulfillmentEmailContext): StatusEmail {
  const { order } = ctx
  if (ctx.isCollect) {
    return {
      subject: `Your TSE order ${orderRef(ctx)} is ready for collection`,
      html: orderStatusHtml({
        heading: 'Ready for collection',
        intro: `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> is packed and waiting for you at our warehouse. Please bring your order number.`,
        block: collectionBlock(),
        cta: ordersCta,
      }),
    }
  }

  const tracking = trackingValue(ctx)
  const details = [
    { label: 'Order', value: orderRef(ctx) },
    { label: 'Delivery', value: order.serviceName },
    ...(tracking ? [{ label: 'Tracking #', value: tracking }] : []),
  ]
  const intro = ctx.isCourierGuy
    ? `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> is packed and booked with The Courier Guy. Tracking starts updating once they collect it from us.`
    : `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> is packed. We'll email you again when it's on its way.`

  return {
    subject: `Your TSE order ${orderRef(ctx)} is packed`,
    html: orderStatusHtml({ heading: 'Your order is packed', intro, details, block: deliveryBlock(ctx), cta: ordersCta }),
  }
}

export function shipmentCreatedEmail(ctx: FulfillmentEmailContext): StatusEmail | null {
  if (ctx.isCollect) return null
  const { order } = ctx
  const tracking = trackingValue(ctx)
  const eta = ctx.isCourierGuy && order.serviceCode ? COURIER_GUY_ETA[order.serviceCode] : undefined
  const carrier = ctx.isCourierGuy ? 'The Courier Guy' : null

  const details = [
    ...(carrier ? [{ label: 'Courier', value: carrier }] : []),
    { label: 'Service', value: order.serviceName },
    ...(tracking ? [{ label: 'Tracking #', value: tracking }] : []),
    ...(eta ? [{ label: 'Est. delivery', value: eta }] : []),
  ]

  return {
    subject: `Your TSE order ${orderRef(ctx)} is on its way`,
    html: orderStatusHtml({
      heading: 'Your order is on its way',
      intro: `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> has left our warehouse${carrier ? ` with ${carrier}` : ''} and is heading your way.`,
      accent: '#41e0f5',
      details,
      block: deliveryBlock(ctx),
      cta: ctx.trackingUrl ? { label: 'Track your parcel', url: ctx.trackingUrl } : ordersCta,
    }),
  }
}

export function deliveryCreatedEmail(ctx: FulfillmentEmailContext): StatusEmail {
  const { order } = ctx
  if (ctx.isCollect) {
    return {
      subject: `Your TSE order ${orderRef(ctx)} has been collected`,
      html: orderStatusHtml({
        heading: 'Order collected',
        intro: `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> has been collected. Thanks for buying from TSE.`,
        accent: '#0F7A4A',
        cta: ordersCta,
      }),
    }
  }
  return {
    subject: `Your TSE order ${orderRef(ctx)} has been delivered`,
    html: orderStatusHtml({
      heading: 'Order delivered',
      intro: `Hi ${order.customerName}, order <strong style="color:#374151;">${orderRef(ctx)}</strong> has been delivered. Thanks for buying from TSE. If anything is wrong with it, reply to this email.`,
      accent: '#0F7A4A',
      cta: ordersCta,
    }),
  }
}
