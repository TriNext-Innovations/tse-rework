export interface ShippingUpdateData {
  orderNumber: string | number
  customerName: string
  courierName: string
  trackingNumber: string | null
  serviceName: string
  estimatedDelivery: string
  shippingAddress: {
    name: string
    line1: string
    city: string
    province?: string
    postalCode?: string
  }
}

export function shippingUpdateHtml(d: ShippingUpdateData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your order is on its way — TSE</title>
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

          <!-- Cyan accent bar -->
          <tr>
            <td style="background:#41e0f5;height:4px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;">

              <!-- Heading -->
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">
                Your order is on its way 🚚
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
                Hi ${d.customerName}, order <strong style="color:#374151;">#${d.orderNumber}</strong> has been collected by ${d.courierName} and is heading your way.
              </p>

              <!-- Tracking card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#F0FEFF;border:1px solid #41e0f5;border-radius:8px;padding:20px;">
                <tr>
                  <td style="padding:0 20px;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Shipment details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;width:140px;font-size:13px;color:#6B7280;">Courier</td>
                        <td style="padding:5px 0;font-size:14px;color:#374151;font-weight:500;">${d.courierName}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6B7280;">Service</td>
                        <td style="padding:5px 0;font-size:14px;color:#374151;">${d.serviceName}</td>
                      </tr>
                      ${
                        d.trackingNumber
                          ? `<tr>
                        <td style="padding:5px 0;font-size:13px;color:#6B7280;">Tracking #</td>
                        <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:700;">${d.trackingNumber}</td>
                      </tr>`
                          : ''
                      }
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6B7280;">Est. delivery</td>
                        <td style="padding:5px 0;font-size:14px;color:#374151;">${d.estimatedDelivery}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Delivery address -->
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Delivering to</p>
              <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.7;">
                ${d.shippingAddress.name}<br/>
                ${d.shippingAddress.line1}<br/>
                ${d.shippingAddress.city}${d.shippingAddress.province ? ', ' + d.shippingAddress.province : ''}${d.shippingAddress.postalCode ? ', ' + d.shippingAddress.postalCode : ''}
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="https://tse-cartridges.co.za/account/orders"
                       style="display:inline-block;background:#dfe344;color:#111827;font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;">
                      Track your order
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Help -->
              <p style="margin:0;font-size:13px;color:#6B7280;text-align:center;">
                Questions? Email us at <a href="mailto:sales@tse.co.za" style="color:#374151;">sales@tse.co.za</a> or call 011 708 2304.
              </p>

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
