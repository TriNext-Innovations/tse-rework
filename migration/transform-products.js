/**
 * Transforms the raw WooCommerce product export into a structured format
 * suitable for the Medusa seed script.
 *
 * Groups products that share a base name and differ only by colour into
 * variable products with colour variations. Everything else stays simple.
 *
 * Input:  migration/raw/products.json
 * Output: migration/raw/products-transformed.json
 *         migration/raw/transform-report.json
 */

const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, 'raw');
const INPUT = path.join(RAW_DIR, 'products.json');
const OUTPUT = path.join(RAW_DIR, 'products-transformed.json');
const REPORT = path.join(RAW_DIR, 'transform-report.json');

const COLOUR_WORDS = new Set([
  'Black', 'BLACK',
  'Cyan', 'CYAN',
  'Magenta', 'MAGENTA',
  'Yellow', 'YELLOW',
  'Colour', 'Color', '3-Colour',
  'Light',
]);

function normaliseColour(word) {
  const map = {
    BLACK: 'Black',
    CYAN: 'Cyan',
    MAGENTA: 'Magenta',
    YELLOW: 'Yellow',
    Color: 'Colour',
    '3-Colour': 'Tri-Colour',
  };
  return map[word] ?? word;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractColour(name) {
  const parts = name.trim().split(' ');
  const last = parts[parts.length - 1];
  if (COLOUR_WORDS.has(last)) {
    return {
      baseName: parts.slice(0, -1).join(' ').trim(),
      colour: normaliseColour(last),
    };
  }
  return null;
}

function buildVariant(product, colour) {
  return {
    source_id: product.id,
    colour,
    sku: product.sku || null,
    price: product.price || product.regular_price || '0',
    regular_price: product.regular_price || '0',
    sale_price: product.sale_price || null,
    stock_status: product.stock_status,
    stock_quantity: product.stock_quantity ?? null,
    manage_stock: product.manage_stock,
    images: product.images ?? [],
  };
}

// Strips cartridge-colour references from HTML description strings.
// Preserves "Colour LaserJet" and "Color Laser" which are printer model names.
function cleanDescription(html) {
  if (!html) return '';

  // Colour words as they appear in descriptions (including all-caps variants)
  const colourPattern =
    /\s*\b(Yellow|YELLOW|Magenta|MAGENTA|Cyan|CYAN|Black|BLACK|Colour(?!\s+LaserJet)|Color(?!\s+LaserJet)(?!\s+LAzer)(?!\s+Laser))(\s+(with\s+chip|Ink\s+Cartridge|InkJet|inkjet))?\b/g;

  return html
    .replace(colourPattern, '')  // strip colour words + common suffixes
    .replace(/(\s*<br\s*\/?>\s*)+/gi, '<br />\n')  // collapse multiple <br>
    .replace(/(<br\s*\/?>\s*)+(<\/p>)/gi, '$2')     // remove trailing <br> before </p>
    .replace(/<p>\s*<\/p>/gi, '')                    // remove empty <p> tags
    .replace(/[\s ]+(<\/p>)/gi, '$1')           // trim whitespace before </p>
    .replace(/–\s*<\/p>/gi, '</p>')                  // remove trailing em-dashes
    .trim();
}

function buildVariableProduct(baseName, variants, representativeProduct) {
  return {
    type: 'variable',
    name: baseName,
    slug: slugify(baseName),
    description: cleanDescription(representativeProduct.description),
    short_description: cleanDescription(representativeProduct.short_description),
    categories: representativeProduct.categories ?? [],
    brands: representativeProduct.brands ?? [],
    attributes: ['Colour'],
    variants: variants.sort((a, b) => {
      const order = ['Black', 'Cyan', 'Magenta', 'Yellow', 'Tri-Colour', 'Colour', 'Light'];
      return order.indexOf(a.colour) - order.indexOf(b.colour);
    }),
  };
}

function buildSimpleProduct(product) {
  return {
    type: 'simple',
    source_id: product.id,
    name: product.name,
    slug: product.slug || slugify(product.name),
    description: product.description || '',
    short_description: product.short_description || '',
    sku: product.sku || null,
    price: product.price || product.regular_price || '0',
    regular_price: product.regular_price || '0',
    sale_price: product.sale_price || null,
    stock_status: product.stock_status,
    stock_quantity: product.stock_quantity ?? null,
    manage_stock: product.manage_stock,
    categories: product.categories ?? [],
    brands: product.brands ?? [],
    images: product.images ?? [],
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const products = raw.products;

// Step 1 — separate colour-suffixed products from the rest
const colourProducts = [];
const standaloneProducts = [];

for (const p of products) {
  const parsed = extractColour(p.name);
  if (parsed) {
    colourProducts.push({ ...p, _baseName: parsed.baseName, _colour: parsed.colour });
  } else {
    standaloneProducts.push(p);
  }
}

// Step 2 — group colour products by base name
const groups = {};
for (const p of colourProducts) {
  const key = p._baseName;
  if (!groups[key]) groups[key] = [];
  groups[key].push(p);
}

// Step 3 — groups with 2+ colours → variable; singletons → simple
const variableProducts = [];
const orphanSimpleProducts = [];

for (const [baseName, members] of Object.entries(groups)) {
  if (members.length > 1) {
    const variants = members.map(p => buildVariant(p, p._colour));
    variableProducts.push(buildVariableProduct(baseName, variants, members[0]));
  } else {
    orphanSimpleProducts.push(members[0]);
  }
}

// Step 4 — build final simple list (standalones + colour orphans)
const simpleProducts = [
  ...standaloneProducts.map(buildSimpleProduct),
  ...orphanSimpleProducts.map(p => buildSimpleProduct(p)),
];

// Step 5 — write output
const output = {
  generated: new Date().toISOString(),
  summary: {
    source_total: products.length,
    variable_products: variableProducts.length,
    total_variants: variableProducts.reduce((n, p) => n + p.variants.length, 0),
    simple_products: simpleProducts.length,
    output_total: variableProducts.length + simpleProducts.length,
  },
  variable: variableProducts,
  simple: simpleProducts,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

// Step 6 — write report
const report = {
  generated: new Date().toISOString(),
  summary: output.summary,
  variable_products: variableProducts.map(p => ({
    name: p.name,
    variant_count: p.variants.length,
    colours: p.variants.map(v => v.colour),
    skus: p.variants.map(v => v.sku),
  })),
  simple_products_sample: simpleProducts.slice(0, 20).map(p => ({
    name: p.name,
    sku: p.sku,
    category: p.categories?.[0]?.name ?? null,
  })),
  orphan_colour_products: orphanSimpleProducts.map(p => ({
    name: p.name,
    sku: p.sku,
    reason: 'colour suffix detected but no sibling colours found',
  })),
};

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

console.log('\nTransform complete:');
console.log(`  Source products:   ${output.summary.source_total}`);
console.log(`  Variable products: ${output.summary.variable_products} (${output.summary.total_variants} variants)`);
console.log(`  Simple products:   ${output.summary.simple_products}`);
console.log(`  Output total:      ${output.summary.output_total}`);
console.log(`\n  Written to: ${OUTPUT}`);
console.log(`  Report at:  ${REPORT}`);
