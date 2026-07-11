import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { sendEmail, emailConfigured } from '../../../lib/email'

type DataRequestBody = {
  type: 'access' | 'correction' | 'deletion' | 'objection'
  name: string
  email: string
  phone?: string
  message?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { type, name, email, phone, message } = req.body as DataRequestBody

  if (!type || !name || !email) {
    return res.status(400).json({ error: 'type, name and email are required' })
  }

  const allowedTypes = ['access', 'correction', 'deletion', 'objection']
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid request type' })
  }

  if (emailConfigured()) {
    const labels: Record<string, string> = {
      access: 'Access to personal information',
      correction: 'Correction of personal information',
      deletion: 'Deletion of personal information',
      objection: 'Objection to processing',
    }

    await sendEmail({
      to: 'sales@tse.co.za',
      subject: `POPIA Data Request — ${labels[type]}`,
      html: `
        <h2 style="font-family:sans-serif">POPIA Data Request Received</h2>
        <p style="font-family:sans-serif"><strong>Type:</strong> ${labels[type]}</p>
        <p style="font-family:sans-serif"><strong>Name:</strong> ${name}</p>
        <p style="font-family:sans-serif"><strong>Email:</strong> ${email}</p>
        ${phone ? `<p style="font-family:sans-serif"><strong>Phone:</strong> ${phone}</p>` : ''}
        ${message ? `<p style="font-family:sans-serif"><strong>Message:</strong> ${message}</p>` : ''}
        <p style="font-family:sans-serif;color:#666;font-size:13px;margin-top:16px">
          Under POPIA you must respond to this request within 30 days. Contact the requester at ${email}.
        </p>
      `,
      replyTo: email,
    }).catch(() => null)
  }

  return res.status(200).json({ success: true, message: 'Your request has been received. We will respond within 30 days.' })
}
