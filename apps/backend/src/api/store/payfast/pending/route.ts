import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

// Server-to-server only (called by the storefront's PayFast initiate route).
// Guarded by a shared secret so the public publishable key alone can't write.
function authorized(req: MedusaRequest): boolean {
  const secret = process.env.PAYFAST_CAPTURE_SECRET
  return Boolean(secret) && req.headers['x-payfast-secret'] === secret
}

/**
 * POST /store/payfast/pending
 * Body: { m_payment_id, payload }  — persist the cart so the ITN can turn it
 * into a real order once payment is confirmed.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { m_payment_id, payload } = (req.body ?? {}) as any
  if (!m_payment_id || !payload) {
    return res.status(400).json({ error: 'm_payment_id and payload required' })
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await knex.raw(
    `INSERT INTO payfast_pending (m_payment_id, payload)
     VALUES (?, ?)
     ON CONFLICT (m_payment_id) DO UPDATE SET payload = EXCLUDED.payload`,
    [m_payment_id, JSON.stringify(payload)],
  )

  return res.json({ ok: true })
}
