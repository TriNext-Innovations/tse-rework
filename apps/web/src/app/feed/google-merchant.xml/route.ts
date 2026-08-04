import { htmlToPlainText } from '@/lib/html-text'
import { TYPE_CATEGORY_NAMES as TYPE_CATS } from '@/lib/taxonomy'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const SITE = 'https://tse-cartridges.co.za'

// "Office & School Supplies > Printer Consumables > Toner & Inkjet Cartridges".
// The whole catalogue is printer consumables, so one category covers it —
// drum units included, as Google's taxonomy has no separate entry for them.
const GOOGLE_PRODUCT_CATEGORY = 5109

// Mirrors the live shipping model (`apps/backend/src/scripts/setup-shipping.ts`):
// flat R150 Economy, and an automatic 100%-off-shipping promotion once the
// goods total reaches R2,000. Feed shipping is per item ordered on its own, so
// anything already at or above the threshold ships free by itself.
const ECONOMY_SHIPPING_RAND = 150
const FREE_SHIPPING_THRESHOLD_RAND = 2000

// Medusa titles the sole variant of a single-variant product "Default Title";
// our own seed script uses "Default Value". Neither is a real variant name and
// neither belongs in a Shopping listing.
const PLACEHOLDER_VARIANT_TITLES = new Set(['default title', 'default value'])

const COLOUR_PATTERN = /\b(black|cyan|magenta|yellow|colour|color)\b/i
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

    const sellable = (p.variants ?? []).filter(
      (v) => v.sku && typeof v.calculated_price?.calculated_amount === 'number',
    )

    // Variants of one product must share an item_group_id, or Google reads a
    // four-colour cartridge set as four unrelated products competing with each
    // other. A grouped item also has to carry a distinguishing attribute, so
    // the variant name goes out as colour where it names one and size
    // otherwise (that's the yield variants — "High yield" and friends).
    const isVariantGroup = sellable.length > 1

    return sellable.map((v) => {
      const price = v.calculated_price!.calculated_amount as number
      const currency = (v.calculated_price!.currency_code ?? 'zar').toUpperCase()
      const variantName =
        v.title && !PLACEHOLDER_VARIANT_TITLES.has(v.title.trim().toLowerCase())
          ? v.title.trim()
          : null
      const title = variantName ? `${p.title} — ${variantName}` : p.title
      const shipping = price >= FREE_SHIPPING_THRESHOLD_RAND ? 0 : ECONOMY_SHIPPING_RAND

      const variantAttribute =
        isVariantGroup && variantName
          ? COLOUR_PATTERN.test(variantName)
            ? `      <g:color>${escapeXml(variantName)}</g:color>\n`
            : `      <g:size>${escapeXml(variantName)}</g:size>\n`
          : ''

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
      <g:google_product_category>${GOOGLE_PRODUCT_CATEGORY}</g:google_product_category>
${isVariantGroup ? `      <g:item_group_id>${escapeXml(p.handle)}</g:item_group_id>\n` : ''}${variantAttribute}      <g:shipping>
        <g:country>ZA</g:country>
        <g:service>Economy</g:service>
        <g:price>${shipping.toFixed(2)} ${currency}</g:price>
      </g:shipping>
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
