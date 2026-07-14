import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createOrderFromPending, createOrderFromCart, PendingPayload } from '../../../../lib/payfast-order'
import { sendEmail, salesEmail, salesCc } from '../../../../lib/email'

// #135: money arrived but no order could be created — the team must reconcile
// manually, so this alert replaces the storefront ITN's customer-email fallback.
async function alertCaptureFailure(mPaymentId: string, payfast: any, reason: string) {
  await sendEmail({
    to: salesEmail(),
    cc: salesCc(),
    subject: `⚠️ PayFast payment without order — ${mPaymentId}`,
    html: `
      <h2 style="font-family:sans-serif">Payment captured but order creation failed</h2>
      <table style="font-family:sans-serif;border-collapse:collapse">
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Our ref</strong></td><td style="padding:6px 10px;border:1px solid #eee">${mPaymentId}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>PayFast ref</strong></td><td style="padding:6px 10px;border:1px solid #eee">${payfast?.pf_payment_id ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Amount</strong></td><td style="padding:6px 10px;border:1px solid #eee">R ${payfast?.amount_gross ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Reason</strong></td><td style="padding:6px 10px;border:1px solid #eee">${reason}</td></tr>
      </table>
      <p style="font-family:sans-serif;color:#666;font-size:13px">
        The customer has paid but received no confirmation. Look up the payment in the PayFast
        dashboard, contact the customer, and create the order manually in Medusa admin.
      </p>
    `,
  }).catch((err) => console.error(`[payfast-capture] failed to send failure alert for ${mPaymentId}:`, err?.message))
}

function authorized(req: MedusaRequest): boolean {
  const secret = process.env.PAYFAST_CAPTURE_SECRET
  return Boolean(secret) && req.headers['x-payfast-secret'] === secret
}

/**
 * POST /store/payfast/capture
 * Body: { m_payment_id, payfast }  — called by the validated ITN handler on a
 * COMPLETE payment. Creates the Medusa order from the stored cart. Idempotent:
 * the ITN can fire multiple times, so a second call returns the existing order.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { m_payment_id, payfast } = (req.body ?? {}) as any
  if (!m_payment_id) {
    return res.status(400).json({ error: 'm_payment_id required' })
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const { rows } = await knex.raw(
    `SELECT payload, order_id FROM payfast_pending WHERE m_payment_id = ?`,
    [m_payment_id],
  )
  const row = rows?.[0]
  if (!row) {
    // No stored cart — accept (don't make PayFast retry) but flag it.
    console.warn(`[payfast-capture] no pending cart for ${m_payment_id}`)
    await alertCaptureFailure(m_payment_id, payfast, 'no pending cart stored for this payment reference')
    return res.json({ ok: true, order_id: null, note: 'no pending cart' })
  }

  // Idempotency — order already created for this payment.
  if (row.order_id) {
    return res.json({ ok: true, order_id: row.order_id, already: true })
  }

  const payload = (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as
    | (PendingPayload & { cart_id?: string })

  try {
    // New cart-based checkout stores a cart_id; legacy rows store the raw items
    // payload. Dispatch accordingly.
    const order = payload.cart_id
      ? await createOrderFromCart(req.scope, payload.cart_id, payfast ?? {})
      : await createOrderFromPending(req.scope, { ...payload, payfast: payfast ?? {} } as PendingPayload)
    await knex.raw(`UPDATE payfast_pending SET order_id = ? WHERE m_payment_id = ?`, [order.id, m_payment_id])
    console.log(`[payfast-capture] created order ${order.display_id ?? order.id} for ${m_payment_id}`)
    return res.json({ ok: true, order_id: order.id, display_id: order.display_id })
  } catch (err: any) {
    console.error(`[payfast-capture] failed to create order for ${m_payment_id}:`, err.message)
    await alertCaptureFailure(m_payment_id, payfast, `order creation failed: ${err.message}`)
    return res.status(500).json({ error: 'order creation failed' })
  }
}
