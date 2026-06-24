import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createOrderFromPending, PendingPayload } from '../../../../lib/payfast-order'

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
    return res.json({ ok: true, order_id: null, note: 'no pending cart' })
  }

  // Idempotency — order already created for this payment.
  if (row.order_id) {
    return res.json({ ok: true, order_id: row.order_id, already: true })
  }

  const payload = (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as PendingPayload
  payload.payfast = payfast ?? {}

  try {
    const order = await createOrderFromPending(req.scope, payload)
    await knex.raw(`UPDATE payfast_pending SET order_id = ? WHERE m_payment_id = ?`, [order.id, m_payment_id])
    console.log(`[payfast-capture] created order ${order.display_id ?? order.id} for ${m_payment_id}`)
    return res.json({ ok: true, order_id: order.id, display_id: order.display_id })
  } catch (err: any) {
    console.error(`[payfast-capture] failed to create order for ${m_payment_id}:`, err.message)
    return res.status(500).json({ error: 'order creation failed' })
  }
}
