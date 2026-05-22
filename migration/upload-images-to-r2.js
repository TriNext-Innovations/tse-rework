'use strict';

/**
 * One-shot migration: upload product images to Cloudflare R2, then update
 * every matching product image URL in Medusa to point at R2.
 *
 * Run from repo root:
 *   node migration/upload-images-to-r2.js
 *
 * Reads R2 + Medusa credentials from apps/backend/.env (no dotenv dep needed).
 */

const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// ── Config ────────────────────────────────────────────────────────────────────

const ENV_PATH    = path.join(__dirname, '..', 'apps', 'backend', '.env');
const IMAGES_DIR  = path.join(__dirname, 'images');

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

const env = loadEnv(ENV_PATH);

const R2_ENDPOINT        = env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID   = env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY      = env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET          = env.R2_BUCKET;
const R2_PUBLIC_URL      = env.R2_PUBLIC_URL.replace(/\/$/, '');
const MEDUSA_URL         = env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const MEDUSA_EMAIL       = env.MEDUSA_ADMIN_EMAIL;
const MEDUSA_PASSWORD    = env.MEDUSA_ADMIN_PASSWORD;

const WC_ORIGIN_RE = /^https?:\/\/www\.tse\.co\.za\/wp-content\/uploads\/[^/]+\/[^/]+\//;

// ── MIME type map ─────────────────────────────────────────────────────────────

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

// ── S3 client (R2 is S3-compatible) ──────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_KEY },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileExistsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(localPath, key) {
  const ext = path.extname(key).toLowerCase();
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: MIME[ext] || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000',
  }));
}

async function medusaFetch(token, method, endpoint, body) {
  const res = await fetch(`${MEDUSA_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Medusa ${method} ${endpoint} → ${res.status}`);
  return res.json();
}

async function getMedusaToken() {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Medusa auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

// ── Step 1: Upload images to R2 ───────────────────────────────────────────────

async function uploadAll() {
  const files = fs.readdirSync(IMAGES_DIR);
  console.log(`\nUploading ${files.length} images to R2...\n`);

  let uploaded = 0, skipped = 0, failed = 0;

  for (const encodedName of files) {
    const key = decodeURIComponent(encodedName);
    const localPath = path.join(IMAGES_DIR, encodedName);

    if (await fileExistsInR2(key)) {
      process.stdout.write(`  skip  ${key}\n`);
      skipped++;
      continue;
    }

    try {
      await uploadFile(localPath, key);
      process.stdout.write(`  ✓     ${key}\n`);
      uploaded++;
    } catch (err) {
      process.stdout.write(`  ✗     ${key}  (${err.message})\n`);
      failed++;
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed.\n`);
}

// ── Step 2: Update Medusa product image URLs ──────────────────────────────────

async function updateMedusaImages(token) {
  console.log('Scanning Medusa products for WooCommerce image URLs...\n');

  let offset = 0;
  const limit = 50;
  let totalUpdated = 0;

  while (true) {
    const { products, count } = await medusaFetch(
      token, 'GET', `/admin/products?limit=${limit}&offset=${offset}&fields=id,images`
    );

    for (const product of products) {
      if (!product.images?.length) continue;

      const updatedImages = product.images.map(img => {
        if (!WC_ORIGIN_RE.test(img.url)) return img;
        const filename = decodeURIComponent(img.url.split('/').pop());
        return { url: `${R2_PUBLIC_URL}/${filename}` };
      });

      const changed = updatedImages.some((img, i) => img.url !== product.images[i].url);
      if (!changed) continue;

      await medusaFetch(token, 'POST', `/admin/products/${product.id}`, { images: updatedImages });
      console.log(`  updated  ${product.id}`);
      totalUpdated++;
    }

    offset += products.length;
    if (offset >= count) break;
  }

  console.log(`\nUpdated ${totalUpdated} products.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await uploadAll();

    console.log('Logging in to Medusa...');
    const token = await getMedusaToken();

    await updateMedusaImages(token);

    console.log('Migration complete.');
  } catch (err) {
    console.error('\nFATAL:', err.message);
    process.exit(1);
  }
})();
