#!/usr/bin/env node
/**
 * Extracts printer brands and models from short_description free text.
 * Outputs:
 *   migration/raw/printer-brands.json
 *   migration/raw/printer-models.json
 *   migration/raw/compat-map-draft.json  (sku → [models], for #2.4)
 */

const fs   = require('fs')
const path = require('path')

const RAW = path.join(__dirname, 'raw')
const data = JSON.parse(fs.readFileSync(path.join(RAW, 'products-transformed.json'), 'utf8'))

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * Pull the "Compatible Models:" or "Compatible Printers:" line(s) from a
 * short_description string. Returns the raw model string or null.
 */
function extractCompatLine(html) {
  const text = stripHtml(html)
  const match = text.match(/Compatible\s+(?:Models?|Printers?)\s*:\s*([^\n]+)/i)
  return match ? match[1].trim() : null
}

/**
 * Known printer brands — used to prefix-detect the brand from a model string.
 * Order matters: longer / more specific first.
 */
const KNOWN_BRANDS = [
  'HP',
  'Canon',
  'Epson',
  'Brother',
  'Samsung',
  'Lexmark',
  'Xerox',
  'Kyocera',
  'Ricoh',
  'Pantum',
  'OKI',
  'Konica Minolta',
  'Sharp',
  'Toshiba',
  'Fuji Xerox',
  'Dell',
]

/**
 * Detect which brand a model string belongs to.
 * Checks if the string starts with a known brand name (case-insensitive).
 */
function detectBrand(modelStr) {
  const s = modelStr.trim()
  for (const brand of KNOWN_BRANDS) {
    if (s.toLowerCase().startsWith(brand.toLowerCase())) return brand
  }
  return null
}

/**
 * Derive printer brand from a product's WooCommerce category name.
 * Category names follow the pattern "Generic <Brand> <Type> Cartridges".
 */
function brandFromCategory(categories = []) {
  for (const cat of categories) {
    const name = cat.name || ''
    for (const brand of KNOWN_BRANDS) {
      if (name.toLowerCase().includes(brand.toLowerCase())) return brand
    }
  }
  return 'Unknown'
}

/**
 * Split a raw compat string into individual model tokens.
 *
 * Delimiters seen in the data:
 *   /  ,  ;  newline  |  " and "
 *
 * After splitting we:
 *   1. Trim whitespace
 *   2. Drop empty tokens
 *   3. Normalise multiple spaces → single space
 */
function splitModels(raw) {
  return raw
    .split(/[\/,;\|\n]+|\band\b/i)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// ── Process every product (variable + simple) ─────────────────────────────

const allProducts = [
  ...data.variable.map(p => ({ ...p, skus: p.variants.map(v => v.sku) })),
  ...data.simple.map(p => ({ ...p, skus: p.sku ? [p.sku] : [] })),
]

const brandSet   = new Set()
const modelMap   = {}   // normalised model → { brand, rawVariants: Set }
const compatMap  = []   // { skus, models, rawLine }

let withCompat    = 0
let withoutCompat = 0

for (const product of allProducts) {
  const rawLine = extractCompatLine(product.short_description)

  if (!rawLine) {
    withoutCompat++
    continue
  }

  withCompat++
  const tokens = splitModels(rawLine)
  const resolvedModels = []

  // Prefer brand from category; fall back to prefix detection on the model string
  const productBrand = brandFromCategory(product.categories)

  for (const token of tokens) {
    const brand = detectBrand(token) || productBrand
    brandSet.add(brand)

    const key = token.toLowerCase()
    if (!modelMap[key]) {
      modelMap[key] = { canonical: token, brand, count: 0 }
    }
    modelMap[key].count++
    resolvedModels.push(token)
  }

  if (resolvedModels.length > 0) {
    compatMap.push({
      skus: product.skus,
      name: product.name,
      printerBrand: productBrand,
      models: resolvedModels,
      rawLine,
    })
  }
}

// ── Build output structures ───────────────────────────────────────────────

// Brands: sorted, with count of products each appears in
const brandCounts = {}
for (const entry of compatMap) {
  const b = entry.printerBrand
  brandCounts[b] = (brandCounts[b] || 0) + 1
}

const brandsOutput = Object.entries(brandCounts)
  .map(([name, productCount]) => ({ name, productCount }))
  .sort((a, b) => b.productCount - a.productCount)

// Models: sorted by count desc, grouped by brand
const modelsRaw = Object.values(modelMap)
  .sort((a, b) => b.count - a.count)

const modelsByBrand = {}
for (const m of modelsRaw) {
  if (!modelsByBrand[m.brand]) modelsByBrand[m.brand] = []
  modelsByBrand[m.brand].push({ model: m.canonical, occurrences: m.count })
}

const modelsOutput = {
  totalUnique: modelsRaw.length,
  byBrand: modelsByBrand,
  flat: modelsRaw.map(m => ({ model: m.canonical, brand: m.brand, occurrences: m.count })),
}

// ── Write outputs ─────────────────────────────────────────────────────────

const brandsFile = path.join(RAW, 'printer-brands.json')
const modelsFile = path.join(RAW, 'printer-models.json')
const compatFile = path.join(RAW, 'compat-map-draft.json')

fs.writeFileSync(brandsFile, JSON.stringify({
  generated: new Date().toISOString(),
  totalBrands: brandsOutput.length,
  brands: brandsOutput,
}, null, 2))

fs.writeFileSync(modelsFile, JSON.stringify({
  generated: new Date().toISOString(),
  ...modelsOutput,
}, null, 2))

fs.writeFileSync(compatFile, JSON.stringify({
  generated: new Date().toISOString(),
  note: 'Draft only — send to TSE for validation before importing. See issue #2.4.',
  stats: {
    productsWithCompat: withCompat,
    productsWithoutCompat: withoutCompat,
    totalProducts: allProducts.length,
    coveragePct: ((withCompat / allProducts.length) * 100).toFixed(1) + '%',
  },
  entries: compatMap,
}, null, 2))

console.log('✓ printer-brands.json  —', brandsOutput.length, 'brands')
console.log('✓ printer-models.json  —', modelsRaw.length, 'unique models')
console.log('✓ compat-map-draft.json —', compatMap.length, 'products mapped')
console.log()
console.log('Coverage:', withCompat, '/', allProducts.length,
  `(${((withCompat / allProducts.length) * 100).toFixed(1)}%)`)
console.log('No compat data:', withoutCompat, 'products')
