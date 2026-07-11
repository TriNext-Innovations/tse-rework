import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * GET /admin/payment-surveys — cancellation-survey responses (#224), newest
 * first. Admin-authenticated. `?format=csv` downloads a spreadsheet-friendly
 * export for the client.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  let rows: any[] = []
  try {
    const result = await knex.raw(
      `SELECT id, m_payment_id, reasons, message, created_at
       FROM payment_cancel_survey ORDER BY created_at DESC LIMIT 500`,
    )
    rows = result.rows ?? []
  } catch (err: any) {
    // Table is created lazily on the first survey response.
    if (err?.code === '42P01') return req.query.format === 'csv'
      ? res.type('text/csv').send('id,created_at,reasons,message,payment_ref\n')
      : res.json({ surveys: [], count: 0 })
    throw err
  }

  if (req.query.format === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      'id,created_at,reasons,message,payment_ref',
      ...rows.map((r) =>
        [r.id, r.created_at?.toISOString?.() ?? r.created_at, (r.reasons ?? []).join('; '), r.message ?? '', r.m_payment_id ?? '']
          .map(esc)
          .join(','),
      ),
    ].join('\n')
    res.setHeader('Content-Disposition', 'attachment; filename="payment-cancel-surveys.csv"')
    return res.type('text/csv').send(csv)
  }

  return res.json({ surveys: rows, count: rows.length })
}
