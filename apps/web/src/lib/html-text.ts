// Legacy WooCommerce product descriptions are stored as raw HTML (<h2>, <p>,
// <a href="https://www.tse.co.za/shop/">…). The storefront renders plain text,
// so convert them to clean paragraphs: headings are dropped (the PDP already
// shows the product title), tags are stripped, and entities decoded.

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#8217;': '’',
  '&#8216;': '‘',
  '&#8211;': '–',
  '&#8212;': '—',
  '&nbsp;': ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&[#a-z0-9]+;/gi, (e) => ENTITIES[e] ?? e)
}

export function htmlToParagraphs(html: string): string[] {
  const text = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '\n')
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function htmlToPlainText(html: string): string {
  return htmlToParagraphs(html).join(' ')
}
