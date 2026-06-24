import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

type QuoteItem = { sku: string; description: string; qty: number }

type QuoteBody = {
  company_name: string
  contact_name: string
  email: string
  phone: string
  delivery_area: string
  items: QuoteItem[]
  notes?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { company_name, contact_name, email, phone, delivery_area, items, notes } =
    req.body as QuoteBody

  if (!company_name || !contact_name || !email || !items?.length) {
    return res.status(400).json({ error: 'company_name, contact_name, email and items are required' })
  }

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL ?? 'orders@tse-cartridges.co.za'

  if (resendKey) {
    const itemRows = items
      .map(
        (i) =>
          `<tr><td style="padding:6px 10px;border:1px solid #eee">${i.sku || '—'}</td><td style="padding:6px 10px;border:1px solid #eee">${i.description}</td><td style="padding:6px 10px;border:1px solid #eee;text-align:right">${i.qty}</td></tr>`,
      )
      .join('')

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: ['sales@tse.co.za'],
        subject: `📋 Quote Request — ${company_name}`,
        html: `
          <h2 style="font-family:sans-serif">Quote Request</h2>
          <table style="font-family:sans-serif;border-collapse:collapse;width:100%;margin-bottom:16px">
            <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Company</strong></td><td style="padding:6px 10px;border:1px solid #eee">${company_name}</td></tr>
            <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Contact</strong></td><td style="padding:6px 10px;border:1px solid #eee">${contact_name}</td></tr>
            <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:6px 10px;border:1px solid #eee">${email}</td></tr>
            <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Phone</strong></td><td style="padding:6px 10px;border:1px solid #eee">${phone}</td></tr>
            <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Delivery area</strong></td><td style="padding:6px 10px;border:1px solid #eee">${delivery_area}</td></tr>
          </table>
          <h3 style="font-family:sans-serif">Items</h3>
          <table style="font-family:sans-serif;border-collapse:collapse;width:100%">
            <thead><tr>
              <th style="padding:6px 10px;border:1px solid #eee;text-align:left;background:#f9f9f9">SKU</th>
              <th style="padding:6px 10px;border:1px solid #eee;text-align:left;background:#f9f9f9">Description</th>
              <th style="padding:6px 10px;border:1px solid #eee;text-align:right;background:#f9f9f9">Qty</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          ${notes ? `<p style="font-family:sans-serif;margin-top:12px"><strong>Notes:</strong> ${notes}</p>` : ''}
          <p style="font-family:sans-serif;color:#666;font-size:13px;margin-top:16px">
            Reply to <a href="mailto:${email}">${email}</a> with pricing.
          </p>
        `,
        reply_to: email,
      }),
    }).catch(() => null)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Quote request received — TSE',
        html: `
          <div style="font-family:sans-serif;max-width:480px">
            <h2>Hi ${contact_name},</h2>
            <p>We've received your quote request for <strong>${company_name}</strong>. Our team will respond with pricing within 2 business hours.</p>
            <p>Urgent? Call <strong>011 708 2304</strong> or WhatsApp <strong>079 873 3558</strong>.</p>
            <p style="font-size:13px;color:#9ca3af">TSE — Technical Systems Engineering · Kya Sands, Johannesburg</p>
          </div>
        `,
      }),
    }).catch(() => null)
  }

  return res.status(200).json({ success: true })
}
