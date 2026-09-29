// Escape text for interpolation into an HTML email body. Anything a shopper
// typed (a name, a company, a message) must go through this: unescaped, it can
// inject markup and links into mail sent from TSE's own address.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
