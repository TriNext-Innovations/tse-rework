const API_URL = process.env.ZEPTOMAIL_API_URL ?? 'https://api.zeptomail.com/v1.1/email'
const FROM_NAME = 'TSE Cartridges'

export function emailConfigured(): boolean {
  return Boolean(process.env.ZEPTOMAIL_TOKEN)
}

// #271: single source of truth for the team-notification inbox. SALES_CC lets
// a dev-monitored copy ride along during early go-live without touching code.
export function salesEmail(): string {
  return (process.env.SALES_EMAIL ?? '').trim() || 'sales@tse.co.za'
}

export function salesCc(): string[] {
  return (process.env.SALES_CC ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function authHeader(): string {
  // The ZeptoMail console shows the send-mail token both with and without the
  // "Zoho-enczapikey " scheme prefix — accept either form in the env var.
  const token = (process.env.ZEPTOMAIL_TOKEN ?? '').trim()
  return token.startsWith('Zoho-enczapikey') ? token : `Zoho-enczapikey ${token}`
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  replyTo?: string
  cc?: string[]
}): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'sales@tse-cartridges.co.za'
  const replyTo = options.replyTo ?? process.env.EMAIL_REPLY_TO ?? salesEmail()
  const cc = options.cc?.filter((address) => address !== options.to) ?? []

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { address: from, name: FROM_NAME },
      to: [{ email_address: { address: options.to } }],
      ...(cc.length > 0 ? { cc: cc.map((address) => ({ email_address: { address } })) } : {}),
      reply_to: [{ address: replyTo }],
      subject: options.subject,
      htmlbody: options.html,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`ZeptoMail error ${res.status}: ${detail}`)
  }
}
