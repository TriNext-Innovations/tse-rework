export interface PasswordResetData {
  resetUrl: string
}

export function passwordResetHtml(d: PasswordResetData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset your password — TSE</title>
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

              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">
                Reset your password
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
                We received a request to reset the password for your TSE account. Click the button below to choose a new one. This link expires in <strong style="color:#374151;">15 minutes</strong>.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${d.resetUrl}"
                       style="display:inline-block;background:#dfe344;color:#111827;font-weight:700;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;">
                      Choose a new password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:13px;color:#6B7280;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${d.resetUrl}" style="color:#374151;word-break:break-all;">${d.resetUrl}</a>
              </p>

              <p style="margin:0;font-size:13px;color:#6B7280;">
                Didn't request this? You can safely ignore this email — your password won't change until you set a new one.
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
