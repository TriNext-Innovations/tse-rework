/**
 * Imports legacy WooCommerce orders into the `woo_orders_archive` table via the
 * WooCommerce REST API (GET /wp-json/wc/v3/orders).
 *
 * Audit-only: we store each order's full original JSON verbatim and never push
 * it through Medusa's order workflows — so no emails, stock changes or total
 * re-computation. Woo's own totals/tax/timestamps are preserved exactly.
 *
 * Idempotent + resumable: orders upsert on the Woo order id, so re-running
 * (e.g. after a crash, or to pull newly-created orders) is always safe.
 *
 * Run after migrate:woo:
 *   pnpm --filter @tse/backend import:woo
 *
 * Required env:
 *   WOO_API_URL          e.g. https://oldsite.co.za   (no trailing /wp-json)
 *   WOO_CONSUMER_KEY     ck_xxx
 *   WOO_CONSUMER_SECRET  cs_xxx
 * Optional env:
 *   WOO_IMPORT_AFTER     ISO date — only import orders created on/after this
 *   WOO_IMPORT_STATUS    Woo status filter, e.g. "completed" (default: any)
 *   WOO_PAGE_SIZE        orders per page (default 100, Woo max 100)
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { Client } from "pg"

type WooOrder = {
  id: number
  number?: string
  status?: string
  currency?: string
  total?: string
  date_created_gmt?: string | null
  date_paid_gmt?: string | null
  billing?: { email?: string }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} environment variable not set`)
  return v
}

export default async function importWooOrders(_: { container: MedusaContainer }) {
  const databaseUrl = requireEnv("DATABASE_URL")
  const apiBase = requireEnv("WOO_API_URL").replace(/\/+$/, "")
  const consumerKey = requireEnv("WOO_CONSUMER_KEY")
  const consumerSecret = requireEnv("WOO_CONSUMER_SECRET")

  const pageSize = Math.min(Number(process.env.WOO_PAGE_SIZE ?? 100) || 100, 100)
  const after = process.env.WOO_IMPORT_AFTER
  const status = process.env.WOO_IMPORT_STATUS

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")

  const db = new Client({ connectionString: databaseUrl })
  await db.connect()

  console.log("\n Importing WooCommerce orders → woo_orders_archive\n")

  let page = 1
  let totalPages = 1
  let imported = 0

  try {
    do {
      const url = new URL(`${apiBase}/wp-json/wc/v3/orders`)
      url.searchParams.set("per_page", String(pageSize))
      url.searchParams.set("page", String(page))
      url.searchParams.set("orderby", "id")
      url.searchParams.set("order", "asc")
      if (after) url.searchParams.set("after", after)
      if (status) url.searchParams.set("status", status)

      const res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(
          `Woo API ${res.status} ${res.statusText} on page ${page}: ${body.slice(0, 500)}`
        )
      }

      // Woo reports the total page count in a response header.
      totalPages = Number(res.headers.get("x-wp-totalpages") ?? totalPages) || totalPages

      const orders = (await res.json()) as WooOrder[]
      if (!Array.isArray(orders) || orders.length === 0) break

      await db.query("BEGIN")
      try {
        for (const o of orders) {
          await db.query(
            `
            INSERT INTO "woo_orders_archive"
              (woo_id, order_number, status, currency, total,
               customer_email, date_created, date_paid, payload, imported_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
            ON CONFLICT (woo_id) DO UPDATE SET
              order_number   = EXCLUDED.order_number,
              status         = EXCLUDED.status,
              currency       = EXCLUDED.currency,
              total          = EXCLUDED.total,
              customer_email = EXCLUDED.customer_email,
              date_created   = EXCLUDED.date_created,
              date_paid      = EXCLUDED.date_paid,
              payload        = EXCLUDED.payload,
              imported_at    = now()
            `,
            [
              o.id,
              o.number ?? String(o.id),
              o.status ?? null,
              o.currency ?? null,
              o.total ? Number(o.total) : null,
              o.billing?.email ?? null,
              o.date_created_gmt ? `${o.date_created_gmt}Z` : null,
              o.date_paid_gmt ? `${o.date_paid_gmt}Z` : null,
              JSON.stringify(o),
            ]
          )
          imported++
        }
        await db.query("COMMIT")
      } catch (e) {
        await db.query("ROLLBACK")
        throw e
      }

      console.log(`  page ${page}/${totalPages} — ${imported} orders archived so far`)
      page++
    } while (page <= totalPages)

    console.log(`\n  Done. ${imported} WooCommerce orders archived.\n`)
  } finally {
    await db.end()
  }
}
