import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { sendEmail } from '../../../../lib/email'

// Deduplicate per query — don't spam admin for the same term within 24 hours
const seen = new Map<string, number>()
const TTL_MS = 24 * 60 * 60 * 1000

function isDuplicate(query: string): boolean {
  const key = query.toLowerCase().trim()
  const last = seen.get(key)
  if (last && Date.now() - last < TTL_MS) return true
  seen.set(key, Date.now())
  return false
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { query } = req.body as { query?: string }

  if (!query || query.trim().length < 3) {
    return res.status(400).json({ error: 'query must be at least 3 characters' })
  }

  if (isDuplicate(query)) {
    return res.status(200).json({ ok: true, skipped: true })
  }

  // TODO(claus): consolidate ADMIN_EMAIL into TSE_NOTIFY_EMAIL once prod env is confirmed clean
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.TSE_NOTIFY_EMAIL ?? 'orders@tse-cartridges.co.za'

  try {
    await sendEmail({
      to: adminEmail,
      subject: `🔍 No search results — "${query.trim()}"`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="font-size:18px;margin-bottom:4px">Missing product alert</h2>
          <p style="color:#6b7280;font-size:14px;margin-top:0">A customer searched for something we don't carry.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;color:#374151"><strong>Search term</strong></td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111827">${query.trim()}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;color:#374151"><strong>Time</strong></td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280">${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#6b7280">
            Consider adding this product or synonym to the catalogue.<br/>
            This alert fires once per search term per 24 hours.
          </p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">TSE — Technical Systems Engineering · Kya Sands, Johannesburg</p>
        </div>
      `,
    })
  } catch (err: any) {
    console.error('[no-results] email failed:', err.message)
  }

  return res.status(200).json({ ok: true })
}
