/**
 * One-shot migration — creates the WooCommerce order audit-archive table.
 *
 * This is a read-only, append/upsert archive of legacy WooCommerce orders so we
 * keep an auditable record without polluting Medusa's live order tables. The
 * full original Woo order is preserved verbatim in `payload` (jsonb); the
 * top-level columns are denormalised copies purely for indexing/search.
 *
 * Run once before the first import:
 *   pnpm --filter @tse/backend migrate:woo
 *
 * Idempotent — safe to re-run.
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Client } from "pg"

export default async function migrateWooArchive(_: { container: MedusaContainer }) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  console.log("\n Creating WooCommerce order archive table...\n")

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS "woo_orders_archive" (
        "woo_id"         BIGINT        NOT NULL,
        "order_number"   VARCHAR(64),
        "status"         VARCHAR(32),
        "currency"       VARCHAR(8),
        "total"          NUMERIC(14,2),
        "customer_email" VARCHAR(320),
        "date_created"   TIMESTAMPTZ,
        "date_paid"      TIMESTAMPTZ,
        "payload"        JSONB         NOT NULL,
        "imported_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "woo_orders_archive_pkey" PRIMARY KEY ("woo_id")
      )
    `)
    console.log("  ✓ woo_orders_archive")

    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_woo_orders_archive_email"
        ON "woo_orders_archive" (lower("customer_email"))
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_woo_orders_archive_status"
        ON "woo_orders_archive" ("status")
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_woo_orders_archive_date_created"
        ON "woo_orders_archive" ("date_created")
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_woo_orders_archive_order_number"
        ON "woo_orders_archive" ("order_number")
    `)

    console.log("\n  Archive table ready.\n")
  } finally {
    await db.end()
  }
}
