export interface TeamOrderNotificationData {
  orderId: string
  orderNumber: string | number
  orderDate: string
  paymentStatus: string
  customerName: string
  company?: string
  email: string
  phone: string
  items: Array<{
    sku: string
    title: string
    quantity: number
    unitPrice: string
    lineTotal: string
  }>
  subtotal: string
  shippingCost: string
  vatContent: string
  total: string
  serviceName: string
  addressLines: string[]
  adminUrl: string
}

const cell = 'padding:8px 12px;border:1px solid #E5E7EB;font-size:14px;color:#374151;'
const head = 'padding:8px 12px;border:1px solid #E5E7EB;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:#F9FAFB;'

/**
 * Internal new-order notification for the sales team. Deliberately denser than
 * the customer email: everything needed to pick, invoice and dispatch without
 * opening Admin — payment status, SKUs with unit prices, VAT content, the full
 * delivery address, and a direct link to the order in Admin.
 */
export function teamOrderNotificationHtml(d: TeamOrderNotificationData): string {
  const itemRows = d.items
    .map(
      (item) => `
      <tr>
        <td style="${cell}font-family:monospace;">${item.sku}</td>
        <td style="${cell}">${item.title}</td>
        <td style="${cell}text-align:center;">${item.quantity}</td>
        <td style="${cell}text-align:right;">${item.unitPrice}</td>
        <td style="${cell}text-align:right;">${item.lineTotal}</td>
      </tr>`,
    )
    .join('')

  const totalRow = (label: string, value: string, bold = false) => `
      <tr>
        <td colspan="4" style="${cell}text-align:right;${bold ? 'font-weight:700;' : ''}">${label}</td>
        <td style="${cell}text-align:right;${bold ? 'font-weight:700;' : ''}">${value}</td>
      </tr>`

  const paid = d.paymentStatus.toLowerCase()
  const paidBadge =
    paid === 'captured' || paid === 'authorized' || paid === 'completed'
      ? `<span style="background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;padding:3px 10px;border-radius:9999px;">PAID — PayFast</span>`
      : `<span style="background:#FEF3C7;color:#92400E;font-size:12px;font-weight:700;padding:3px 10px;border-radius:9999px;">PAYMENT: ${d.paymentStatus.toUpperCase()}</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>New order #${d.orderNumber}</title></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:24px 0;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:20px 28px;border-radius:8px 8px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <span style="font-size:18px;font-weight:800;color:#dfe344;">TSE</span>
                <span style="font-size:14px;color:#9CA3AF;margin-left:8px;">New order</span>
              </td>
              <td align="right"><span style="font-size:16px;font-weight:700;color:#ffffff;">#${d.orderNumber}</span></td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="background:#dfe344;height:4px;"></td></tr>

        <tr><td style="background:#ffffff;padding:28px;border-radius:0 0 8px 8px;">

          <!-- Status line -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr>
            <td>${paidBadge}</td>
            <td align="right" style="font-size:13px;color:#6B7280;">${d.orderDate}</td>
          </tr></table>

          <!-- Customer + delivery -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
            <td style="width:50%;vertical-align:top;padding-right:14px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
                ${d.customerName}${d.company ? `<br/><strong>${d.company}</strong>` : ''}<br/>
                <a href="mailto:${d.email}" style="color:#374151;">${d.email}</a><br/>
                ${d.phone || '—'}
              </p>
            </td>
            <td style="width:50%;vertical-align:top;padding-left:14px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Delivery — ${d.serviceName}</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
                ${d.addressLines.join('<br/>')}
              </p>
            </td>
          </tr></table>

          <!-- Items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <th style="${head}text-align:left;">SKU</th>
              <th style="${head}text-align:left;">Product</th>
              <th style="${head}">Qty</th>
              <th style="${head}text-align:right;">Unit</th>
              <th style="${head}text-align:right;">Amount</th>
            </tr>
            ${itemRows}
            ${totalRow('Subtotal', d.subtotal)}
            ${totalRow('Shipping', d.shippingCost)}
            ${totalRow('VAT included (15%)', d.vatContent)}
            ${totalRow('Total (incl. VAT)', d.total, true)}
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${d.adminUrl}"
               style="display:inline-block;background:#111827;color:#dfe344;font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;">
              Open order in Admin
            </a>
          </td></tr></table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
