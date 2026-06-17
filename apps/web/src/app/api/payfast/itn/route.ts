import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? ''
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? ''
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const RESEND_FROM = process.env.RESEND_FROM_EMAIL ?? 'orders@tse-cartridges.co.za'
const TSE_NOTIFY_EMAIL = 'sales@tse.co.za'

// PayFast production IP ranges (for validation in production)
const PAYFAST_IPS = new Set([
  '197.97.145.144', '41.74.179.194', '196.33.227.144',
  '196.33.227.145', '196.33.227.146', '196.33.227.147',
])

function verifySignature(data: Record<string, string>): boolean {
  const { signature, ...rest } = data
  const query = Object.entries(rest)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&')
  const toHash = PASSPHRASE ? `${query}&passphrase=${encodeURIComponent(PASSPHRASE).replace(/%20/g, '+')}` : query
  const expected = crypto.createHash('md5').update(toHash).digest('hex')
  return expected === signature
}

async function notifyTeam(data: Record<string, string>) {
  if (!RESEND_API_KEY) return

  const body = {
    from: RESEND_FROM,
    to: [TSE_NOTIFY_EMAIL],
    subject: `💳 Online Payment Received — ${data.item_name ?? 'TSE Order'}`,
    html: `
      <h2 style="font-family:sans-serif">New online payment received</h2>
      <table style="font-family:sans-serif;border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>PayFast ref</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.pf_payment_id ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Our ref</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.m_payment_id ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Customer</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.name_first ?? ''} ${data.name_last ?? ''}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.email_address ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Phone</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.custom_str2 ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Delivery address</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.custom_str1 ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Order</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.item_name ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Amount</strong></td><td style="padding:6px 10px;border:1px solid #eee">R ${data.amount_gross ?? '0'}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #eee"><strong>Status</strong></td><td style="padding:6px 10px;border:1px solid #eee">${data.payment_status ?? '—'}</td></tr>
      </table>
      <p style="font-family:sans-serif;margin-top:16px;color:#666;font-size:13px">
        Process this order in Medusa admin or contact the customer to arrange delivery.
      </p>
    `,
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function notifyCustomer(data: Record<string, string>) {
  if (!RESEND_API_KEY || !data.email_address) return

  const body = {
    from: RESEND_FROM,
    to: [data.email_address],
    subject: `Order confirmed — TSE Online`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111827">Thank you, ${data.name_first ?? 'valued customer'}!</h2>
        <p style="color:#374151">Your payment of <strong>R ${data.amount_gross ?? '0'}</strong> has been received.</p>
        <p style="color:#374151">
          <strong>Order:</strong> ${data.item_name ?? '—'}<br/>
          <strong>Our reference:</strong> ${data.m_payment_id ?? '—'}<br/>
          <strong>PayFast ref:</strong> ${data.pf_payment_id ?? '—'}
        </p>
        <p style="color:#374151">We'll be in touch within 1 business hour to confirm your delivery time.</p>
        <p style="color:#374151">
          Questions? Call <strong>011 708 2304</strong> or WhatsApp <strong>079 873 3558</strong>.
        </p>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          TSE — Technical Systems Engineering · Kya Sands, Johannesburg
        </p>
      </div>
    `,
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  // Validate source IP against PayFast's published ranges
  const rawIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? ''
  const ip = rawIp.split(',')[0]?.trim() ?? ''
  if (process.env.NODE_ENV === 'production' && !PAYFAST_IPS.has(ip)) {
    console.error('[PayFast ITN] Request from unlisted IP:', ip)
    return new NextResponse('FORBIDDEN', { status: 403 })
  }

  const formData = await req.formData()
  const data: Record<string, string> = {}
  formData.forEach((v, k) => { data[k] = v.toString() })

  // Validate merchant ID
  if (data.merchant_id !== MERCHANT_ID) {
    console.error('[PayFast ITN] Invalid merchant_id')
    return new NextResponse('INVALID', { status: 400 })
  }

  // Validate signature
  if (!verifySignature(data)) {
    console.error('[PayFast ITN] Signature mismatch')
    return new NextResponse('INVALID_SIGNATURE', { status: 400 })
  }

  const status = data.payment_status?.toUpperCase()

  if (status === 'COMPLETE') {
    await Promise.allSettled([notifyTeam(data), notifyCustomer(data)])
  } else {
    console.warn('[PayFast ITN] Non-complete status:', status, data.m_payment_id)
  }

  return new NextResponse('OK', { status: 200 })
}
