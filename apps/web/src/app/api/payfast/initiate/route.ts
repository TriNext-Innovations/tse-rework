import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? ''
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? ''
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? ''
const SANDBOX = process.env.PAYFAST_SANDBOX === 'true'

export const PAYFAST_URL = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process'

type CartItem = { title: string; sku: string; price: number | null; qty: number }

type Body = {
  items: CartItem[]
  contact: { name: string; email: string; phone: string }
  address: { line1: string; suburb: string; city: string; province: string; postalCode: string }
}

function buildSignature(params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&')
  const toHash = PASSPHRASE ? `${query}&passphrase=${encodeURIComponent(PASSPHRASE).replace(/%20/g, '+')}` : query
  return crypto.createHash('md5').update(toHash).digest('hex')
}

export async function POST(req: NextRequest) {
  if (!MERCHANT_ID || !MERCHANT_KEY) {
    return NextResponse.json({ error: 'PayFast not configured' }, { status: 503 })
  }

  const body: Body = await req.json()
  const { items, contact, address } = body

  const subtotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)
  if (subtotal <= 0) {
    return NextResponse.json({ error: 'Order total must be greater than zero' }, { status: 400 })
  }

  const amount = subtotal.toFixed(2)
  const m_payment_id = crypto.randomUUID()

  const origin = req.headers.get('origin') ?? 'https://tse-cartridges.co.za'
  const nameParts = contact.name.trim().split(' ')
  const name_first = nameParts[0] ?? contact.name
  const name_last = nameParts.slice(1).join(' ') || ''

  const itemSummary = items
    .map((i) => `${i.qty}x ${i.title}`)
    .join(', ')
    .slice(0, 100)

  // Custom fields: store address and items summary for ITN
  const addressLine = `${address.line1}, ${address.suburb}, ${address.city}, ${address.province} ${address.postalCode}`.slice(0, 255)

  // Build params in the exact order PayFast expects for signature
  const params: Record<string, string> = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: `${origin}/checkout/confirmed`,
    cancel_url: `${origin}/checkout`,
    notify_url: `${origin}/api/payfast/itn`,
    name_first,
    ...(name_last ? { name_last } : {}),
    email_address: contact.email,
    cell_number: contact.phone.replace(/\s/g, ''),
    m_payment_id,
    amount,
    item_name: `TSE Order — ${itemSummary}`,
    custom_str1: addressLine,
    custom_str2: contact.phone,
    email_confirmation: '1',
    confirmation_address: contact.email,
  }

  const signature = buildSignature(params)

  // Persist the cart server-side so the (validated) ITN can turn it into a real
  // Medusa order on payment confirmation. Best-effort: never block checkout if
  // the backend is briefly unavailable — the team still gets the ITN email.
  const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL ?? 'http://medusa:9000'
  const CAPTURE_SECRET = process.env.PAYFAST_CAPTURE_SECRET ?? ''
  const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
  if (CAPTURE_SECRET) {
    try {
      await fetch(`${MEDUSA_URL}/store/payfast/pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payfast-secret': CAPTURE_SECRET,
          'x-publishable-api-key': PUB_KEY,
        },
        body: JSON.stringify({
          m_payment_id,
          payload: { items, contact, address, amount },
        }),
      })
    } catch (err) {
      console.error('[payfast initiate] failed to persist pending order:', err)
    }
  }

  return NextResponse.json({
    url: PAYFAST_URL,
    params: { ...params, signature },
    m_payment_id,
  })
}
