import { type SubscriberArgs, type SubscriberConfig } from '@medusajs/framework'
import { sendEmail } from '../lib/email'
import { passwordResetHtml } from '../emails/password-reset'

export default async function passwordResetHandler({
  event: { data },
}: SubscriberArgs<{ entity_id: string; actor_type: string; token: string }>) {
  // The same event fires for admin-user resets (actor_type 'user'); those go
  // through the dashboard's own flow, not the storefront reset page.
  if (data.actor_type !== 'customer') {
    return
  }

  const storefront = (process.env.STOREFRONT_URL ?? 'https://tse-cartridges.co.za').replace(/\/$/, '')
  const resetUrl = `${storefront}/account/reset-password?token=${encodeURIComponent(data.token)}`

  try {
    await sendEmail({
      to: data.entity_id,
      subject: 'Reset your TSE password',
      html: passwordResetHtml({ resetUrl }),
    })
    console.log(`[password-reset] reset link sent to ${data.entity_id}`)
  } catch (err: any) {
    console.error(`[password-reset] failed to send email to ${data.entity_id}:`, err.message)
  }
}

export const config: SubscriberConfig = {
  event: 'auth.password_reset',
}
