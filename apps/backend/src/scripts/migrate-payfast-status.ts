/**
 * Idempotent migration for the PayFast payment-session status bridge table.
 *
 * PayFast confirms payment asynchronously via the ITN webhook, but Medusa's
 * cart-completion calls the provider's `authorizePayment` synchronously. The
 * session `data` written at `initiatePayment` is frozen at `status: 'pending'`,
 * so it can't carry the result. This table is the bridge: the (signature-
 * verified) ITN writes `session_id → 'complete'`, and `getPaymentStatus` reads
 * it so authorize reflects the real payment state.
 *
 * Kept as a raw pg table (same pattern as `payfast_pending` and the
 * compatibility tables) — transient glue, not a domain model.
 */
import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

export default async function migratePayfastStatus({ container }: { container: MedusaContainer }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS payfast_session_status (
      session_id text PRIMARY KEY,
      status     text        NOT NULL,
      amount     text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  console.log('[migrate-payfast-status] payfast_session_status ready')
}
