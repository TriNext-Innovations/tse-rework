export interface OrderConfirmationData {
  orderNumber: string | number
  orderDate: string
  customerName: string
  email: string
  items: Array<{
    title: string
    quantity: number
    unitPrice: string
    lineTotal: string
  }>
  subtotal: string
  shippingCost: string
  vatContent: string
  total: string
  shippingAddress: {
    name: string
    line1: string
    // Complex/building + suburb, when the customer provided them.
    line2?: string
    city: string
    province?: string
    postalCode?: string
  }
  serviceName: string
}

function row(label: string, value: string, bold = false): string {
  return `
    <tr>
      <td style="padding:4px 0;color:#6B7280;font-size:14px;">${label}</td>
      <td style="padding:4px 0;text-align:right;color:#374151;font-size:14px;${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`
}

export function orderConfirmationHtml(d: OrderConfirmationData): string {
  const itemRows = d.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
          <span style="font-size:14px;color:#374151;font-weight:500;">${item.title}</span>
          <span style="font-size:13px;color:#6B7280;margin-left:6px;">× ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-size:14px;color:#374151;">${item.lineTotal}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order Confirmation — TSE</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
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

          <!-- Lime accent bar -->
          <tr>
            <td style="background:#dfe344;height:4px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">
                Order confirmed ✓
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6B7280;">
                Hi ${d.customerName}, thanks for your order. We'll have it packed and ready for collection shortly.
              </p>

              <!-- Order meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#F9FAE8;border-radius:6px;padding:16px;">
                <tr>
                  <td style="padding:4px 16px;">
                    <span style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Order</span><br/>
                    <span style="font-size:15px;font-weight:700;color:#111827;">#${d.orderNumber}</span>
                  </td>
                  <td style="padding:4px 16px;">
                    <span style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Date</span><br/>
                    <span style="font-size:15px;color:#374151;">${d.orderDate}</span>
                  </td>
                  <td style="padding:4px 16px;">
                    <span style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Shipping</span><br/>
                    <span style="font-size:15px;color:#374151;">${d.serviceName}</span>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Items</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <th style="text-align:left;padding:8px 0;border-bottom:2px solid #111827;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;">Product</th>
                  <th style="text-align:right;padding:8px 0;border-bottom:2px solid #111827;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;">Amount</th>
                </tr>
                ${itemRows}
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${row('Subtotal', d.subtotal)}
                ${row('Shipping', d.shippingCost)}
                ${row('VAT included (15%)', d.vatContent)}
                <tr><td colspan="2" style="padding:4px 0;border-top:2px solid #111827;"></td></tr>
                ${row('Total (incl. VAT)', d.total, true)}
              </table>

              <!-- Shipping address -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:50%;vertical-align:top;padding-right:16px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Delivery address</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      ${d.shippingAddress.name}<br/>
                      ${d.shippingAddress.line1}<br/>
                      ${d.shippingAddress.line2 ? d.shippingAddress.line2 + '<br/>' : ''}${d.shippingAddress.city}${d.shippingAddress.province ? ', ' + d.shippingAddress.province : ''}${d.shippingAddress.postalCode ? ', ' + d.shippingAddress.postalCode : ''}
                    </p>
                  </td>
                  <td style="width:50%;vertical-align:top;padding-left:16px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Need help?</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      <a href="mailto:sales@tse.co.za" style="color:#374151;">sales@tse.co.za</a><br/>
                      011 708 2304
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://tse-cartridges.co.za/account/orders"
                       style="display:inline-block;background:#dfe344;color:#111827;font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;">
                      View your order
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
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
