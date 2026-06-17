/**
 * One-shot migration script — creates the compatibility tables.
 * Run once before seed:compat.
 *
 * Usage:
 *   pnpm --filter @tse/backend migrate:compat
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Client } from "pg"

export default async function migrateCompatibility(_: { container: MedusaContainer }) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable not set")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  console.log("\n Creating compatibility tables...\n")

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS "printer_brand" (
        "id"         VARCHAR(255)  NOT NULL,
        "name"       VARCHAR(255)  NOT NULL,
        "slug"       VARCHAR(255)  NOT NULL,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ   NULL,
        CONSTRAINT "printer_brand_pkey"        PRIMARY KEY ("id"),
        CONSTRAINT "printer_brand_name_unique" UNIQUE ("name"),
        CONSTRAINT "printer_brand_slug_unique" UNIQUE ("slug")
      )
    `)
    console.log("  ✓ printer_brand")

    await db.query(`
      CREATE TABLE IF NOT EXISTS "printer_model" (
        "id"         VARCHAR(255)  NOT NULL,
        "name"       VARCHAR(255)  NOT NULL,
        "slug"       VARCHAR(255)  NOT NULL,
        "validated"  BOOLEAN       NOT NULL DEFAULT false,
        "brand_id"   VARCHAR(255)  NOT NULL,
        "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ   NULL,
        CONSTRAINT "printer_model_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "printer_model_brand_id_fkey"
          FOREIGN KEY ("brand_id") REFERENCES "printer_brand"("id") ON DELETE CASCADE,
        CONSTRAINT "printer_model_brand_slug_unique" UNIQUE ("brand_id", "slug")
      )
    `)
    console.log("  ✓ printer_model")

    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_printer_model_brand_id"
        ON "printer_model" ("brand_id")
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_printer_model_name"
        ON "printer_model" USING gin(to_tsvector('simple', "name"))
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS "cartridge_compat" (
        "id"               VARCHAR(255) NOT NULL,
        "sku"              VARCHAR(255) NOT NULL,
        "source"           VARCHAR(50)  NOT NULL DEFAULT 'parsed',
        "printer_model_id" VARCHAR(255) NOT NULL,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ  NULL,
        CONSTRAINT "cartridge_compat_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "cartridge_compat_model_sku_unique" UNIQUE ("printer_model_id", "sku"),
        CONSTRAINT "cartridge_compat_printer_model_id_fkey"
          FOREIGN KEY ("printer_model_id") REFERENCES "printer_model"("id") ON DELETE CASCADE
      )
    `)
    console.log("  ✓ cartridge_compat")

    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_cartridge_compat_sku"
        ON "cartridge_compat" ("sku")
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS "idx_cartridge_compat_printer_model_id"
        ON "cartridge_compat" ("printer_model_id")
    `)

    console.log("\n  Tables created successfully.\n")
  } finally {
    await db.end()
  }
}
