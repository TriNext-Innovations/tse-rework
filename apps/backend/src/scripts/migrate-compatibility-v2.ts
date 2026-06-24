/**
 * Compatibility schema v2 migration — adds search_name + trigram index.
 * Run once, then re-seed with --reset to populate search_name for all rows.
 *
 * Usage:
 *   pnpm --filter @tse/backend migrate:compat:v2
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Client } from "pg"

export default async function migrateCompatibilityV2(_: { container: MedusaContainer }) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  console.log("\n Running compatibility v2 migration...\n")

  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
    console.log("  ✓ pg_trgm extension")

    await db.query(`
      ALTER TABLE printer_model
      ADD COLUMN IF NOT EXISTS search_name VARCHAR(500)
    `)
    console.log("  ✓ printer_model.search_name column")

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_printer_model_search_name
        ON printer_model USING gin(search_name gin_trgm_ops)
    `)
    console.log("  ✓ GIN trigram index on search_name")

    console.log("\n  Done. Now reseed: pnpm --filter @tse/backend seed:compat:reset\n")
  } finally {
    await db.end()
  }
}
