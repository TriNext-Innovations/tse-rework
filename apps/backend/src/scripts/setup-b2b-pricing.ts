/**
 * B2B per-order threshold discounts (#272). One automatic promotion per band in
 * `B2B_TIERS`, restricted to the `B2B_GROUP_NAME` customer group, over MUTUALLY
 * EXCLUSIVE goods-total ranges so only one ever applies (auto-upgrade, no
 * stacking). The bands themselves live in `@tse/types` — the storefront's B2B
 * page, cart nudge and the admin widget read the same constants, so this script
 * and the copy customers see can't drift apart.
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
 * Prereq: run setup-b2b-groups.ts first (creates the group).
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-b2b-pricing.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules, PromotionRuleOperator } from '@medusajs/framework/utils'
import { createPromotionsWorkflow } from '@medusajs/medusa/core-flows'
import { B2B_GROUP_NAME, B2B_TIERS, b2bTierLabel } from '@tse/types'

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
  for (const tier of B2B_TIERS) {
    const existing = await promotionService.listPromotions({ code: [tier.code] }).catch(() => [])
    if (existing.length > 0) {
      console.log(`[setup-b2b-pricing] ${tier.code} already exists — skipping`)
      continue
    }

    const rules: Array<{ attribute: string; operator: PromotionRuleOperator; values: string[] }> = [
      { attribute: 'customer.groups.id', operator: PromotionRuleOperator.IN, values: [group.id] },
      {
        attribute: 'original_item_total',
        operator: PromotionRuleOperator.GTE,
        values: [String(tier.minRand)],
      },
    ]
    if (tier.maxRand !== null) {
      rules.push({
        attribute: 'original_item_total',
        operator: PromotionRuleOperator.LT,
        values: [String(tier.maxRand)],
      })
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
              value: tier.percent,
              currency_code: 'zar',
            },
            rules,
          },
        ],
      },
    })
    console.log(`[setup-b2b-pricing] created automatic promotion ${tier.code} — ${b2bTierLabel(tier)}`)
  }

  console.log('[setup-b2b-pricing] done.')
}
