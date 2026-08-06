/**
 * The single source of truth for TSE's B2B model, shared by the Medusa backend
 * (promotion setup, admin widget, sales emails) and the storefront (B2B page,
 * cart, checkout). Change a threshold here and every surface follows.
 *
 * The model (#272): approval is membership of ONE customer group, and the
 * discount is a per-ORDER threshold promotion — not a flat price list. The two
 * promotions cover mutually exclusive goods-total bands so only one ever
 * applies (auto-upgrade, no stacking).
 *
 * Threshold basis is the cart's goods total INCL VAT, EXCL shipping, taken
 * BEFORE any promotion discount (Medusa: `original_item_total`). Gating on the
 * post-discount total would let a 10% cut push the cart back under R10k and
 * flap the promotion on and off.
 *
 * Non-members never match the customer-group rule, so they get no discount —
 * which also means a cart that isn't associated with the signed-in customer
 * gets no discount. See `transferCartToCustomer` in the storefront.
 */

export const B2B_GROUP_NAME = 'B2B Approved'

export type B2BTier = {
  /** Medusa promotion code. */
  code: string
  /** Percent off the order total. */
  percent: number
  /** Inclusive lower bound of the goods total, in rand. */
  minRand: number
  /** Exclusive upper bound in rand, or null for the open-ended top band. */
  maxRand: number | null
}

export const B2B_TIERS: readonly B2BTier[] = [
  { code: 'B2B-TIER-10PCT', percent: 10, minRand: 10_000, maxRand: 25_000 },
  { code: 'B2B-TIER-15PCT', percent: 15, minRand: 25_000, maxRand: null },
] as const

/** Goods total at which the first discount kicks in. */
export const B2B_MIN_THRESHOLD_RAND = B2B_TIERS[0]!.minRand

/** The best discount available to an approved account. */
export const B2B_MAX_PERCENT = B2B_TIERS[B2B_TIERS.length - 1]!.percent

/**
 * Rand formatting for customer-facing copy: R10 000.
 *
 * Grouped by hand rather than via toLocaleString, which returns a different
 * group separator per ICU build (comma, U+00A0, U+202F) — this same string is
 * rendered in the storefront, in Medusa Admin and in emails, and they have to
 * agree. The separator is a NO-BREAK SPACE (U+00A0) so an amount never wraps
 * across a line break.
 */
export const RAND_GROUP_SEPARATOR = '\u00A0'

export function formatRand(rand: number): string {
  const digits = Math.abs(Math.round(rand)).toString()
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, RAND_GROUP_SEPARATOR)
  return `${rand < 0 ? '-' : ''}R${grouped}`
}

/** The band a goods total falls into, or null if it's below the first threshold. */
export function b2bTierFor(goodsTotalRand: number): B2BTier | null {
  return (
    B2B_TIERS.find(
      (t) => goodsTotalRand >= t.minRand && (t.maxRand === null || goodsTotalRand < t.maxRand),
    ) ?? null
  )
}

/** Percent an approved account gets on this goods total. 0 below the first band. */
export function b2bDiscountPercent(goodsTotalRand: number): number {
  return b2bTierFor(goodsTotalRand)?.percent ?? 0
}

/**
 * The next band up and what it would take to reach it — drives the cart nudge
 * ("R1 400 more and this order is 10% off"). Null once the top band is reached.
 */
export function nextB2BTier(
  goodsTotalRand: number,
): { tier: B2BTier; shortfallRand: number } | null {
  const next = B2B_TIERS.find((t) => goodsTotalRand < t.minRand)
  if (!next) return null
  return { tier: next, shortfallRand: next.minRand - goodsTotalRand }
}

/** Human label for a band, e.g. "10% on R10 000 – R24 999". */
export function b2bTierLabel(tier: B2BTier): string {
  return tier.maxRand === null
    ? `${tier.percent}% on ${formatRand(tier.minRand)} and up`
    : `${tier.percent}% on ${formatRand(tier.minRand)} – ${formatRand(tier.maxRand - 1)}`
}

// ─── Quote requests (api/store/b2b/quote) ────────────────────────────────────

export interface QuoteRequest {
  id: string
  customerId: string
  items: QuoteItem[]
  note: string | null
  status: 'pending' | 'quoted' | 'accepted' | 'rejected'
  createdAt: string
}

export interface QuoteItem {
  sku: string
  qty: number
  note?: string
}
