import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { B2B_GROUP_NAME, B2B_TIERS, b2bTierLabel } from '@tse/types'
import { sendEmail, emailConfigured, salesEmail, salesCc } from '../../../../lib/email'
import { escapeHtml } from '../../../../lib/html'

// A B2B application comes from a signed-in customer (see api/middlewares.ts).
// Approval means adding that customer account to the B2B group, so an
// application without an account could never be approved. The account's own
// email is the one on the application; the body cannot choose where mail goes.

export type ApplyBody = {
  company_name?: string
  contact_name?: string
  phone?: string
  business_type?: string
  monthly_volume?: string
  message?: string
}

export type Applicant = {
  id: string
  email: string
}

export type Application = {
  company_name: string
  contact_name: string
  phone: string
  business_type: string
  monthly_volume: string
  message: string
}

/** Trim the submitted fields; null when a required one is missing. */
export function readApplication(body: ApplyBody): Application | null {
  // Single-line fields collapse whitespace, so a company name can't smuggle a
  // line break into the email subject.
  const line = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const application = {
    company_name: line(body.company_name, 200),
    contact_name: line(body.contact_name, 200),
    phone: line(body.phone, 40),
    business_type: line(body.business_type, 100),
    monthly_volume: line(body.monthly_volume, 100),
    message: String(body.message ?? '').trim().slice(0, 2000),
  }
  if (!application.company_name || !application.contact_name || !application.phone) return null
  return application
}

/** The sales notification and the applicant's acknowledgement, every shopper-typed value escaped. */
export function applicationEmails(applicant: Applicant, application: Application) {
  const e = {
    company: escapeHtml(application.company_name),
    contact: escapeHtml(application.contact_name),
    email: escapeHtml(applicant.email),
    phone: escapeHtml(application.phone),
    type: escapeHtml(application.business_type),
    volume: escapeHtml(application.monthly_volume),
    message: escapeHtml(application.message),
    customerId: escapeHtml(applicant.id),
  }
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 10px;border:1px solid #eee"><strong>${label}</strong></td><td style="padding:6px 10px;border:1px solid #eee">${value}</td></tr>`

  const sales = {
    subject: `🏢 New B2B Application — ${application.company_name}`,
    html: `
        <h2 style="font-family:sans-serif">New B2B Account Application</h2>
        <table style="font-family:sans-serif;border-collapse:collapse;width:100%">
          ${row('Company', e.company)}
          ${row('Contact', e.contact)}
          ${row('Account email', e.email)}
          ${row('Customer ID', e.customerId)}
          ${row('Phone', e.phone)}
          ${row('Business type', e.type)}
          ${row('Monthly volume', e.volume)}
          ${application.message ? row('Message', e.message) : ''}
        </table>
        <p style="font-family:sans-serif;color:#666;font-size:13px;margin-top:16px">
          The applicant has a customer account (${e.email}). To grant B2B pricing, add that
          customer to the <strong>${escapeHtml(B2B_GROUP_NAME)}</strong> group in Medusa admin — the
          per-order threshold discounts (${escapeHtml(B2B_TIERS.map(b2bTierLabel).join('; '))}) then apply
          automatically, on every order they place <em>while signed in</em>.
        </p>
      `,
  }

  const acknowledgement = {
    subject: 'B2B application received — TSE',
    html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2>Hi ${e.contact},</h2>
          <p>We've received your B2B application for <strong>${e.company}</strong>. Our team will review it and get back to you within 1 business day.</p>
          <p>Once it's approved, sign in with this email address and the business discount is applied at checkout.</p>
          <p>Questions? Call <strong>011 708 2304</strong> or WhatsApp <strong>079 873 3558</strong>.</p>
          <p style="font-size:13px;color:#9ca3af">TSE — Technical Systems Engineering · Kya Sands, Johannesburg</p>
        </div>
      `,
  }

  return { sales, acknowledgement }
}

type CustomerRow = { id: string; email: string; groups?: Array<{ name?: string | null } | null> | null }

export async function POST(req: AuthenticatedMedusaRequest<ApplyBody>, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: 'Sign in to apply for business pricing' })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'customer',
    fields: ['id', 'email', 'groups.name'],
    filters: { id: customerId },
  })
  const customer = (data as CustomerRow[])[0]
  if (!customer?.email) {
    return res.status(401).json({ error: 'Sign in to apply for business pricing' })
  }
  if (customer.groups?.some((g) => g?.name === B2B_GROUP_NAME)) {
    return res.status(409).json({ error: 'This account already has business pricing.' })
  }

  const application = readApplication(req.body ?? {})
  if (!application) {
    return res.status(400).json({ error: 'company_name, contact_name and phone are required' })
  }

  if (emailConfigured()) {
    const { sales, acknowledgement } = applicationEmails({ id: customer.id, email: customer.email }, application)
    await sendEmail({ to: salesEmail(), cc: salesCc(), subject: sales.subject, html: sales.html, replyTo: customer.email }).catch(
      () => null,
    )
    await sendEmail({ to: customer.email, subject: acknowledgement.subject, html: acknowledgement.html }).catch(() => null)
  }

  return res.status(200).json({ success: true })
}
