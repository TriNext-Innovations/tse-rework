/**
 * Printerland compat importer for the prod medusa container (#482).
 * (Runtime image has no pnpm/medusa CLI/TS — plain node + container's pg.)
 *
 * Usage (inside container):  node /tmp/compat-printerland-import.cjs [--dry-run]
 * Reads /tmp/printerland-import.csv, written by scripts/printerland/match.ts:
 *   sku,brand,model_slug,model_name,new_model
 *
 * Add-only, unlike compat-gaps-import.cjs: existing brands and models are
 * looked up by slug and never updated, new models are created validated=false,
 * and every insert is ON CONFLICT DO NOTHING. A row naming an existing model
 * that has since gone, or a brand we don't have, is skipped and reported.
 * Every compat row gets source='printerland' → reversible via
 *   DELETE FROM cartridge_compat WHERE source='printerland';
 * plus the models it created (validated=false, no remaining compat rows).
 *
 * New models are only searchable after a Meilisearch re-index (bulk-index.ts);
 * the deploy never does that.
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const PG_CANDIDATES = [
  path.resolve(process.cwd(), "node_modules/pg"),
  "/app/node_modules/pg",
  ...(fs.existsSync("/app/node_modules/.pnpm") ? fs.readdirSync("/app/node_modules/.pnpm") : [])
    .filter((d) => /^pg@/.test(d))
    .map((d) => `/app/node_modules/.pnpm/${d}/node_modules/pg`),
  process.env.PG_MODULE,
].filter(Boolean)
let Client
for (const p of PG_CANDIDATES) {
  try { Client = require(p).Client; break } catch {}
}
if (!Client) throw new Error("pg module not found in any candidate path")

const CSV_PATH = process.env.CSV_PATH ?? "/tmp/printerland-import.csv"
const DRY = process.argv.includes("--dry-run")
const SOURCE = "printerland"

// ── ported from src/scripts/canonicalize.ts (search_name only) ───────────────
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
function slugify(t) {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
function parseCSVLine(line) {
  const fields = []
  let inQuotes = false, current = ""
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++ }
    else if (ch === '"') inQuotes = !inQuotes
    else if (ch === "," && !inQuotes) { fields.push(current); current = "" }
    else current += ch
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`)
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const counts = async () => (await db.query(
    `SELECT (SELECT count(*) FROM printer_model WHERE deleted_at IS NULL) AS models,
            (SELECT count(*) FROM printer_model WHERE deleted_at IS NULL AND validated = false) AS unvalidated,
            (SELECT count(*) FROM cartridge_compat WHERE deleted_at IS NULL) AS compat,
            (SELECT count(*) FROM cartridge_compat WHERE source='${SOURCE}' AND deleted_at IS NULL) AS printerland`)).rows[0]

  try {
    console.log(`\n  Printerland compat import${DRY ? " (DRY RUN)" : ""}`)
    console.log("  BEFORE:", JSON.stringify(await counts()))

    const brandBySlug = new Map(
      (await db.query("SELECT id, slug FROM printer_brand WHERE deleted_at IS NULL")).rows.map((r) => [r.slug, r.id]),
    )
    const modelKey = (brandId, slug) => `${brandId}::${slug}`
    const modelByKey = new Map(
      (await db.query("SELECT id, brand_id, slug FROM printer_model WHERE deleted_at IS NULL")).rows.map((r) => [
        modelKey(r.brand_id, r.slug), r.id,
      ]),
    )
    const compatSet = new Set(
      (await db.query("SELECT printer_model_id, sku FROM cartridge_compat WHERE deleted_at IS NULL")).rows.map(
        (r) => `${r.printer_model_id}::${r.sku}`,
      ),
    )
    const skuSet = new Set(
      (await db.query("SELECT sku FROM product_variant WHERE deleted_at IS NULL AND sku IS NOT NULL")).rows.map((r) => r.sku),
    )

    const lines = fs.readFileSync(CSV_PATH, "utf-8").split("\n").filter(Boolean)
    if (lines[0] !== "sku,brand,model_slug,model_name,new_model") throw new Error(`Unexpected header: ${lines[0]}`)

    let modelsCreated = 0, compatsCreated = 0, compatsPresent = 0
    const skipped = []

    if (!DRY) await db.query("BEGIN")
    for (const line of lines.slice(1)) {
      const [sku, brand, modelSlug, modelName, isNew] = parseCSVLine(line)
      const brandId = brandBySlug.get(slugify(brand))
      if (!brandId) { skipped.push(`${sku} → ${brand} ${modelName}: no such brand`); continue }
      if (!skuSet.has(sku)) { skipped.push(`${sku} → ${modelName}: SKU no longer exists`); continue }

      let modelId = modelByKey.get(modelKey(brandId, modelSlug))
      if (!modelId) {
        if (isNew !== "true") { skipped.push(`${sku} → ${brand} ${modelName}: existing model has gone`); continue }
        if (DRY) modelId = `dry-${modelSlug}`
        else {
          const { rows } = await db.query(
            `INSERT INTO printer_model (id, name, slug, brand_id, search_name, validated, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, false, now(), now())
             ON CONFLICT (brand_id, slug) DO NOTHING
             RETURNING id`,
            [crypto.randomUUID(), modelName, modelSlug, brandId, buildSearchName(brand, modelName)],
          )
          modelId = rows[0]?.id
            ?? (await db.query("SELECT id FROM printer_model WHERE brand_id=$1 AND slug=$2 AND deleted_at IS NULL", [brandId, modelSlug])).rows[0]?.id
        }
        modelByKey.set(modelKey(brandId, modelSlug), modelId)
        modelsCreated++
      }

      const key = `${modelId}::${sku}`
      if (compatSet.has(key)) { compatsPresent++; continue }
      if (!DRY) {
        await db.query(
          `INSERT INTO cartridge_compat (id, sku, source, printer_model_id, created_at, updated_at)
           VALUES ($1, $2, '${SOURCE}', $3, now(), now())
           ON CONFLICT (printer_model_id, sku) DO NOTHING`,
          [crypto.randomUUID(), sku, modelId],
        )
      }
      compatSet.add(key)
      compatsCreated++
    }
    if (!DRY) await db.query("COMMIT")

    console.log(`  CSV rows:        ${lines.length - 1}`)
    console.log(`  Models created:  ${modelsCreated} (validated=false)`)
    console.log(`  Compat rows:     ${compatsCreated} new / ${compatsPresent} already present`)
    if (skipped.length) console.log(`  Skipped:         ${skipped.length}\n    ${skipped.join("\n    ")}`)
    console.log("  AFTER: ", JSON.stringify(await counts()))
    if (!DRY && modelsCreated) console.log("\n  New models are not searchable until bulk-index.ts runs.")
  } catch (err) {
    if (!DRY) await db.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    await db.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
