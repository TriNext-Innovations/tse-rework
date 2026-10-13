import { COLLECTION_POINT, STORE_URL } from '../lib/collection-point'

// One layout for every fulfilment-stage email (packed, ready for collection,
// on its way, delivered, collected), so the chain reads as one conversation.
// Values are interpolated as-is: callers pass text they built, never raw
// customer input beyond names/addresses already on the order.
export interface OrderStatusData {
  /** <title> and the heading line. */
  heading: string
  /** One or two sentences under the heading. May contain <strong>. */
  intro: string
  /** Accent bar colour: lime for progress, cyan for shipping, green for done. */
  accent?: string
  details?: Array<{ label: string; value: string }>
  block?: { heading: string; lines: string[] }
  cta?: { label: string; url: string }
}

export type AddressLines = {
  name: string
  line1: string
  line2?: string
  city: string
  province?: string
  postalCode?: string
}

export function addressLines(a: AddressLines): string[] {
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.province, a.postalCode].filter(Boolean).join(', '),
  ].filter((l): l is string => !!l)
}

export function collectionBlock(): { heading: string; lines: string[] } {
  return { heading: 'Collect from', lines: [...COLLECTION_POINT.lines, COLLECTION_POINT.hours] }
}

export const ordersCta = { label: 'View your order', url: `${STORE_URL}/account/orders` }

export function orderStatusHtml(d: OrderStatusData): string {
  const details = d.details?.length
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${d.details
                      .map(
                        (r) => `<tr>
                      <td style="padding:5px 0;width:140px;font-size:13px;color:#6B7280;">${r.label}</td>
                      <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:500;">${r.value}</td>
                    </tr>`,
                      )
                      .join('')}
                  </table>
                </td></tr>
              </table>`
    : ''

  const block = d.block
    ? `
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">${d.block.heading}</p>
              <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.7;">${d.block.lines.join('<br/>')}</p>`
    : ''

  const cta = d.cta
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td align="center">
                  <a href="${d.cta.url}" style="display:inline-block;background:#dfe344;color:#111827;font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;">${d.cta.label}</a>
                </td></tr>
              </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${d.heading} — TSE</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td style="background:#111827;padding:28px 32px;border-radius:8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#dfe344;letter-spacing:-0.5px;">TSE</span>
                    <span style="font-size:14px;color:#9CA3AF;margin-left:8px;">Technical Systems Engineering</span>
                  </td>
                  <td align="right">
                    <span style="font-size:12px;color:#6B7280;">EST. 1987</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${d.accent ?? '#dfe344'};height:4px;"></td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${d.heading}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.6;">${d.intro}</p>
              ${details}
              ${block}
              ${cta}
              <p style="margin:0;font-size:13px;color:#6B7280;text-align:center;">
                Questions? Email us at <a href="mailto:sales@tse.co.za" style="color:#374151;">sales@tse.co.za</a> or call 011 708 2304.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                TSE — Technical Systems Engineering · Kya Sands, Johannesburg · Est. 1987<br/>
                Generic cartridges &amp; toner at unbeatable prices.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
