import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? ''
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? ''

// PayFast production IP ranges (for validation in production)
const PAYFAST_IPS = new Set([
  '197.97.145.144', '41.74.179.194', '196.33.227.144',
  '196.33.227.145', '196.33.227.146', '196.33.227.147',
  // Observed live ITN source since 2026-07 (AWS af-south-1, PR #275) — may drift.
  '13.245.74.88',
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

export async function POST(req: NextRequest) {
  // Source IP is ADVISORY only — the signature + merchant_id checks below are the
  // real authentication. A hard IP gate here silently drops legitimate ITNs once
  // the host is behind a proxy (e.g. Cloudflare rewrites the source to an edge
  // IP) or when PayFast's own ranges drift. Log a mismatch, don't reject on it.
  const sandbox = process.env.PAYFAST_SANDBOX === 'true'
  // Behind Cloudflare the first x-forwarded-for entry is client-suppliable (CF
  // appends rather than replaces), so prefer CF-Connecting-IP — set by the edge
  // itself — before falling back to XFF for non-proxied setups (#262).
  const rawIp =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    ''
  const ip = rawIp.split(',')[0]?.trim() ?? ''
  if (process.env.NODE_ENV === 'production' && !sandbox && ip && !PAYFAST_IPS.has(ip)) {
    console.warn('[PayFast ITN] non-allowlisted IP (advisory; verifying by signature):', ip)
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
    // Turn the stored cart into a real Medusa order (idempotent on m_payment_id).
    // All email is backend-owned (#135): order.placed sends the customer
    // confirmation + team alert, and the capture endpoint alerts the team when
    // it cannot create an order.
    const orderCreated = await captureOrder(data)
    if (!orderCreated) {
      console.error('[PayFast ITN] payment COMPLETE but no order created:', data.m_payment_id)
    }
  } else {
    console.warn('[PayFast ITN] Non-complete status:', status, data.m_payment_id)
  }

  return new NextResponse('OK', { status: 200 })
}

const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL ?? 'http://medusa:9000'
const CAPTURE_SECRET = process.env.PAYFAST_CAPTURE_SECRET ?? ''
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

async function captureOrder(data: Record<string, string>): Promise<boolean> {
  if (!CAPTURE_SECRET || !data.m_payment_id) return false
  try {
    const res = await fetch(`${MEDUSA_URL}/store/payfast/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-payfast-secret': CAPTURE_SECRET,
        'x-publishable-api-key': PUB_KEY,
      },
      body: JSON.stringify({
        m_payment_id: data.m_payment_id,
        payfast: {
          pf_payment_id: data.pf_payment_id,
          m_payment_id: data.m_payment_id,
          amount_gross: data.amount_gross,
        },
      }),
    })
    if (!res.ok) return false
    const json = await res.json().catch(() => ({}))
    return Boolean(json?.order_id)
  } catch (err) {
    console.error('[PayFast ITN] order capture failed:', err)
    return false
  }
}
