/**
 * Delist products the client marked "Haal af asb" in the compat-gaps sheet.
 *
 * Standalone node script (prod medusa image has no pnpm/medusa CLI).
 * Usage (inside container):  node /tmp/delist-products.cjs [--dry-run]
 * Reads /tmp/compat-gaps-delist.csv  (name,skus)
 *
 * What it does per SKU:
 *   1. sku -> product_variant -> product
 *   2. products where ALL variant SKUs are on the delist list -> status='draft'
 *      (products with extra live variants are reported, NOT touched)
 *   3. drafted product ids are removed from the Meilisearch 'products' index
 *      (bulk-index only indexes status='published', so this keeps search honest)
 *
 * Soft delist by design: no deletes, order history intact. Reverse with
 *   UPDATE product SET status='published' WHERE id = ANY('{...}');
 */
const fs = require("fs")
const path = require("path")

const PG_CANDIDATES = [
  path.resolve(process.cwd(), "node_modules/pg"),
  "/app/node_modules/pg",
  ...(fs.existsSync("/app/node_modules/.pnpm")
    ? fs.readdirSync("/app/node_modules/.pnpm")
        .filter((d) => /^pg@/.test(d))
        .map((d) => `/app/node_modules/.pnpm/${d}/node_modules/pg`)
    : []),
]
let Client
for (const p of PG_CANDIDATES) {
  try { Client = require(p).Client; break } catch {}
}
if (!Client) throw new Error("pg module not found in any candidate path")

const CSV_PATH = "/tmp/compat-gaps-delist.csv"
const DRY = process.argv.includes("--dry-run")

async function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`)
  const lines = fs.readFileSync(CSV_PATH, "utf-8").split("\n").filter(Boolean).slice(1)
  // name,skus — the sheet has one SKU per delist row, but split on '/' to be safe
  const delistSkus = new Set(
    lines.flatMap((l) => (l.split(",")[1] ?? "").split("/").map((s) => s.trim().replace(/\r$/, ""))).filter(Boolean)
  )
  console.log(`\n  Delist run${DRY ? " (DRY RUN)" : ""} — ${delistSkus.size} SKUs on the list`)

  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    // sku -> variant -> product
    const { rows: variants } = await db.query(
      `SELECT pv.sku, pv.product_id, p.title, p.status
       FROM   product_variant pv
       JOIN   product p ON p.id = pv.product_id AND p.deleted_at IS NULL
       WHERE  pv.deleted_at IS NULL AND pv.sku = ANY($1)`,
      [[...delistSkus]]
    )
    const foundSkus = new Set(variants.map((v) => v.sku))
    const missing = [...delistSkus].filter((s) => !foundSkus.has(s))

    // full variant sets of every matched product
    const productIds = [...new Set(variants.map((v) => v.product_id))]
    const { rows: allVariants } = await db.query(
      `SELECT product_id, sku FROM product_variant
       WHERE deleted_at IS NULL AND product_id = ANY($1)`,
      [productIds]
    )
    const byProduct = new Map()
    for (const v of allVariants) {
      if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, [])
      byProduct.get(v.product_id).push(v.sku)
    }
    const titleById = new Map(variants.map((v) => [v.product_id, v.title]))
    const statusById = new Map(variants.map((v) => [v.product_id, v.status]))

    const toDraft = []
    const partial = []
    for (const pid of productIds) {
      const skus = byProduct.get(pid) ?? []
      if (skus.every((s) => delistSkus.has(s))) toDraft.push(pid)
      else partial.push({ pid, keep: skus.filter((s) => !delistSkus.has(s)) })
    }

    console.log(`  Products fully on the list -> draft: ${toDraft.length}`)
    for (const pid of toDraft) {
      console.log(`    - ${titleById.get(pid)} [${(byProduct.get(pid) ?? []).join(", ")}] (was ${statusById.get(pid)})`)
    }
    if (partial.length) {
      console.log(`  ⚠ Products with live variants NOT on the list — left untouched: ${partial.length}`)
      for (const { pid, keep } of partial) console.log(`    - ${titleById.get(pid)} keeps [${keep.join(", ")}]`)
    }
    if (missing.length) {
      console.log(`  ⚠ SKUs with no matching product variant (${missing.length}): ${missing.join(", ")}`)
    }

    if (!DRY && toDraft.length) {
      const { rowCount } = await db.query(
        `UPDATE product SET status='draft', updated_at=now()
         WHERE id = ANY($1) AND status <> 'draft'`,
        [toDraft]
      )
      console.log(`  DB: ${rowCount} products set to draft`)

      // Remove from Meilisearch so search stops surfacing them immediately.
      const host = process.env.MEILISEARCH_HOST ?? "http://localhost:7700"
      const key = process.env.MEILISEARCH_API_KEY ?? ""
      const resp = await fetch(`${host}/indexes/products/documents/delete-batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(toDraft),
      })
      console.log(`  Meili: delete-batch -> HTTP ${resp.status} ${JSON.stringify(await resp.json())}`)
    }
    console.log()
  } finally {
    await db.end()
  }
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1) })
