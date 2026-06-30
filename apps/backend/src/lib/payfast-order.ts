import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createOrderWorkflow } from '@medusajs/medusa/core-flows'

// This deployment stores money in rands (a R450 product has price amount 450).
// Order line items follow the same convention — prices are used as-is.

// Resolve the ZAR region + default sales channel once per process. Prefer an
// explicit env override; otherwise look them up from Medusa. We deliberately
// never fall back to a hardcoded id — a wrong region/sales channel silently
// misroutes orders (stale prod ids leaking into another environment), so we
// fail loudly instead.
let cachedIds: { region_id: string; sales_channel_id: string } | null = null

async function resolveRegionAndChannel(
  container: MedusaContainer,
): Promise<{ region_id: string; sales_channel_id: string }> {
  if (cachedIds) return cachedIds

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // `||` (not `??`): compose passes an empty string when the override is unset.
  let region_id = process.env.MEDUSA_ZAR_REGION_ID || ''
  if (!region_id) {
    const { data } = await query.graph({ entity: 'region', fields: ['id', 'currency_code'] })
    region_id = data?.find((r: any) => r.currency_code?.toLowerCase() === 'zar')?.id ?? ''
  }
  if (!region_id) {
    throw new Error(
      'No ZAR region found — set MEDUSA_ZAR_REGION_ID or create a region with currency ZAR',
    )
  }

  let sales_channel_id = process.env.MEDUSA_SALES_CHANNEL_ID || ''
  if (!sales_channel_id) {
    const { data } = await query.graph({ entity: 'store', fields: ['default_sales_channel_id'] })
    sales_channel_id = data?.[0]?.default_sales_channel_id ?? ''
  }
  if (!sales_channel_id) {
    throw new Error(
      'No sales channel found — set MEDUSA_SALES_CHANNEL_ID or set a default sales channel on the store',
    )
  }

  cachedIds = { region_id, sales_channel_id }
  return cachedIds
}

export type PendingItem = { id?: string; title: string; sku?: string; price: number | null; qty: number }
export type PendingPayload = {
  items: PendingItem[]
  contact: { name: string; email: string; phone: string }
  address: { line1: string; suburb: string; city: string; province: string; postalCode: string }
  amount: string
  payfast?: Record<string, string>
}

// Cart ids look like "prod_xxx-variant_yyy" — recover both halves for the line.
function splitCartId(id?: string): { product_id?: string; variant_id?: string } {
  if (!id) return {}
  const idx = id.indexOf('-variant_')
  if (idx === -1) return id.startsWith('variant_') ? { variant_id: id } : {}
  return { product_id: id.slice(0, idx), variant_id: id.slice(idx + 1) }
}

export async function createOrderFromPending(
  container: MedusaContainer,
  pending: PendingPayload,
): Promise<{ id: string; display_id?: number }> {
  const nameParts = pending.contact.name.trim().split(/\s+/)
  const first_name = nameParts[0] ?? pending.contact.name
  const last_name = nameParts.slice(1).join(' ') || '-'

  const items = pending.items.map((i) => {
    const { product_id, variant_id } = splitCartId(i.id)
    return {
      title: i.title,
      quantity: i.qty,
      unit_price: i.price ?? 0, // already in rands
      ...(variant_id ? { variant_id } : {}),
      ...(product_id ? { product_id } : {}),
      ...(i.sku ? { metadata: { sku: i.sku } } : {}),
    }
  })

  const pf = pending.payfast ?? {}
  const { region_id, sales_channel_id } = await resolveRegionAndChannel(container)
  const { result } = await createOrderWorkflow(container).run({
    input: {
      region_id,
      sales_channel_id,
      currency_code: 'zar',
      email: pending.contact.email,
      status: 'pending',
      items,
      shipping_address: {
        first_name,
        last_name,
        phone: pending.contact.phone,
        address_1: pending.address.line1,
        address_2: pending.address.suburb,
        city: pending.address.city,
        province: pending.address.province,
        postal_code: pending.address.postalCode,
        country_code: 'za',
      },
      metadata: {
        source: 'storefront-payfast',
        payment_status: 'paid',
        pf_payment_id: pf.pf_payment_id ?? null,
        m_payment_id: pf.m_payment_id ?? null,
        amount_gross: pf.amount_gross ?? pending.amount,
      },
    } as any,
  })

  const order: any = result
  return { id: order.id, display_id: order.display_id }
}

export type CartPendingPayload = {
  cart_id: string
  contact: { name: string; email: string; phone: string }
  amount?: string
  payfast?: Record<string, string>
}

// Build the order from a real Medusa cart (items + chosen shipping method +
// address). Used by the cart-based checkout; the chosen shipping option already
// carries the live courier price and the shiplogic `data` needed to book a
// waybill from the order later.
export async function createOrderFromCart(
  container: MedusaContainer,
  cartId: string,
  payfast: Record<string, string>,
): Promise<{ id: string; display_id?: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'cart',
    filters: { id: cartId },
    fields: [
      'id',
      'email',
      'currency_code',
      'items.title',
      'items.quantity',
      'items.unit_price',
      'items.variant_id',
      'items.product_id',
      'items.metadata',
      'shipping_methods.name',
      'shipping_methods.amount',
      'shipping_methods.shipping_option_id',
      'shipping_methods.data',
      'shipping_address.*',
    ],
  })

  const cart: any = data?.[0]
  if (!cart) throw new Error(`cart ${cartId} not found`)

  const items = (cart.items ?? []).map((i: any) => ({
    title: i.title,
    quantity: i.quantity,
    unit_price: i.unit_price, // already rands
    ...(i.variant_id ? { variant_id: i.variant_id } : {}),
    ...(i.product_id ? { product_id: i.product_id } : {}),
    ...(i.metadata ? { metadata: i.metadata } : {}),
  }))

  const shipping_methods = (cart.shipping_methods ?? []).map((m: any) => ({
    name: m.name,
    amount: m.amount, // already rands
    ...(m.shipping_option_id ? { shipping_option_id: m.shipping_option_id } : {}),
    ...(m.data ? { data: m.data } : {}),
  }))

  const sa = cart.shipping_address ?? {}
  const { region_id, sales_channel_id } = await resolveRegionAndChannel(container)
  const { result } = await createOrderWorkflow(container).run({
    input: {
      region_id,
      sales_channel_id,
      currency_code: cart.currency_code ?? 'zar',
      email: cart.email,
      status: 'pending',
      items,
      shipping_methods,
      shipping_address: {
        first_name: sa.first_name,
        last_name: sa.last_name,
        phone: sa.phone,
        address_1: sa.address_1,
        address_2: sa.address_2,
        city: sa.city,
        province: sa.province,
        postal_code: sa.postal_code,
        country_code: sa.country_code ?? 'za',
      },
      metadata: {
        source: 'storefront-payfast',
        payment_status: 'paid',
        cart_id: cartId,
        pf_payment_id: payfast.pf_payment_id ?? null,
        m_payment_id: payfast.m_payment_id ?? null,
        amount_gross: payfast.amount_gross ?? null,
      },
    } as any,
  })

  const order: any = result
  return { id: order.id, display_id: order.display_id }
}
