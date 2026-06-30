/**
 * ONE-TIME re-denomination: convert stored ZAR money from integer cents to
 * rands (e.g. 45000 → 450), so the whole stack reads true rands and Medusa
 * Admin stops showing 100× the real price.
 *
 * ⚠️ This divides by 100, so it is NOT naturally idempotent — it MUST run at
 * most once. It runs from the docker migrate entrypoint on every deploy, so it
 * is guarded by a marker row in `app_data_migration`; subsequent deploys no-op.
 *
 * Updates both `price.amount` (the cached numeric) and `price.raw_amount` (the
 * authoritative BigNumber `{value, precision}` — `value` is stored as a string).
 * Also removes the single sandbox test order so no stale cents-denominated
 * order is left behind (per the migration decision).
 */
import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

const MARKER = 'prices-to-rands'

export default async function migratePricesToRands({ container }: { container: MedusaContainer }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app_data_migration (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const { rows: applied } = await knex.raw(`SELECT 1 FROM app_data_migration WHERE name = ?`, [MARKER])
  if (applied.length) {
    console.log(`[migrate-prices-to-rands] already applied — skipping`)
    return
  }

  await knex.transaction(async (trx: any) => {
    // Re-price every ZAR price ÷100, keeping amount and raw_amount.value in sync.
    const { rowCount } = await trx.raw(
      `
      UPDATE price
      SET amount = amount / 100.0,
          raw_amount = CASE
            WHEN raw_amount ? 'value'
            THEN jsonb_set(raw_amount, '{value}', to_jsonb(((raw_amount->>'value')::numeric / 100)::text))
            ELSE raw_amount
          END
      WHERE currency_code = 'zar'
      `,
    )
    console.log(`[migrate-prices-to-rands] re-priced ${rowCount ?? '?'} ZAR prices ÷100`)
    await trx.raw(`INSERT INTO app_data_migration (name) VALUES (?)`, [MARKER])
  })

  // Remove the throwaway sandbox test order(s) created while debugging — they
  // hold cents-denominated totals that would now read 100× too high. Only test
  // data exists at this point (guarded one-time run). Best-effort: never let
  // order cleanup undo the (committed) price migration above.
  try {
    const orderModule: any = container.resolve(Modules.ORDER)
    const orders = await orderModule.listOrders({}, { select: ['id'] })
    if (orders.length) {
      await orderModule.deleteOrders(orders.map((o: any) => o.id))
      console.log(`[migrate-prices-to-rands] deleted ${orders.length} pre-migration test order(s)`)
    }
  } catch (err: any) {
    console.warn(`[migrate-prices-to-rands] test-order cleanup skipped: ${err?.message ?? err}`)
  }

  console.log('[migrate-prices-to-rands] done')
}
