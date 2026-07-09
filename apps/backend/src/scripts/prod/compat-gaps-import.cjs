/**
 * Standalone compat gap-fill importer for the prod medusa container.
 * (Runtime image has no pnpm/medusa CLI/TS — plain node + container's pg.)
 *
 * Usage (inside container):  node /tmp/compat-gaps-import.cjs [--dry-run]
 * Reads /tmp/compat-gaps.csv  (name,sku,brand,models — '/'-delimited lists)
 *
 * Mirrors apps/backend/src/scripts/seed-compatibility-gaps.ts exactly.
 * All inserted compat rows get source='gap-fill' → reversible via
 *   DELETE FROM cartridge_compat WHERE source='gap-fill';
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
// pg lives in the pnpm virtual store in the prod image — probe candidates.
const PG_CANDIDATES = [
  path.resolve(process.cwd(), "node_modules/pg"),
  "/app/node_modules/pg",
  ...require("fs")
    .readdirSync("/app/node_modules/.pnpm")
    .filter((d) => /^pg@/.test(d))
    .map((d) => `/app/node_modules/.pnpm/${d}/node_modules/pg`),
]
let Client
for (const p of PG_CANDIDATES) {
  try { Client = require(p).Client; break } catch {}
}
if (!Client) throw new Error("pg module not found in any candidate path")

const CSV_PATH = "/tmp/compat-gaps.csv"
const DRY = process.argv.includes("--dry-run")

// ── ported from src/scripts/canonicalize.ts ──────────────────────────────────
function canonicalize(brand, model) {
  const b = brand.toLowerCase().trim()
  const m = model.trim()
  if (b === "canon") {
    if (/^(MX|MG|TS|TR)\s*\d/i.test(m) && !/pixma/i.test(m)) return `PIXMA ${m}`
    if (/^G\d/i.test(m) && !/pixma/i.test(m) && !/maxify/i.test(m)) return `PIXMA ${m}`
    if (/^GX\d/i.test(m) && !/maxify/i.test(m)) return `MAXIFY ${m}`
    if (/^(MF|LBP)\d/i.test(m) && !/sensys/i.test(m) && !/image/i.test(m)) return `i-SENSYS ${m}`
    if (/^iR\d/i.test(m) && !/imagerunner/i.test(m)) return `imageRUNNER ${m}`
  }
  if (b === "hp") {
    if (/^P\d/i.test(m) && !/laserjet/i.test(m)) return `LaserJet ${m}`
    if (
      /^M\d{3}/i.test(m) &&
      !/laserjet/i.test(m) && !/pro/i.test(m) && !/enterprise/i.test(m) &&
      !/color/i.test(m) && !/colour/i.test(m)
    ) return `LaserJet ${m}`
  }
  if (b === "kyocera") {
    if (/^(M|P)\d/i.test(m) && !/ecosys/i.test(m) && !/taskalfa/i.test(m)) return `ECOSYS ${m}`
  }
  return m
}
function buildSearchName(brand, model) {
  return (brand + canonicalize(brand, model)).toLowerCase().replace(/[^a-z0-9]/g, "")
}

// ── ported from src/scripts/seed-compatibility-gaps.ts ───────────────────────
function slugify(t) {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
function parseCSVLine(line) {
  const fields = []
  let inQuotes = false, current = ""
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = "" }
    else current += ch
  }
  fields.push(current.trim())
  return fields
}
const splitList = (raw) => raw.split("/").map((s) => s.trim()).filter(Boolean)

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`)
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const counts = async () => {
      const r = await db.query(`SELECT
        (SELECT count(*) FROM printer_brand   WHERE deleted_at IS NULL) AS brands,
        (SELECT count(*) FROM printer_model   WHERE deleted_at IS NULL) AS models,
        (SELECT count(*) FROM cartridge_compat WHERE deleted_at IS NULL) AS compat,
        (SELECT count(*) FROM cartridge_compat WHERE source='gap-fill' AND deleted_at IS NULL) AS gapfill`)
      return r.rows[0]
    }
    console.log(`\n  Compat gap-fill import${DRY ? " (DRY RUN)" : ""}`)
    console.log("  BEFORE:", JSON.stringify(await counts()))

    const { rows: eb } = await db.query("SELECT id, slug FROM printer_brand WHERE deleted_at IS NULL")
    const brandBySlug = new Map(eb.map((r) => [r.slug, r.id]))
    const { rows: em } = await db.query("SELECT id, brand_id, slug FROM printer_model WHERE deleted_at IS NULL")
    const mKey = (b, s) => `${b}::${s}`
    const modelByKey = new Map(em.map((r) => [mKey(r.brand_id, r.slug), r.id]))
    const { rows: ec } = await db.query("SELECT printer_model_id, sku FROM cartridge_compat WHERE deleted_at IS NULL")
    const cKey = (m, s) => `${m}::${s}`
    const compatSet = new Set(ec.map((r) => cKey(r.printer_model_id, r.sku)))

    const lines = fs.readFileSync(CSV_PATH, "utf-8").split("\n").filter(Boolean).slice(1)
    let brandsCreated = 0, modelsCreated = 0, compatsCreated = 0, compatsSkipped = 0, rowErrors = 0
    console.log(`  CSV rows: ${lines.length}`)

    for (const line of lines) {
      const f = parseCSVLine(line)
      if (f.length < 4) continue
      const skusRaw = f[1] || "", brandName = f[2] || "", modelsRaw = f[3] || ""
      if (!brandName || !skusRaw || !modelsRaw) continue
      const modelNames = splitList(modelsRaw)
      const skus = splitList(skusRaw)
      if (!modelNames.length || !skus.length) continue
      try {
        const brandSlug = slugify(brandName)
        let brandId = brandBySlug.get(brandSlug) || ""
        if (!brandId) {
          if (DRY) { brandId = "dry-" + brandSlug; brandsCreated++ }
          else {
            const { rows } = await db.query(
              `INSERT INTO printer_brand (id, name, slug, created_at, updated_at)
               VALUES ($1,$2,$3,now(),now())
               ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, updated_at=now()
               RETURNING id`,
              [crypto.randomUUID(), brandName, brandSlug])
            brandId = rows[0].id; brandsCreated++
          }
          brandBySlug.set(brandSlug, brandId)
        }
        const modelIds = []
        for (const modelName of modelNames) {
          const mSlug = slugify(modelName)
          const key = mKey(brandId, mSlug)
          let mId = modelByKey.get(key) || ""
          if (!mId) {
            if (DRY) { mId = "dry-" + key; modelsCreated++ }
            else {
              const { rows } = await db.query(
                `INSERT INTO printer_model (id, name, slug, brand_id, search_name, validated, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,false,now(),now())
                 ON CONFLICT (brand_id, slug)
                 DO UPDATE SET name=EXCLUDED.name, search_name=EXCLUDED.search_name, updated_at=now()
                 RETURNING id`,
                [crypto.randomUUID(), modelName, mSlug, brandId, buildSearchName(brandName, modelName)])
              mId = rows[0].id; modelsCreated++
            }
            modelByKey.set(key, mId)
          }
          modelIds.push(mId)
        }
        for (const mId of modelIds) {
          for (const sku of skus) {
            const key = cKey(mId, sku)
            if (compatSet.has(key)) { compatsSkipped++; continue }
            if (!DRY) {
              await db.query(
                `INSERT INTO cartridge_compat (id, sku, source, printer_model_id, created_at, updated_at)
                 VALUES ($1,$2,'gap-fill',$3,now(),now())
                 ON CONFLICT (printer_model_id, sku) DO NOTHING`,
                [crypto.randomUUID(), sku, mId])
            }
            compatSet.add(key); compatsCreated++
          }
        }
      } catch (err) {
        console.error(`  [error] Row "${f[0]}": ${err.message}`)
        rowErrors++
      }
    }

    console.log(`  Brands created:  ${brandsCreated}`)
    console.log(`  Models created:  ${modelsCreated}`)
    console.log(`  Compat rows:     ${compatsCreated} new / ${compatsSkipped} already present`)
    if (rowErrors) console.log(`  Row errors:      ${rowErrors}`)
    console.log("  AFTER: ", JSON.stringify(await counts()))
  } finally {
    await db.end()
  }
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
