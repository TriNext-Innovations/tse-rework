import { describe, it, expect } from 'vitest'
import {
  B2B_MAX_PERCENT,
  B2B_MIN_THRESHOLD_RAND,
  B2B_TIERS,
  RAND_GROUP_SEPARATOR,
  b2bDiscountPercent,
  b2bTierFor,
  formatRand,
  nextB2BTier,
} from '@tse/types'

const NBSP = ' '

// These constants are what the Medusa promotions are built from
// (apps/backend/src/scripts/setup-b2b-pricing.ts) AND what the storefront
// advertises. If they drift, the shop either lies to customers or gives away
// margin — so pin the actual numbers, not just the shape.
describe('B2B threshold bands', () => {
  it('matches the bands configured in Medusa', () => {
    expect(B2B_TIERS).toEqual([
      { code: 'B2B-TIER-10PCT', percent: 10, minRand: 10_000, maxRand: 25_000 },
      { code: 'B2B-TIER-15PCT', percent: 15, minRand: 25_000, maxRand: null },
    ])
    expect(B2B_MIN_THRESHOLD_RAND).toBe(10_000)
    expect(B2B_MAX_PERCENT).toBe(15)
  })

  it('gives no discount below the first threshold', () => {
    expect(b2bDiscountPercent(0)).toBe(0)
    expect(b2bDiscountPercent(9_999)).toBe(0)
    expect(b2bTierFor(9_999)).toBeNull()
  })

  it('applies 10% across its band and 15% from R25 000 up', () => {
    expect(b2bDiscountPercent(10_000)).toBe(10)
    expect(b2bDiscountPercent(24_999)).toBe(10)
    expect(b2bDiscountPercent(25_000)).toBe(15)
    expect(b2bDiscountPercent(1_000_000)).toBe(15)
  })

  // The bands are mutually exclusive on purpose — overlapping ranges would let
  // both automatic promotions match and stack.
  it('never matches more than one band', () => {
    for (const goods of [0, 9_999, 10_000, 24_999, 25_000, 99_999]) {
      const matches = B2B_TIERS.filter(
        (t) => goods >= t.minRand && (t.maxRand === null || goods < t.maxRand),
      )
      expect(matches.length).toBeLessThanOrEqual(1)
    }
  })

  it('reports the shortfall to the next band, and nothing at the top', () => {
    expect(nextB2BTier(8_600)).toEqual({ tier: B2B_TIERS[0], shortfallRand: 1_400 })
    expect(nextB2BTier(10_000)).toEqual({ tier: B2B_TIERS[1], shortfallRand: 15_000 })
    expect(nextB2BTier(25_000)).toBeNull()
    expect(nextB2BTier(80_000)).toBeNull()
  })

  it('formats rands deterministically, with a non-breaking group separator', () => {
    expect(RAND_GROUP_SEPARATOR).toBe(NBSP)
    expect(formatRand(10_000)).toBe(`R10${NBSP}000`)
    expect(formatRand(24_999)).toBe(`R24${NBSP}999`)
    expect(formatRand(1_234_567)).toBe(`R1${NBSP}234${NBSP}567`)
    expect(formatRand(500)).toBe('R500')
    // No ordinary space — an amount must never wrap mid-number.
    expect(formatRand(25_000)).not.toContain(' ')
  })
})
