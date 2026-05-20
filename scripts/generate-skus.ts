/**
 * Generates SKUs for WooCommerce products that have none.
 * Reads:  migration/raw/products-without_sku.json
 * Writes: migration/raw/products.json
 *         migration/raw/sku-report.json
 *
 * Run: npx tsx scripts/generate-skus.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ─── Brand codes ────────────────────────────────────────────────────────────

const BRAND_CODES: Record<string, string> = {
  'brother':         'BRO',
  'canon':           'CAN',
  'hp':              'HP',
  'epson':           'EPS',
  'samsung':         'SAM',
  'lexmark':         'LEX',
  'xerox':           'XER',
  'pantum':          'PAN',
  'ricoh':           'RIC',
  'kyocera':         'KYO',
  'konica minolta':  'KM',
  'konica':          'KM',
  'oki':             'OKI',
  'olivetti':        'OLI',
}

// ─── Colour codes ────────────────────────────────────────────────────────────

const COLOUR_CODES: Record<string, string> = {
  'black':       'K',
  'cyan':        'C',
  'magenta':     'M',
  'yellow':      'Y',
  'tri-color':   'TRI',
  'tri-colour':  'TRI',
  'tricolor':    'TRI',
  'tricolour':   'TRI',
  'color':       'CLR',
  'colour':      'CLR',
  'photo black': 'PBK',
  'grey':        'GR',
  'gray':        'GR',
  'light cyan':  'LC',
  'light magenta': 'LM',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectBrand(name: string): { code: string; remainder: string } {
  const lower = name.toLowerCase()

  // Strip "Generic" prefix — it just means compatible
  const cleaned = lower.replace(/^generic\s+/, '')

  for (const [brand, code] of Object.entries(BRAND_CODES)) {
    if (cleaned.startsWith(brand)) {
      const remainder = name.slice(name.toLowerCase().indexOf(brand) + brand.length).trim()
      return { code, remainder }
    }
  }

  // Fallback: use first word as brand code
  const words = name.replace(/^[Gg]eneric\s+/, '').split(/\s+/)
  return {
    code: words[0].toUpperCase().slice(0, 4),
    remainder: words.slice(1).join(' '),
  }
}

function detectColour(remainder: string): { code: string; model: string } {
  const lower = remainder.toLowerCase()

  // Check multi-word colours first
  for (const [colour, code] of Object.entries(COLOUR_CODES)) {
    if (lower.endsWith(colour)) {
      const model = remainder.slice(0, remainder.length - colour.length).trim()
      return { code, model }
    }
  }

  // Check single-word colour at the end
  const words = remainder.split(/\s+/)
  const lastWord = words[words.length - 1].toLowerCase()
  if (COLOUR_CODES[lastWord]) {
    return {
      code: COLOUR_CODES[lastWord],
      model: words.slice(0, -1).join(' '),
    }
  }

  return { code: '', model: remainder }
}

function cleanModel(model: string): string {
  return model
    .toUpperCase()
    .replace(/\s+/g, '')   // remove spaces
    .replace(/-/g, '')     // remove dashes (optional: keep if you prefer BRO-TN-279)
    .replace(/[^A-Z0-9]/g, '') // strip anything else
}

function generateSku(name: string, id: number): string {
  const { code: brandCode, remainder } = detectBrand(name)
  const { code: colourCode, model } = detectColour(remainder)
  const modelCode = cleanModel(model)

  const parts = [brandCode, modelCode, colourCode].filter(Boolean)
  return parts.join('-')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const root = join(__dirname, '..')
const inputPath = join(root, 'migration', 'raw', 'products-without_sku.json')
const outputPath = join(root, 'migration', 'raw', 'products.json')
const reportPath = join(root, 'migration', 'raw', 'sku-report.json')

const raw = JSON.parse(readFileSync(inputPath, 'utf-8'))
const products = raw.products as Array<Record<string, unknown> & { id: number; name: string; sku: string }>

const skuCount = new Map<string, number>()
const report: { id: number; name: string; generatedSku: string; collision: boolean }[] = []

const enriched = products.map((p) => {
  let sku = p.sku && p.sku.trim() !== '' ? p.sku : generateSku(p.name, p.id)

  // Handle collisions by appending WC ID
  const count = (skuCount.get(sku) ?? 0) + 1
  skuCount.set(sku, count)
  const collision = count > 1
  if (collision) sku = `${sku}-${p.id}`

  report.push({ id: p.id, name: p.name, generatedSku: sku, collision })
  return { ...p, sku }
})

const collisions = report.filter((r) => r.collision)

writeFileSync(outputPath, JSON.stringify({ ...raw, products: enriched }, null, 2), 'utf-8')
writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: products.length,
  generated: report.filter((r) => !r.collision).length,
  collisions: collisions.length,
  collisionList: collisions,
  skus: report,
}, null, 2), 'utf-8')

console.log(`✓ ${products.length} products processed`)
console.log(`✓ ${collisions.length} SKU collisions resolved with WC ID suffix`)
console.log(`✓ Written to migration/raw/products-with-sku.json`)
console.log(`✓ Report written to migration/raw/sku-report.json`)
