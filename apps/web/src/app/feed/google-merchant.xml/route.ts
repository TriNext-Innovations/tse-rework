import { htmlToPlainText } from '@/lib/html-text'
import { TYPE_CATEGORY_NAMES as TYPE_CATS } from '@/lib/taxonomy'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const SITE = 'https://tse-cartridges.co.za'
const FIELDS =
  '+images,+categories.id,+categories.name,+variants.sku,+variants.title,+variants.calculated_price'

type Category = { id: string; name: string }
type Variant = {
  sku: string | null
  title: string
  calculated_price?: { calculated_amount?: number; currency_code?: string }
}
type Product = {
  id: string
  handle: string
  title: string
  description: string | null
  images?: { url: string }[]
  categories?: Category[]
  variants?: Variant[]
}

// The store has no manufacturer GTINs/MPNs on file for these generic/compatible
// cartridges (checked directly against prod — 0/520 variants), so every item
// declares identifier_exists=no. That's Google's own recommended handling for
// generic parts, and avoids the account-suspension risk of a fabricated or
// mismatched GTIN.
async function getRegionId(): Promise<string> {
  const res = await fetch(`${BACKEND}/store/regions?limit=1`, {
    headers: { 'x-publishable-api-key': PUB_KEY },
    next: { revalidate: 3600 },
  })
  const d = await res.json()
  return d.regions?.[0]?.id ?? ''
}

async function fetchAllPublishedProducts(): Promise<Product[]> {
  const PAGE_SIZE = 200
  const regionId = await getRegionId()
  const all: Product[] = []
  let offset = 0
  for (;;) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      fields: FIELDS,
    })
    if (regionId) params.set('region_id', regionId)
    const res = await fetch(`${BACKEND}/store/products?${params}`, {
      headers: { 'x-publishable-api-key': PUB_KEY },
      next: { revalidate: 3600 },
    })
    const { products = [], count = 0 } = await res.json()
    all.push(...products)
    offset += PAGE_SIZE
    if (offset >= count || products.length === 0) break
  }
  return all
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdata(input: string): string {
  return `<![CDATA[${input.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

export async function GET() {
  let products: Product[] = []
  try {
    products = await fetchAllPublishedProducts()
  } catch {
    return new Response('Failed to load products', { status: 502 })
  }

  const items = products.flatMap((p) => {
    const brand = p.categories?.find((c) => !TYPE_CATS.has(c.name))?.name ?? 'TSE'
    const image = p.images?.[0]?.url
    const link = `${SITE}/products/${p.handle}`
    const description = p.description ? htmlToPlainText(p.description).slice(0, 5000) : p.title

    return (p.variants ?? [])
      .filter((v) => v.sku && typeof v.calculated_price?.calculated_amount === 'number')
      .map((v) => {
        const price = v.calculated_price!.calculated_amount as number
        const currency = (v.calculated_price!.currency_code ?? 'zar').toUpperCase()
        const title = v.title && v.title !== 'Default Value' ? `${p.title} — ${v.title}` : p.title

        return `    <item>
      <g:id>${escapeXml(v.sku!)}</g:id>
      <title>${cdata(title)}</title>
      <description>${cdata(description)}</description>
      <link>${escapeXml(link)}</link>
      ${image ? `<g:image_link>${escapeXml(image)}</g:image_link>` : ''}
      <g:availability>in_stock</g:availability>
      <g:price>${price.toFixed(2)} ${currency}</g:price>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`
      })
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>TSE Online — Printer Cartridges</title>
    <link>${SITE}</link>
    <description>South Africa's printer-cartridge specialist since 1987.</description>
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
