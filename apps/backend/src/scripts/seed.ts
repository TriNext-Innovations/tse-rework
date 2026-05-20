/**
 * TSE seed script — Medusa v2
 *
 * Imports categories and products from migration/seed-data.json.
 * Safe to re-run: skips anything that already exists by handle.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/seed.ts
 *
 * Or from apps/backend/:
 *   npx medusa exec src/scripts/seed.ts
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import * as fs from "fs"
import * as path from "path"

// seed-data.json lives at the monorepo root: <root>/migration/seed-data.json
// process.cwd() when medusa exec runs = apps/backend/
const SEED_FILE = path.join(process.cwd(), "../../migration/seed-data.json")
const BATCH_SIZE = 10

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeedCategory {
  id: string
  name: string
  handle: string
  description: string
  is_active: boolean
  is_internal: boolean
  parent_category_id: string | null
}

interface SeedVariant {
  title: string
  sku: string | null
  options: Record<string, string>
  prices: { currency_code: string; amount: number }[]
  inventory_quantity: number
  manage_inventory: boolean
  allow_backorder: boolean
  metadata: Record<string, unknown>
}

interface SeedProduct {
  title: string
  handle: string
  description: string | null
  status: "published" | "draft"
  thumbnail: string | null
  images: { url: string }[]
  options: { title: string; values: string[] }[]
  variants: SeedVariant[]
  category_ids: string[]
  metadata: Record<string, unknown>
}

interface SeedData {
  generated: string
  summary: Record<string, number>
  currency_code: string
  categories: SeedCategory[]
  products: SeedProduct[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function seed({ container }: { container: MedusaContainer }) {
  console.log("\n═══════════════════════════════════════════════════════════════")
  console.log("  TSE Seed Script")
  console.log("═══════════════════════════════════════════════════════════════\n")

  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`Seed file not found: ${SEED_FILE}\nRun: node migration/build-seed.js`)
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"))
  console.log(`  Seed file:  ${SEED_FILE}`)
  console.log(`  Generated:  ${seedData.generated}`)
  console.log(`  Products:   ${seedData.summary.products}`)
  console.log(`  Variants:   ${seedData.summary.variants}`)
  console.log(`  Categories: ${seedData.summary.categories}\n`)

  // ── Step 1: Ensure store supports ZAR ─────────────────────────────────────
  // In Medusa v2, currencies are managed as separate StoreCurrency entities.
  // We upsert via createStoreCurrencies which is idempotent on currency_code + store_id.
  console.log("── [1/4] Store currency setup ──────────────────────────────────────────")
  const storeModule = container.resolve(Modules.STORE)
  const [store] = await storeModule.listStores(
    {},
    { select: ["id", "name", "default_currency_code"] }
  )

  if (!store) {
    throw new Error("No store found. Run `medusa db:migrate` first.")
  }

  try {
    const existingCurrencies = await (storeModule as any).listStoreCurrencies(
      { store_id: store.id },
      { select: ["id", "currency_code"] }
    )
    const hasZar = existingCurrencies.some((c: any) => c.currency_code === "zar")

    if (!hasZar) {
      await (storeModule as any).createStoreCurrencies([
        { store_id: store.id, currency_code: "zar", is_default: true },
      ])
      console.log("  ✓ ZAR added as store currency")
    } else {
      console.log("  ✓ ZAR already supported")
    }
  } catch {
    // Older Medusa v2 builds expose currencies differently — skip and continue.
    // Configure ZAR manually in the admin: Settings → Store → Currencies.
    console.log("  ⚠  Could not auto-configure ZAR — add it in admin Settings → Store → Currencies")
  }

  // ── Step 1b: Ensure a ZAR region exists ───────────────────────────────────
  const regionModule = container.resolve(Modules.REGION)
  const existingRegions = await regionModule.listRegions({}, { select: ["id", "name"] })
  if (existingRegions.length === 0) {
    await regionModule.createRegions([{
      name: "South Africa",
      currency_code: "zar",
      countries: ["za"],
    }])
    console.log("  ✓ South Africa (ZAR) region created")
  } else {
    console.log(`  ✓ Region already exists: "${existingRegions[0]!.name}"`)
  }

  // ── Step 2: Get default sales channel ─────────────────────────────────────
  console.log("\n── [2/4] Sales channel ─────────────────────────────────────────────────")
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const [defaultSalesChannel] = await salesChannelModule.listSalesChannels()

  if (!defaultSalesChannel) {
    throw new Error("No sales channel found. Run `medusa migrations run` first.")
  }
  console.log(`  ✓ Using sales channel: "${defaultSalesChannel.name}" (${defaultSalesChannel.id})`)

  // ── Step 3: Create product categories ─────────────────────────────────────
  console.log("\n── [3/4] Product categories ─────────────────────────────────────────────")
  const productModule = container.resolve(Modules.PRODUCT)

  const existingCats = await productModule.listProductCategories(
    {},
    { select: ["id", "handle"] }
  )
  const existingByHandle = new Map(existingCats.map((c) => [c.handle, c.id]))

  // Maps seed logical ID (e.g. "cat_inkjet_brother") → Medusa UUID
  const catIdMap = new Map<string, string>()

  // Parents first, then children
  const parents = seedData.categories.filter((c) => !c.parent_category_id)
  const children = seedData.categories.filter((c) => c.parent_category_id)

  for (const cat of [...parents, ...children]) {
    if (existingByHandle.has(cat.handle)) {
      const medusaId = existingByHandle.get(cat.handle)
      if (!medusaId) throw new Error(`Unexpected: handle ${cat.handle} not in map`)
      catIdMap.set(cat.id, medusaId)
      console.log(`  [skip]    ${cat.name} — already exists`)
      continue
    }

    const createdCats = await productModule.createProductCategories([
      {
        name: cat.name,
        handle: cat.handle,
        description: cat.description,
        is_active: cat.is_active,
        is_internal: cat.is_internal,
        parent_category_id: cat.parent_category_id
          ? catIdMap.get(cat.parent_category_id) ?? null
          : null,
      },
    ])
    const createdCat = createdCats[0]
    if (!createdCat) throw new Error(`Failed to create category: ${cat.name}`)
    catIdMap.set(cat.id, createdCat.id)
    console.log(`  [created] ${cat.name} (${cat.handle})`)
  }

  // ── Step 4: Create products in batches ─────────────────────────────────────
  console.log("\n── [4/4] Products ───────────────────────────────────────────────────────")

  const existingProducts = await productModule.listProducts(
    {},
    { select: ["id", "handle"] }
  )
  const existingHandles = new Set(existingProducts.map((p) => p.handle))

  // Also deduplicate by SKU — a previous partial seed may have left variants
  // under different handles, causing SKU uniqueness violations.
  const existingVariants = await productModule.listProductVariants(
    {},
    { select: ["id", "sku"] }
  )
  const existingSkus = new Set(
    existingVariants.map((v) => v.sku).filter(Boolean) as string[]
  )

  const toCreate = seedData.products.filter((p) => {
    if (existingHandles.has(p.handle)) return false
    // Skip if any variant SKU already exists in the DB
    return !p.variants.some((v: SeedVariant) => v.sku && existingSkus.has(v.sku))
  })
  const skippedProducts = seedData.products.length - toCreate.length

  console.log(`  Total:    ${seedData.products.length}`)
  console.log(`  Existing: ${skippedProducts} (skipped)`)
  console.log(`  To create: ${toCreate.length}`)
  console.log(`  Batch size: ${BATCH_SIZE}\n`)

  if (toCreate.length === 0) {
    console.log("  ✓ All products already exist — nothing to import")
  }

  let created = 0
  const errors: string[] = []

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE)

    const input = batch.map((p) => {
      // Medusa v2 requires at least one option on every product.
      // Simple products in seed-data.json have options: [] — normalise them here.
      const isSimple = p.options.length === 0
      const options = isSimple
        ? [{ title: "Default Option", values: ["Default Value"] }]
        : p.options
      const variants = p.variants.map((v: SeedVariant) => ({
        title: v.title,
        sku: v.sku,
        options: isSimple ? { "Default Option": "Default Value" } : v.options,
        prices: v.prices,
        inventory_quantity: v.inventory_quantity,
        manage_inventory: v.manage_inventory,
        allow_backorder: v.allow_backorder,
        metadata: v.metadata,
      }))
      return {
        title: p.title,
        handle: p.handle,
        description: p.description,
        status: p.status,
        thumbnail: p.thumbnail,
        images: p.images,
        options,
        variants,
        category_ids: p.category_ids
          .map((id: string) => catIdMap.get(id))
          .filter(Boolean) as string[],
        sales_channels: [{ id: defaultSalesChannel.id }],
        metadata: p.metadata,
      }
    })

    try {
      await createProductsWorkflow(container).run({ input: { products: input } })
      created += batch.length
    } catch (err: any) {
      const names = batch.map((p) => p.title).join(", ")
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (${names}): ${err.message}`)
      console.error(`\n  [error] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`)
    }

    const done = Math.min(i + BATCH_SIZE, toCreate.length)
    const pct = Math.round((done / toCreate.length) * 100)
    process.stdout.write(`\r  Progress: ${done}/${toCreate.length} (${pct}%)   `)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n\n═══════════════════════════════════════════════════════════════")
  console.log("  Seed complete")
  console.log("═══════════════════════════════════════════════════════════════")
  console.log(`  Categories: ${catIdMap.size} mapped`)
  console.log(`  Products created: ${created}`)
  console.log(`  Products skipped: ${skippedProducts}`)

  if (errors.length) {
    console.log(`\n  Errors (${errors.length}):`)
    errors.forEach((e) => console.log(`    - ${e}`))
    throw new Error(`Seed completed with ${errors.length} batch error(s). See above.`)
  }

  if ((seedData.summary.needs_pricing ?? 0) > 0) {
    console.log(
      `\n  ⚠  ${seedData.summary.needs_pricing} variant(s) have ZAR 0 price — check metadata.needs_pricing in the admin.`
    )
  }

  console.log("\n  Done. Visit http://localhost:9000/app to verify.\n")
}
