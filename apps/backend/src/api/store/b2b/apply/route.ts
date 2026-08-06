import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { B2B_GROUP_NAME, B2B_TIERS, b2bTierLabel } from '@tse/types'
import { sendEmail, emailConfigured, salesEmail, salesCc } from '../../../../lib/email'

type ApplyBody = {
  company_name: string
  contact_name: string
  email: string
  phone: string
  business_type: string
  monthly_volume: string
  message?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { company_name, contact_name, email, phone, business_type, monthly_volume, message } =
    req.body as ApplyBody

  if (!company_name || !contact_name || !email || !phone) {
    return res.status(400).json({ error: 'company_name, contact_name, email and phone are required' })
  }

  if (emailConfigured()) {
    await sendEmail({
      to: salesEmail(),
      cc: salesCc(),
      subject: `🏢 New B2B Application — ${company_name}`,
      html: `
        <h2 style="font-family:sans-serif">New B2B Account Application</h2>
        <table style="font-family:sans-serif;border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Company</strong></td><td style="padding:6px 10px;border:1px solid #eee">${company_name}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Contact</strong></td><td style="padding:6px 10px;border:1px solid #eee">${contact_name}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:6px 10px;border:1px solid #eee">${email}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Phone</strong></td><td style="padding:6px 10px;border:1px solid #eee">${phone}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Business type</strong></td><td style="padding:6px 10px;border:1px solid #eee">${business_type}</td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Monthly volume</strong></td><td style="padding:6px 10px;border:1px solid #eee">${monthly_volume}</td></tr>
          ${message ? `<tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Message</strong></td><td style="padding:6px 10px;border:1px solid #eee">${message}</td></tr>` : ''}
        </table>
        <p style="font-family:sans-serif;color:#666;font-size:13px;margin-top:16px">
          Reply directly to <a href="mailto:${email}">${email}</a> to approve. To grant B2B pricing,
          add the customer to the <strong>${B2B_GROUP_NAME}</strong> group in Medusa admin — the
          per-order threshold discounts (${B2B_TIERS.map(b2bTierLabel).join('; ')}) then apply
          automatically, on every order they place <em>while signed in</em>.
        </p>
      `,
      replyTo: email,
    }).catch(() => null)

    // Acknowledge to applicant
    await sendEmail({
      to: email,
      subject: 'B2B application received — TSE',
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2>Hi ${contact_name},</h2>
          <p>We've received your B2B application for <strong>${company_name}</strong>. Our team will review it and get back to you within 1 business day.</p>
          <p>Questions? Call <strong>011 708 2304</strong> or WhatsApp <strong>079 873 3558</strong>.</p>
          <p style="font-size:13px;color:#9ca3af">TSE — Technical Systems Engineering · Kya Sands, Johannesburg</p>
        </div>
      `,
    }).catch(() => null)
  }

  return res.status(200).json({ success: true })
}
