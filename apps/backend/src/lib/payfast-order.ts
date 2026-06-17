import { MedusaContainer } from '@medusajs/framework/types'
import { createOrderWorkflow } from '@medusajs/medusa/core-flows'

// This deployment stores money as integer cents (a R450 product has price
// amount 45000), and the storefront/emails divide by 100. Order line items
// must follow the same convention, so rand prices are scaled by 100.
// `||` (not `??`): compose passes an empty string when the override is unset,
// which must fall back to the dev default rather than an empty id.
const REGION_ID = process.env.MEDUSA_ZAR_REGION_ID || 'reg_01KS7D85TBD4VWPEPNNDRGN0XX'
const SALES_CHANNEL_ID = process.env.MEDUSA_SALES_CHANNEL_ID || 'sc_01KS30SJJ51D1PVG133T1WDVB3'

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
      unit_price: Math.round((i.price ?? 0) * 100), // rand → cents
      ...(variant_id ? { variant_id } : {}),
      ...(product_id ? { product_id } : {}),
      ...(i.sku ? { metadata: { sku: i.sku } } : {}),
    }
  })

  const pf = pending.payfast ?? {}
  const { result } = await createOrderWorkflow(container).run({
    input: {
      region_id: REGION_ID,
      sales_channel_id: SALES_CHANNEL_ID,
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
