/**
 * B2B per-order threshold discounts (#272). Two automatic promotions,
 * restricted to the "B2B Approved" customer group, over MUTUALLY EXCLUSIVE
 * goods-total ranges so only one ever applies (auto-upgrade, no stacking):
 *
 *   goods incl VAT, excl shipping     discount
 *   ────────────────────────────────  ────────
 *   < R10,000                         none
 *   R10,000 – R24,999                 10%
 *   ≥ R25,000                         15%
 *
 * Threshold basis = `original_item_total`: the cart's goods total incl VAT,
 * excl shipping, BEFORE promotion discounts. Using the pre-discount total is
 * deliberate — gating on the post-discount `item_total` would let a 10% cut
 * push the cart back under R10k and flap the promotion on/off. Non-members
 * never match (the customer-group rule fails), so they get no discount.
 *
 * Replaces the retired flat Reseller (15%) / Wholesale (25%) price lists.
 * Idempotent — promotions are only created if their code doesn't exist.
 *
 * Prereq: run setup-b2b-groups.ts first (creates "B2B Approved").
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-b2b-pricing.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules, PromotionRuleOperator } from '@medusajs/framework/utils'
import { createPromotionsWorkflow } from '@medusajs/medusa/core-flows'
import { B2B_GROUP_NAME } from './setup-b2b-groups'

const TIER_10_MIN_RAND = 10_000
const TIER_15_MIN_RAND = 25_000

export const B2B_PROMO_CODES = {
  tier10: 'B2B-TIER-10PCT',
  tier15: 'B2B-TIER-15PCT',
} as const

export default async function setupB2BPricing({ container }: { container: MedusaContainer }) {
  const customerService = container.resolve(Modules.CUSTOMER) as any
  const promotionService = container.resolve(Modules.PROMOTION) as any

  const [group] = await customerService.listCustomerGroups({ name: [B2B_GROUP_NAME] }).catch(() => [])
  if (!group) {
    throw new Error(
      `[setup-b2b-pricing] customer group "${B2B_GROUP_NAME}" not found — run setup-b2b-groups.ts first`,
    )
  }

  // customer.groups.id + original_item_total are both resolved from the cart
  // compute context at promotion-evaluation time (Medusa 2.17 evaluates any
  // rule attribute path against the cart, even ones the Admin UI can't build).
  const tiers = [
    {
      code: B2B_PROMO_CODES.tier10,
      value: 10,
      label: `10% (R${TIER_10_MIN_RAND.toLocaleString()}–R${(TIER_15_MIN_RAND - 1).toLocaleString()})`,
      rules: [
        { attribute: 'customer.groups.id', operator: PromotionRuleOperator.IN, values: [group.id] },
        { attribute: 'original_item_total', operator: PromotionRuleOperator.GTE, values: [String(TIER_10_MIN_RAND)] },
        { attribute: 'original_item_total', operator: PromotionRuleOperator.LT, values: [String(TIER_15_MIN_RAND)] },
      ],
    },
    {
      code: B2B_PROMO_CODES.tier15,
      value: 15,
      label: `15% (≥ R${TIER_15_MIN_RAND.toLocaleString()})`,
      rules: [
        { attribute: 'customer.groups.id', operator: PromotionRuleOperator.IN, values: [group.id] },
        { attribute: 'original_item_total', operator: PromotionRuleOperator.GTE, values: [String(TIER_15_MIN_RAND)] },
      ],
    },
  ]

  for (const tier of tiers) {
    const existing = await promotionService.listPromotions({ code: [tier.code] }).catch(() => [])
    if (existing.length > 0) {
      console.log(`[setup-b2b-pricing] ${tier.code} already exists — skipping`)
      continue
    }

    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: tier.code,
            is_automatic: true,
            status: 'active',
            type: 'standard',
            application_method: {
              type: 'percentage',
              target_type: 'order',
              allocation: 'across',
              value: tier.value,
              currency_code: 'zar',
            },
            rules: tier.rules,
          },
        ],
      },
    })
    console.log(`[setup-b2b-pricing] created automatic promotion ${tier.code} — ${tier.label}`)
  }

  console.log('[setup-b2b-pricing] done.')
}
