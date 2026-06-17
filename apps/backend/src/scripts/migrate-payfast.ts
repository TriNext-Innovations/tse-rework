/**
 * Idempotent migration for the PayFast pending-order table.
 *
 * At checkout we persist the cart payload keyed by the PayFast m_payment_id,
 * then turn it into a real Medusa order when the ITN confirms payment. Kept as
 * a raw pg table (same pattern as the compatibility tables) — it's transient
 * glue, not a domain model.
 */
import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

export default async function migratePayfast({ container }: { container: MedusaContainer }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS payfast_pending (
      m_payment_id text PRIMARY KEY,
      payload      jsonb       NOT NULL,
      order_id     text,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  console.log('[migrate-payfast] payfast_pending ready')
}
