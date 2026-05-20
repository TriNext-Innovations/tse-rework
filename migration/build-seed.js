'use strict';

/**
 * Builds a single clean Medusa v2 seed dataset from the transformed WooCommerce export.
 *
 * Input:  migration/raw/products-transformed.json
 * Output: migration/seed-data.json
 *
 * Fixes applied vs the raw transform:
 *   - Category restructure: 18 flat WooCommerce cats → 2-level Type→Brand hierarchy
 *   - Deletes test product "HP - 123 Toets"
 *   - Strips "Uncategorized" from all products; skips uncategorisable orphans
 *   - Pantum + Xerox correctly routed to Laser Cartridges
 *   - GI-4-* SKU typo corrected to CAN-GI46-*
 *   - Prices converted from ZAR string → integer cents (Medusa convention)
 *   - Fields renamed to Medusa v2 conventions (title, handle, options, variants, category_ids)
 *   - cartridge_type + brand stored as structured product metadata
 */

const fs = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'raw', 'products-transformed.json');
const OUTPUT = path.join(__dirname, 'seed-data.json');

// ── Category map: WooCommerce slug → new Medusa category ID + metadata ────────
const CAT_MAP = {
  'brother-inkjet-cartridges':                  { id: 'cat_inkjet_brother',        type: 'inkjet', brand: 'Brother' },
  'canon-inkjet-cartridges':                    { id: 'cat_inkjet_canon',          type: 'inkjet', brand: 'Canon' },
  'epson-inkjet-cartridges':                    { id: 'cat_inkjet_epson',          type: 'inkjet', brand: 'Epson' },
  'hp-inkjet-cartridges':                       { id: 'cat_inkjet_hp',             type: 'inkjet', brand: 'HP' },
  'lexmark-inkjet-cartridges':                  { id: 'cat_inkjet_lexmark',        type: 'inkjet', brand: 'Lexmark' },
  'samsung-inkjet-cartridges':                  { id: 'cat_inkjet_samsung',        type: 'inkjet', brand: 'Samsung' },
  'brother-laserjet-cartridges':                { id: 'cat_laser_brother',         type: 'laser',  brand: 'Brother' },
  'canon-laserjet-cartridges':                  { id: 'cat_laser_canon',           type: 'laser',  brand: 'Canon' },
  'hp-laserjet-cartridges':                     { id: 'cat_laser_hp',              type: 'laser',  brand: 'HP' },
  'generic-konica-minolta-laserjet-cartridges': { id: 'cat_laser_konica_minolta',  type: 'laser',  brand: 'Konica Minolta' },
  'generic-kyocera-laserjet-cartridges':        { id: 'cat_laser_kyocera',         type: 'laser',  brand: 'Kyocera' },
  'lexmark-laserjet-cartridges':                { id: 'cat_laser_lexmark',         type: 'laser',  brand: 'Lexmark' },
  'generic-oki-laserjet-cartridges':            { id: 'cat_laser_oki',             type: 'laser',  brand: 'OKI' },
  'pantum-cartridges':                          { id: 'cat_laser_pantum',          type: 'laser',  brand: 'Pantum' },
  'generic-ricoh-laserjet-cartridges':          { id: 'cat_laser_ricoh',           type: 'laser',  brand: 'Ricoh' },
  'samsung-laserjet-cartridges':                { id: 'cat_laser_samsung',         type: 'laser',  brand: 'Samsung' },
  'xerox-cartridges':                           { id: 'cat_laser_xerox',           type: 'laser',  brand: 'Xerox' },
};

// ── Products to hard-delete before seed (test/dummy data) ────────────────────
const DELETE_NAMES = new Set(['HP - 123 Toets']);

// ── Known SKU corrections from WooCommerce data entry errors ─────────────────
// GI-46 is a Canon product; the "-46" suffix was truncated to "-4" in WooCommerce
const SKU_FIXES = {
  'GI-4-K': 'CAN-GI46-K',
  'GI-4-C': 'CAN-GI46-C',
  'GI-4-M': 'CAN-GI46-M',
  'GI-4-Y': 'CAN-GI46-Y',
};

