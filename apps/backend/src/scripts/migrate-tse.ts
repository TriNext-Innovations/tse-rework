/**
 * Every TSE-specific migration step in one `medusa exec`, run by
 * docker-migrate-entrypoint.sh after `medusa db:migrate`.
 *
 * Each step used to be its own `medusa exec`, and each one boots the full app
 * (~20s), so a run with nothing to do took ~2.5 min (#490). One boot now
 * covers them all.
 *
 * - The table scripts are idempotent (CREATE ... IF NOT EXISTS) and run every
 *   time; they cost milliseconds once the app is up.
 * - The compatibility seed only runs when client-review.csv changes. Its hash
 *   is recorded in `tse_migration_state`. Set SEED_COMPAT=force to run it
 *   anyway.
 * - migrate-prices-to-rands.ts is not called: it is a finished one-time
 *   migration (it skipped as "already applied" on 29 Sep 2026). It stays in
 *   the repo for history.
 *
 * Usage:
 *   pnpm --filter @tse/backend migrate:tse
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { createHash } from 'crypto'
import * as fs from 'fs'
import migrateCompatibility from './migrate-compatibility'
import migrateCompatibilityV2 from './migrate-compatibility-v2'
import migratePayfast from './migrate-payfast'
import migratePayfastStatus from './migrate-payfast-status'
import seedCompatibility, { CSV_PATH } from './seed-compatibility'

const SEED_KEY = 'seed-compatibility:csv-sha256'

type Knex = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: any[] }> }

export async function seedHashIfChanged(
  knex: Knex,
  csvPath: string,
  force: boolean,
): Promise<string | null> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tse_migration_state (
      key        text PRIMARY KEY,
      value      text        NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const hash = createHash('sha256').update(fs.readFileSync(csvPath)).digest('hex')
  if (force) return hash
  const { rows } = await knex.raw(`SELECT value FROM tse_migration_state WHERE key = ?`, [SEED_KEY])
  return rows[0]?.value === hash ? null : hash
}

export async function recordSeedHash(knex: Knex, hash: string): Promise<void> {
  await knex.raw(
    `INSERT INTO tse_migration_state (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SEED_KEY, hash],
  )
}

export default async function migrateTse({ container }: { container: MedusaContainer }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as Knex

  console.log('[migrate-tse] compatibility tables')
  await migrateCompatibility({ container })
  console.log('[migrate-tse] compatibility search_name + trigram index')
  await migrateCompatibilityV2({ container })
  console.log('[migrate-tse] PayFast pending-order table')
  await migratePayfast({ container })
  console.log('[migrate-tse] PayFast session-status table')
  await migratePayfastStatus({ container })

  const hash = await seedHashIfChanged(knex, CSV_PATH, process.env.SEED_COMPAT === 'force')
  if (hash) {
    console.log('[migrate-tse] client-review.csv changed: seeding compatibility data')
    await seedCompatibility({ container })
    await recordSeedHash(knex, hash)
  } else {
    console.log('[migrate-tse] client-review.csv unchanged: compatibility seed skipped')
  }
}
