import { Resend } from 'resend'

let _client: Resend | null = null

function getClient(): Resend {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY)
  return _client
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'sales@tse.co.za'

  const { error } = await getClient().emails.send({ from, ...options })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
