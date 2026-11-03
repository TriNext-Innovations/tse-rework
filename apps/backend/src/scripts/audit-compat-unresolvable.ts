/**
 * Report compat rows the printer finder silently drops.
 *
 * `cartridge_compat` records a physical fact — this cartridge fits this printer
 * — and keeps recording it after the product is drafted or never existed. The
 * finder only shows rows that resolve to a *published* product
 * (store/compatibility/route.ts), so anything else vanishes with no error and
 * no log a reader would notice. That has bitten before: 40 dead handles across
 * 418 link positions.
 *
 * Two shapes turn up, and they need opposite fixes:
 *   drafted  — the product exists but was delisted. delist-products.cjs sets
 *              status='draft' and never touches cartridge_compat, so the row
 *              outlives the listing. Either republish, or delete the row.
 *   orphaned — no variant carries that SKU at all. Either create the product,
 *              or the compat data names something we never stocked.
 *
 * Read-only. Writes nothing.
 *
 * Usage:
 *   pnpm --filter @tse/backend audit:compat
 *   pnpm --filter @tse/backend audit:compat -- --csv > unresolvable.csv
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Client } from "pg"

type Row = {
  sku: string
  status: string | null
  title: string | null
  handle: string | null
  model_count: number
}

export default async function auditCompatUnresolvable(_: { container: MedusaContainer }) {
  const asCsv = process.argv.includes("--csv")
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  try {
    // One row per SKU, with how many printer models it would have appeared on —
    // that is the blast radius, and it is what makes a line worth fixing first.
    const { rows } = await db.query<Row>(`
      SELECT cc.sku,
             p.status                              AS status,
             p.title                               AS title,
             p.handle                              AS handle,
             COUNT(DISTINCT cc.printer_model_id)::int AS model_count
      FROM   cartridge_compat cc
      LEFT JOIN product_variant pv
             ON pv.sku = cc.sku AND pv.deleted_at IS NULL
      LEFT JOIN product p
             ON p.id = pv.product_id AND p.deleted_at IS NULL
      WHERE  cc.deleted_at IS NULL
        AND  (p.id IS NULL OR p.status <> 'published')
      GROUP BY cc.sku, p.status, p.title, p.handle
      ORDER BY model_count DESC, cc.sku
    `)

    const drafted  = rows.filter((r) => r.status !== null)
    const orphaned = rows.filter((r) => r.status === null)
    const positions = rows.reduce((n, r) => n + r.model_count, 0)

    if (asCsv) {
      console.log("sku,kind,status,title,handle,model_count")
      for (const r of rows) {
        const kind = r.status === null ? "orphaned" : "drafted"
        const title = (r.title ?? "").replace(/"/g, '""')
        console.log(`"${r.sku}",${kind},${r.status ?? ""},"${title}",${r.handle ?? ""},${r.model_count}`)
      }
      return
    }

    console.log("\n═══════════════════════════════════════════════════════════════")
    console.log("  Compat rows the printer finder drops")
    console.log("═══════════════════════════════════════════════════════════════\n")

    if (rows.length === 0) {
      console.log("  Nothing unresolvable — every compat row reaches a published product.\n")
      return
    }

    console.log(`  ${rows.length} SKU(s) across ${positions} printer-page position(s)`)
    console.log(`    drafted  (product delisted, compat row left behind): ${drafted.length}`)
    console.log(`    orphaned (no variant carries this SKU):              ${orphaned.length}\n`)

    const table = (label: string, list: Row[]) => {
      if (list.length === 0) return
      console.log(`  ── ${label} ${"─".repeat(Math.max(0, 54 - label.length))}`)
      for (const r of list.slice(0, 40)) {
        const models = `${r.model_count} model${r.model_count === 1 ? "" : "s"}`
        console.log(`    ${r.sku.padEnd(24)} ${models.padEnd(12)} ${r.title ?? "(no product)"}`)
      }
      if (list.length > 40) console.log(`    … and ${list.length - 40} more — use --csv for the full list`)
      console.log("")
    }

    table("Drafted — republish, or delete the compat row", drafted)
    table("Orphaned — create the product, or delete the compat row", orphaned)

    console.log("  Read-only. Nothing was changed.\n")
  } finally {
    await db.end()
  }
}
