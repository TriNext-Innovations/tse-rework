/**
 * Compatibility seed script — loads compat-map-draft.csv into the DB.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/seed-compatibility.ts
 *
 * Idempotent — safe to re-run. Skips rows that already exist.
 * Logs brand/model/compat counts on completion.
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { COMPATIBILITY_MODULE } from "../modules/compatibility"
import * as fs from "fs"
import * as path from "path"

// CSV lives two levels up from apps/backend/
const CSV_PATH = path.join(process.cwd(), "../../migration/raw/compat-map-draft.csv")

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Minimal CSV line parser — handles double-quoted fields with embedded commas.
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

// Split " / " separated lists, trim each element, drop empties.
function splitList(raw: string): string[] {
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function seedCompatibility({ container }: { container: MedusaContainer }) {
  console.log("\n═══════════════════════════════════════════════════════════════")
  console.log("  Compatibility Seed Script")
  console.log("═══════════════════════════════════════════════════════════════\n")

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }

  const service = container.resolve(COMPATIBILITY_MODULE) as any

  // ── Load existing data into memory for idempotency checks ─────────────────
  const existingBrands: any[] = await service.listPrinterBrands({}, { select: ["id", "name", "slug"] })
  const brandBySlug = new Map<string, string>(existingBrands.map((b: any) => [b.slug, b.id]))

  const existingModels: any[] = await service.listPrinterModels({}, { select: ["id", "brand_id", "slug"] })
  const modelKey = (brandId: string, slug: string) => `${brandId}::${slug}`
  const modelByKey = new Map<string, string>(
    existingModels.map((m: any) => [modelKey(m.brand_id, m.slug), m.id])
  )

  const existingCompats: any[] = await service.listCartridgeCompats(
    {},
    { select: ["printer_model_id", "sku"] }
  )
  const compatKey = (modelId: string, sku: string) => `${modelId}::${sku}`
  const existingCompatSet = new Set<string>(
    existingCompats.map((cc: any) => compatKey(cc.printer_model_id, cc.sku))
  )

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const fileContent = fs.readFileSync(CSV_PATH, "utf-8")
  const lines = fileContent.split("\n").filter(Boolean)
  const dataLines = lines.slice(1) // skip header row

  let brandsCreated = 0
  let modelsCreated = 0
  let compatsCreated = 0
  let compatsSkipped = 0
  let rowErrors = 0

  console.log(`  CSV rows to process: ${dataLines.length}\n`)

  for (const line of dataLines) {
    const fields = parseCSVLine(line)
    if (fields.length < 4) continue

    // Columns: Product Name | SKU(s) | Printer Brand | Compatible Models
    const brandName = (fields[2] ?? "").trim()
    const skusRaw   = (fields[1] ?? "").trim()
    const modelsRaw = (fields[3] ?? "").trim()

    if (!brandName || !skusRaw || !modelsRaw) continue

    // Skip rows where models column is just the brand name or very short
    const modelNames = splitList(modelsRaw).filter(
      (m) => m.toLowerCase() !== brandName.toLowerCase() && m.length > 2
    )
    const skus = splitList(skusRaw)

    if (!modelNames.length || !skus.length) continue

    try {
      // ── Get or create brand ─────────────────────────────────────────────
      const brandSlug = slugify(brandName)
      let brandId: string = brandBySlug.get(brandSlug) ?? ""

      if (!brandId) {
        const [created] = await service.createPrinterBrands([{ name: brandName, slug: brandSlug }])
        brandId = created.id as string
        brandBySlug.set(brandSlug, brandId)
        brandsCreated++
      }

      // ── Get or create each printer model ────────────────────────────────
      const modelIds: string[] = []

      for (const modelName of modelNames) {
        const mSlug  = slugify(modelName)
        const key    = modelKey(brandId, mSlug)
        let modelId: string = modelByKey.get(key) ?? ""

        if (!modelId) {
          const [created] = await service.createPrinterModels([{
            name: modelName,
            slug: mSlug,
            brand_id: brandId,
            validated: false,
          }])
          modelId = created.id as string
          modelByKey.set(key, modelId)
          modelsCreated++
        }

        modelIds.push(modelId)
      }

      // ── Create cartridge_compat rows (model × sku) ─────────────────────
      for (const modelId of modelIds) {
        for (const sku of skus) {
          const key = compatKey(modelId, sku)
          if (existingCompatSet.has(key)) {
            compatsSkipped++
            continue
          }

          await service.createCartridgeCompats([{
            sku,
            printer_model_id: modelId,
            source: "parsed",
          }])

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
}
