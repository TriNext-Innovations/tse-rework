/**
 * Downloads all unique product images from tse.co.za.
 * Flags images below 800x800px using srcset width hints.
 *
 * Input:  migration/raw/products.json
 * Output: migration/images/{filename}
 *         migration/raw/image-audit.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const RAW_DIR = path.join(__dirname, 'raw');
const IMAGES_DIR = path.join(__dirname, 'images');
const INPUT = path.join(RAW_DIR, 'products.json');
const AUDIT_OUT = path.join(RAW_DIR, 'image-audit.json');

const MIN_SIZE = 800;
const CONCURRENCY = 5;

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maxWidthFromSrcset(srcset) {
  if (!srcset) return null;
  const widths = [...srcset.matchAll(/\s(\d+)w/g)].map(m => parseInt(m[1]));
  return widths.length ? Math.max(...widths) : null;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve({ skipped: true });
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 30000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve({ skipped: false })));
    });
    req.on('error', e => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(e); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    if (i >= tasks.length) return;
    const idx = i++;
    results[idx] = await tasks[idx]();
    await next();
  }
  await Promise.all(Array.from({ length: limit }, next));
  return results;
}

// ─── Build image list ─────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const prods = raw.products;

const seen = new Set();
const imageRecords = [];

prods.forEach(p => {
  (p.images || []).forEach(img => {
    if (!img.src || seen.has(img.src)) return;
    seen.add(img.src);

    const filename = path.basename(new URL(img.src).pathname);
    const maxWidth = maxWidthFromSrcset(img.srcset);

    imageRecords.push({
      src: img.src,
      filename,
      dest: path.join(IMAGES_DIR, filename),
      maxWidth,
      belowThreshold: maxWidth !== null && maxWidth < MIN_SIZE,
      unknownSize: maxWidth === null,
      productId: p.id,
      productName: p.name,
    });
  });
});

const noImageProducts = prods.filter(p => !p.images || p.images.length === 0).map(p => p.name);
const placeholderProducts = prods
  .filter(p => p.images && p.images.length > 0 && p.images.every(i => i.src.includes('Tse.jpg')))
  .map(p => p.name);

console.log(`\nFound ${imageRecords.length} unique images across ${prods.length} products.`);
console.log(`Products with no image: ${noImageProducts.length}`);
console.log(`Products using only placeholder (Tse.jpg): ${placeholderProducts.length}`);
console.log(`\nDownloading to ${IMAGES_DIR} ...\n`);

// ─── Download ─────────────────────────────────────────────────────────────────

let done = 0;
let failed = 0;
const failures = [];

const tasks = imageRecords.map(rec => async () => {
  try {
    const result = await download(rec.src, rec.dest);
    rec.downloaded = true;
    rec.skipped = result.skipped;
  } catch (e) {
    rec.downloaded = false;
    rec.error = e.message;
    failures.push({ src: rec.src, error: e.message });
    failed++;
  }
  done++;
  if (done % 20 === 0 || done === imageRecords.length) {
    process.stdout.write(`\r  ${done}/${imageRecords.length} (${failed} failed)`);
  }
});

runWithConcurrency(tasks, CONCURRENCY).then(() => {
  console.log('\n');

  const belowThreshold = imageRecords.filter(r => r.belowThreshold);
  const unknownSize = imageRecords.filter(r => r.unknownSize && r.downloaded);
  const successful = imageRecords.filter(r => r.downloaded);

  // ─── Audit report ───────────────────────────────────────────────────────────

  const audit = {
    generated: new Date().toISOString(),
    summary: {
      total_unique_images: imageRecords.length,
      downloaded: successful.length,
      failed: failures.length,
      below_threshold: belowThreshold.length,
      unknown_size: unknownSize.length,
      products_no_image: noImageProducts.length,
      products_placeholder_only: placeholderProducts.length,
    },
    below_threshold_images: belowThreshold.map(r => ({
      src: r.src,
      max_width: r.maxWidth,
      product: r.productName,
    })),
    unknown_size_images: unknownSize.map(r => ({ src: r.src, product: r.productName })),
    products_no_image: noImageProducts,
    products_placeholder_only: placeholderProducts,
    failed_downloads: failures,
  };

  fs.writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2));

  console.log('Download complete:');
  console.log(`  Total unique images:      ${audit.summary.total_unique_images}`);
  console.log(`  Successfully downloaded:  ${audit.summary.downloaded}`);
  console.log(`  Failed:                   ${audit.summary.failed}`);
  console.log(`  Below 800px threshold:    ${audit.summary.below_threshold}`);
  console.log(`  Unknown size:             ${audit.summary.unknown_size}`);
  console.log(`  Products with no image:   ${audit.summary.products_no_image}`);
  console.log(`  Placeholder only:         ${audit.summary.products_placeholder_only}`);
  console.log(`\n  Saved to:   ${IMAGES_DIR}`);
  console.log(`  Audit at:   ${AUDIT_OUT}`);
});
