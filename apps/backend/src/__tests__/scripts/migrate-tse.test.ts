import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { seedHashIfChanged, recordSeedHash } from '../../scripts/migrate-tse'

// An in-memory stand-in for the one table the gate reads and writes.
function fakeKnex() {
  const state = new Map<string, string>()
  return {
    state,
    raw: vi.fn(async (sql: string, bindings: unknown[] = []) => {
      if (sql.includes('SELECT value')) {
        const v = state.get(bindings[0] as string)
        return { rows: v ? [{ value: v }] : [] }
      }
      if (sql.includes('INSERT INTO tse_migration_state')) state.set(bindings[0] as string, bindings[1] as string)
      return { rows: [] }
    }),
  }
}

describe('migrate-tse seed gate (#490)', () => {
  let dir: string
  let csv: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-tse-'))
    csv = path.join(dir, 'client-review.csv')
    fs.writeFileSync(csv, 'sku,model\nHP-CE285A,LaserJet P1102\n')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('seeds on the first run', async () => {
    const knex = fakeKnex()
    expect(await seedHashIfChanged(knex, csv, false)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('skips the seed once the same CSV has been recorded', async () => {
    const knex = fakeKnex()
    const hash = (await seedHashIfChanged(knex, csv, false))!
    await recordSeedHash(knex, hash)
    expect(await seedHashIfChanged(knex, csv, false)).toBeNull()
  })

  it('seeds again when the CSV changes', async () => {
    const knex = fakeKnex()
    await recordSeedHash(knex, (await seedHashIfChanged(knex, csv, false))!)
    fs.appendFileSync(csv, 'HP-Q2612A,LaserJet 1010\n')
    expect(await seedHashIfChanged(knex, csv, false)).not.toBeNull()
  })

  it('seeds when forced, even if unchanged', async () => {
    const knex = fakeKnex()
    await recordSeedHash(knex, (await seedHashIfChanged(knex, csv, false))!)
    expect(await seedHashIfChanged(knex, csv, true)).not.toBeNull()
  })
})
