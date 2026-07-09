/**
 * Compat gap-fill seed script — loads compat-gaps.csv into the DB.
 *
 * Source file is the client's "Missing Compatibility" sheet, pre-cleaned to
 * name,sku,brand,models (see migration/raw/compat-gaps.csv). Rows the client
 * marked "Haal af asb" are excluded here — they live in
 * migration/raw/compat-gaps-delist.csv as a delisting work list instead.
 *
 * Usage:
 *   pnpm --filter @tse/backend seed:compat:gaps    # idempotent upsert
 *
 * Compat rows are tagged source='gap-fill' so the batch is auditable and
 * reversible:  DELETE FROM cartridge_compat WHERE source = 'gap-fill';
 */

import { MedusaContainer } from "@medusajs/framework/types"
import * as fs from "fs"
import * as path from "path"
import { Client } from "pg"
import { randomUUID } from "crypto"
import { buildSearchName } from "./canonicalize"

const CSV_PATH = path.join(process.cwd(), "../../migration/raw/compat-gaps.csv")

// ── Helpers (same rules as seed-compatibility.ts) ─────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let inQuotes = false
  let current = ""

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// compat-gaps.csv is pre-normalized: both skus and models are '/'-delimited
function splitList(raw: string): string[] {
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function seedCompatibilityGaps(_: { container: MedusaContainer }) {
  console.log("\n═══════════════════════════════════════════════════════════════")
  console.log("  Compat Gap-Fill Seed Script (source='gap-fill')")
  console.log("═══════════════════════════════════════════════════════════════\n")

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  try {
    // ── In-memory caches for idempotency ─────────────────────────────────────
    const { rows: existingBrands } = await db.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM printer_brand WHERE deleted_at IS NULL"
    )
    const brandBySlug = new Map<string, string>(existingBrands.map((r) => [r.slug, r.id]))

    const { rows: existingModels } = await db.query<{ id: string; brand_id: string; slug: string }>(
      "SELECT id, brand_id, slug FROM printer_model WHERE deleted_at IS NULL"
    )
    const modelKey = (brandId: string, slug: string) => `${brandId}::${slug}`
    const modelByKey = new Map<string, string>(
      existingModels.map((r) => [modelKey(r.brand_id, r.slug), r.id])
    )

    const { rows: existingCompats } = await db.query<{ printer_model_id: string; sku: string }>(
      "SELECT printer_model_id, sku FROM cartridge_compat WHERE deleted_at IS NULL"
    )
    const compatKey = (modelId: string, sku: string) => `${modelId}::${sku}`
    const existingCompatSet = new Set<string>(
      existingCompats.map((r) => compatKey(r.printer_model_id, r.sku))
    )

    // ── Parse CSV ─────────────────────────────────────────────────────────────
    const fileContent = fs.readFileSync(CSV_PATH, "utf-8")
    const lines = fileContent.split("\n").filter(Boolean)
    const dataLines = lines.slice(1) // skip header

    let brandsCreated = 0
    let modelsCreated = 0
    let compatsCreated = 0
    let compatsSkipped = 0
    let rowErrors = 0

    console.log(`  CSV rows to process: ${dataLines.length}\n`)

    for (const line of dataLines) {
      const fields = parseCSVLine(line)
      if (fields.length < 4) continue

      const skusRaw   = (fields[1] ?? "").trim()
      const brandName = (fields[2] ?? "").trim()
      const modelsRaw = (fields[3] ?? "").trim()

      if (!brandName || !skusRaw || !modelsRaw) continue

      const modelNames = splitList(modelsRaw)
      const skus = splitList(skusRaw)

      if (!modelNames.length || !skus.length) continue

      try {
        // ── Get or create brand ─────────────────────────────────────────────
        const brandSlug = slugify(brandName)
        let brandId: string = brandBySlug.get(brandSlug) ?? ""

        if (!brandId) {
          const { rows } = await db.query<{ id: string }>(
            `INSERT INTO printer_brand (id, name, slug, created_at, updated_at)
             VALUES ($1, $2, $3, now(), now())
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
             RETURNING id`,
            [randomUUID(), brandName, brandSlug]
          )
          brandId = rows[0]!.id
          brandBySlug.set(brandSlug, brandId)
          brandsCreated++
        }

        // ── Get or create each printer model ────────────────────────────────
        const modelIds: string[] = []

        for (const modelName of modelNames) {
          const mSlug      = slugify(modelName)
          const searchName = buildSearchName(brandName, modelName)
          const key        = modelKey(brandId, mSlug)
          let mId: string  = modelByKey.get(key) ?? ""

          if (!mId) {
            const { rows } = await db.query<{ id: string }>(
              `INSERT INTO printer_model
                 (id, name, slug, brand_id, search_name, validated, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, false, now(), now())
               ON CONFLICT (brand_id, slug)
               DO UPDATE SET
                 name        = EXCLUDED.name,
                 search_name = EXCLUDED.search_name,
                 updated_at  = now()
               RETURNING id`,
              [randomUUID(), modelName, mSlug, brandId, searchName]
            )
            mId = rows[0]!.id
            modelByKey.set(key, mId)
            modelsCreated++
          }

          modelIds.push(mId)
        }

        // ── Create cartridge_compat rows (model × sku) ─────────────────────
        for (const mId of modelIds) {
          for (const sku of skus) {
            const key = compatKey(mId, sku)
            if (existingCompatSet.has(key)) {
              compatsSkipped++
              continue
            }

            await db.query(
              `INSERT INTO cartridge_compat
                 (id, sku, source, printer_model_id, created_at, updated_at)
               VALUES ($1, $2, 'gap-fill', $3, now(), now())
               ON CONFLICT (printer_model_id, sku) DO NOTHING`,
              [randomUUID(), sku, mId]
            )

            existingCompatSet.add(key)
            compatsCreated++
          }
        }
      } catch (err: any) {
        console.error(`  [error] Row "${fields[0]}": ${err.message}`)
        rowErrors++
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════")
    console.log("  Gap-fill seed complete")
    console.log("═══════════════════════════════════════════════════════════════")
    console.log(`  Brands   created: ${brandsCreated} (${brandBySlug.size} total)`)
    console.log(`  Models   created: ${modelsCreated} (${modelByKey.size} total)`)
    console.log(`  Compat rows:      ${compatsCreated} new / ${compatsSkipped} skipped`)
    if (rowErrors) console.log(`  Row errors:       ${rowErrors}`)
    console.log()
  } finally {
    await db.end()
  }
}
