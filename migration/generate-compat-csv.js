#!/usr/bin/env node
/**
 * Generates two CSVs for client review:
 *   compat-map-draft.csv  — products WITH compat data (for client to validate)
 *   compat-gaps.csv       — products WITHOUT compat data (for client to fill in)
 */

const fs   = require('fs')
const path = require('path')

const RAW     = path.join(__dirname, 'raw')
const draft   = JSON.parse(fs.readFileSync(path.join(RAW, 'compat-map-draft.json'), 'utf8'))
  .entries
const data    = JSON.parse(fs.readFileSync(path.join(RAW, 'products-transformed.json'), 'utf8'))

const mappedSkus = new Set(draft.flatMap(e => e.skus))

const allProducts = [
  ...data.variable.map(p => ({
    name: p.name,
    skus: p.variants.map(v => v.sku).join(' / '),
    type: 'variable',
    brand: (p.categories[0] || {}).name || '',
  })),
  ...data.simple.map(p => ({
    name: p.name,
    skus: p.sku || '',
    type: 'simple',
    brand: (p.categories[0] || {}).name || '',
  })),
]

function csvRow(...cells) {
  return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
}

// ── compat-map-draft.csv (parsed — needs client validation) ───────────────
const draftRows = [csvRow('Product Name', 'SKU(s)', 'Printer Brand', 'Compatible Models (parsed)', 'Client: Correct? (Y/N)', 'Client: Notes')]
for (const e of draft) {
  draftRows.push(csvRow(e.name, e.skus.join(' / '), e.printerBrand, e.models.join(' / '), '', ''))
}
fs.writeFileSync(path.join(RAW, 'compat-map-draft.csv'), draftRows.join('\n'))

// ── compat-gaps.csv (no data — client must fill) ──────────────────────────
const gaps = allProducts.filter(p => {
  const primarySku = p.skus.split(' / ')[0]
  return !mappedSkus.has(primarySku)
})

const gapRows = [csvRow('Product Name', 'SKU(s)', 'WC Category', 'Compatible Printer Models (please fill in)')]
for (const p of gaps) {
  gapRows.push(csvRow(p.name, p.skus, p.brand, ''))
}
fs.writeFileSync(path.join(RAW, 'compat-gaps.csv'), gapRows.join('\n'))

console.log('✓ compat-map-draft.csv —', draft.length, 'rows (client to validate)')
console.log('✓ compat-gaps.csv      —', gaps.length, 'rows (client to fill in)')
