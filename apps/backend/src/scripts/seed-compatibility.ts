/**
 * Compatibility seed script — loads client-review.csv into the DB.
 *
 * Usage:
 *   pnpm --filter @tse/backend seed:compat          # idempotent upsert
 *   pnpm --filter @tse/backend seed:compat:reset     # truncate + full re-seed
 */

import { MedusaContainer } from "@medusajs/framework/types"
import * as fs from "fs"
import * as path from "path"
import { Client } from "pg"
import { randomUUID } from "crypto"
import { buildSearchName } from "./canonicalize"

const CSV_PATH = path.join(process.cwd(), "../../migration/raw/client-review.csv")

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Split on both "/" and "&" separators (some rows use "T730 & T830")
function splitList(raw: string): string[] {
  return raw
    .split(/\s*(?:\/|&)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Strip brand name prefix if a model was inadvertently stored as "HP 2130"
function stripBrandPrefix(brand: string, model: string): string {
  const prefix = brand.toLowerCase() + " "
  if (model.toLowerCase().startsWith(prefix)) return model.slice(prefix.length).trim()
  return model
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function seedCompatibility(_: { container: MedusaContainer }) {
  const RESET = process.env.RESET_COMPAT === "true"
  console.log("\n═══════════════════════════════════════════════════════════════")
  console.log(`  Compatibility Seed Script${RESET ? " (RESET mode)" : ""}`)
  console.log("═══════════════════════════════════════════════════════════════\n")

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  try {
    if (RESET) {
      console.log("  Truncating existing data...\n")
      await db.query("TRUNCATE cartridge_compat, printer_model, printer_brand CASCADE")
    }

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

      const brandName = (fields[2] ?? "").trim()
      const skusRaw   = (fields[1] ?? "").trim()
      const modelsRaw = (fields[3] ?? "").trim()

      if (!brandName || !skusRaw || !modelsRaw) continue

      const rawModelNames = splitList(modelsRaw)
        .map((m) => stripBrandPrefix(brandName, m))
        .filter((m) => m.toLowerCase() !== brandName.toLowerCase() && m.length > 2)

      const skus = splitList(skusRaw)

      if (!rawModelNames.length || !skus.length) continue

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

        for (const modelName of rawModelNames) {
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
               VALUES ($1, $2, 'parsed', $3, now(), now())
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
    console.log("  Seed complete")
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
