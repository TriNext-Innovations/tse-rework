'use strict';

/**
 * Reads seed-data.json, computes R2 image URLs from the WooCommerce filenames,
 * then sets images on each Medusa product (matched by handle).
 *
 * Run from repo root:
 *   node migration/link-images-to-products.js
 */

const fs   = require('fs');
const path = require('path');

const ENV_PATH  = path.join(__dirname, '..', 'apps', 'backend', '.env');
const SEED_PATH = path.join(__dirname, 'seed-data.json');

function loadEnv(filePath) {
  const env = {};
  fs.readFileSync(filePath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });
  return env;
}

const env          = loadEnv(ENV_PATH);
const R2_PUBLIC_URL = env.R2_PUBLIC_URL.replace(/\/$/, '');
const MEDUSA_URL   = env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const MEDUSA_EMAIL = env.MEDUSA_ADMIN_EMAIL;
const MEDUSA_PASSWORD = env.MEDUSA_ADMIN_PASSWORD;

function wcUrlToR2(wcUrl) {
  const filename = wcUrl.split('/').pop();
  return `${R2_PUBLIC_URL}/${filename}`;
}

async function getMedusaToken() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  return (await res.json()).token;
}

async function getProductByHandle(token, handle) {
  const res = await fetch(
    `${MEDUSA_URL}/admin/products?handle=${encodeURIComponent(handle)}&fields=id,handle,images`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`GET products?handle=${handle} → ${res.status}`);
  const { products } = await res.json();
  return products.find(p => p.handle === handle) ?? null;
}

async function setProductImages(token, productId, images) {
  const res = await fetch(`${MEDUSA_URL}/admin/products/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /admin/products/${productId} → ${res.status}: ${body}`);
  }
}

(async () => {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const products = seed.products.filter(p => p.images?.length);

  console.log(`\nLogging in to Medusa...`);
  const token = await getMedusaToken();

  console.log(`Linking images for ${products.length} products...\n`);

  let updated = 0, notFound = 0, failed = 0;

  for (const seedProduct of products) {
    const r2Images = seedProduct.images.map(img => ({ url: wcUrlToR2(img.url) }));

    let medusaProduct;
    try {
      medusaProduct = await getProductByHandle(token, seedProduct.handle);
    } catch (err) {
      console.error(`  ✗ lookup  ${seedProduct.handle}: ${err.message}`);
      failed++;
      continue;
    }

    if (!medusaProduct) {
      console.log(`  ?  missing  ${seedProduct.handle}`);
      notFound++;
      continue;
    }

    try {
      await setProductImages(token, medusaProduct.id, r2Images);
      console.log(`  ✓  ${seedProduct.handle}  →  ${r2Images[0].url}`);
      updated++;
    } catch (err) {
      console.error(`  ✗ update  ${seedProduct.handle}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found in Medusa, ${failed} errors.\n`);
})();