// ── Medusa v2 category hierarchy: Type (parent) → Brand (child) ───────────────
// Parents must be seeded before children; this array is ordered accordingly.
const CATEGORIES = [
  // ── Inkjet ──────────────────────────────────────────────────────────────────
  {
    id: 'cat_inkjet',
    name: 'Inkjet Cartridges',
    handle: 'inkjet-cartridges',
    is_active: true,
    is_internal: false,
    parent_category_id: null,
    description: 'Generic compatible inkjet cartridges for all major printer brands.',
  },
  { id: 'cat_inkjet_brother',  name: 'Brother',  handle: 'inkjet-brother',  is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic Brother inkjet cartridges.' },
  { id: 'cat_inkjet_canon',    name: 'Canon',    handle: 'inkjet-canon',    is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic Canon inkjet cartridges.' },
  { id: 'cat_inkjet_epson',    name: 'Epson',    handle: 'inkjet-epson',    is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic Epson inkjet cartridges.' },
  { id: 'cat_inkjet_hp',       name: 'HP',       handle: 'inkjet-hp',       is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic HP inkjet cartridges.' },
  { id: 'cat_inkjet_lexmark',  name: 'Lexmark',  handle: 'inkjet-lexmark',  is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic Lexmark inkjet cartridges.' },
  { id: 'cat_inkjet_samsung',  name: 'Samsung',  handle: 'inkjet-samsung',  is_active: true, is_internal: false, parent_category_id: 'cat_inkjet', description: 'Generic Samsung inkjet cartridges.' },

  // ── Laser ────────────────────────────────────────────────────────────────────
  {
    id: 'cat_laser',
    name: 'Laser Cartridges',
    handle: 'laser-cartridges',
    is_active: true,
    is_internal: false,
    parent_category_id: null,
    description: 'Generic compatible toner and laser cartridges for all major printer brands.',
  },
  { id: 'cat_laser_brother',        name: 'Brother',       handle: 'laser-brother',        is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Brother laser cartridges.' },
  { id: 'cat_laser_canon',          name: 'Canon',         handle: 'laser-canon',          is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Canon laser cartridges.' },
  { id: 'cat_laser_hp',             name: 'HP',            handle: 'laser-hp',             is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic HP laser cartridges.' },
  { id: 'cat_laser_konica_minolta', name: 'Konica Minolta', handle: 'laser-konica-minolta', is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Konica Minolta laser cartridges.' },
  { id: 'cat_laser_kyocera',        name: 'Kyocera',       handle: 'laser-kyocera',        is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Kyocera laser cartridges.' },
  { id: 'cat_laser_lexmark',        name: 'Lexmark',       handle: 'laser-lexmark',        is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Lexmark laser cartridges.' },
  { id: 'cat_laser_oki',            name: 'OKI',           handle: 'laser-oki',            is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic OKI laser cartridges.' },
  { id: 'cat_laser_pantum',         name: 'Pantum',        handle: 'laser-pantum',         is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Pantum laser cartridges.' },
  { id: 'cat_laser_ricoh',          name: 'Ricoh',         handle: 'laser-ricoh',          is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Ricoh laser cartridges.' },
  { id: 'cat_laser_samsung',        name: 'Samsung',       handle: 'laser-samsung',        is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Samsung laser cartridges.' },
  { id: 'cat_laser_xerox',          name: 'Xerox',         handle: 'laser-xerox',          is_active: true, is_internal: false, parent_category_id: 'cat_laser', description: 'Generic Xerox laser cartridges.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert ZAR price string to integer cents. "475" → 47500 */
function toZarCents(priceStr) {
  const n = parseFloat(priceStr);
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 100);
}

/** Apply known SKU corrections. */
function fixSku(sku) {
  if (!sku) return null;
  return SKU_FIXES[sku] ?? sku;
}

/**
 * Resolve which Medusa category + cartridge_type/brand metadata a product belongs to.
 * Skips "uncategorized"; returns null if no valid mapping found.
 */
function resolveCatMeta(wooCategories) {
  for (const cat of (wooCategories ?? [])) {
    if (cat.slug === 'uncategorized') continue;
    const mapped = CAT_MAP[cat.slug];
    if (mapped) return mapped;
  }
  return null;
}

/** Deduplicate and extract image URLs from a WooCommerce images array. */
function extractImageUrls(images) {
  const seen = new Set();
  const urls = [];
  for (const img of (images ?? [])) {
    if (img.src && !seen.has(img.src)) {
      seen.add(img.src);
      urls.push(img.src);
    }
  }
  return urls;
}

// ── Product transformers ──────────────────────────────────────────────────────

function transformVariable(p) {
  if (DELETE_NAMES.has(p.name)) return { _deleted: true };

  const catMeta = resolveCatMeta(p.categories);
  if (!catMeta) return { _skipped: true, name: p.name };

  // Collect all image URLs across all variants; de-duped, in variant order
  const allImageUrls = extractImageUrls(p.variants.flatMap(v => v.images ?? []));
  const colourValues = p.variants.map(v => v.colour);

  const variants = p.variants.map(v => {
    const priceZarCents = toZarCents(v.price);
    return {
      title: v.colour,
      sku: fixSku(v.sku),
      options: { Colour: v.colour },
      prices: [{ currency_code: 'zar', amount: priceZarCents }],
      inventory_quantity: 0,
      manage_inventory: false,
      allow_backorder: true,
      metadata: {
        woo_source_id: v.source_id,
        needs_pricing: priceZarCents === 0,
      },
    };
  });

  return {
    title: p.name,
    handle: p.slug,
    description: p.description || null,
    status: 'published',
    thumbnail: allImageUrls[0] ?? null,
    images: allImageUrls.map(url => ({ url })),
    options: [{ title: 'Colour', values: colourValues }],
    variants,
    category_ids: [catMeta.id],
    metadata: {
      cartridge_type: catMeta.type,
      brand: catMeta.brand,
      compatible: true,
    },
  };
}

function transformSimple(p) {
  if (DELETE_NAMES.has(p.name)) return { _deleted: true };

  const catMeta = resolveCatMeta(p.categories);
  if (!catMeta) return { _skipped: true, name: p.name };

  const imageUrls = extractImageUrls(p.images);
  const priceZarCents = toZarCents(p.price);
  const sku = fixSku(p.sku);

  return {
    title: p.name,
    handle: p.slug,
    description: p.description || null,
    status: 'published',
    thumbnail: imageUrls[0] ?? null,
    images: imageUrls.map(url => ({ url })),
    options: [],
    variants: [
      {
        title: 'Default Title',
        sku,
        options: {},
        prices: [{ currency_code: 'zar', amount: priceZarCents }],
        inventory_quantity: 0,
        manage_inventory: false,
        allow_backorder: true,
        metadata: {
          woo_source_id: p.source_id ?? null,
          needs_pricing: priceZarCents === 0,
        },
      },
    ],
    category_ids: [catMeta.id],
    metadata: {
      cartridge_type: catMeta.type,
      brand: catMeta.brand,
      compatible: true,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const input = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const products = [];
const warnings = [];
let deleted = 0;
let skipped = 0;

for (const p of (input.variable ?? [])) {
  const result = transformVariable(p);
  if (result._deleted) { deleted++; continue; }
  if (result._skipped) { skipped++; warnings.push(`[SKIP] No valid category for: ${result.name}`); continue; }
  products.push(result);
}

for (const p of (input.simple ?? [])) {
  const result = transformSimple(p);
  if (result._deleted) { deleted++; continue; }
  if (result._skipped) { skipped++; warnings.push(`[SKIP] No valid category for: ${result.name}`); continue; }
  products.push(result);
}

// Sort: variable products first (they have options), then simple; alphabetically within each group
products.sort((a, b) => {
  const aIsVar = a.options.length > 0 ? 0 : 1;
  const bIsVar = b.options.length > 0 ? 0 : 1;
  if (aIsVar !== bIsVar) return aIsVar - bIsVar;
  return a.title.localeCompare(b.title);
});

const totalVariants = products.reduce((n, p) => n + p.variants.length, 0);
const needsPricing  = products.reduce((n, p) => n + p.variants.filter(v => v.metadata.needs_pricing).length, 0);

const output = {
  generated: new Date().toISOString(),
  _note: 'Medusa v2 seed dataset for TSE printing supplies store. Import via migration/seed.ts.',
  summary: {
    categories: CATEGORIES.length,
    products: products.length,
    variants: totalVariants,
    deleted,
    skipped,
    needs_pricing: needsPricing,
  },
  currency_code: 'zar',
  categories: CATEGORIES,
  products,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

console.log('\nSeed data built:');
console.log(`  Output:       ${OUTPUT}`);
console.log(`  Categories:   ${CATEGORIES.length} (2 parents + 17 brand children)`);
console.log(`  Products:     ${products.length}`);
console.log(`  Variants:     ${totalVariants}`);
console.log(`  Deleted:      ${deleted} (test products)`);
console.log(`  Skipped:      ${skipped} (no valid category)`);
console.log(`  Needs pricing: ${needsPricing} variants with ZAR 0`);

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.log(' ', w));
}
