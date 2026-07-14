/**
 * Client pre-go-live shipping model (#273):
 *   - The Courier Guy = flat R150 per order (replaces live ShipLogic rate
 *     quoting at checkout — the provider stays `shiplogic` so waybills still
 *     auto-create on fulfillment; only the price becomes flat).
 *   - Free shipping when the cart's goods total (incl VAT, excl shipping) is
 *     R2,000 or more — an automatic 100%-off-shipping promotion.
 *
 * Idempotent — safe to re-run: options already flat at R150 are skipped, and
 * the promotion is only created if the code doesn't exist yet.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-shipping.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createPromotionsWorkflow, updateShippingOptionsWorkflow } from '@medusajs/medusa/core-flows'

const FLAT_RATE_RAND = 150
const FREE_SHIPPING_THRESHOLD_RAND = 2000
const PROMO_CODE = 'FREE-SHIPPING-OVER-R2000'

export default async function setupShipping({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ── 1. Courier Guy options → flat R150 ─────────────────────────────────────
  const { data: options } = await query.graph({
    entity: 'shipping_option',
    fields: ['id', 'name', 'price_type', 'provider_id', 'prices.amount', 'prices.currency_code'],
  })

  const shiplogicOptions = (options ?? []).filter((o: any) =>
    String(o.provider_id ?? '').includes('shiplogic'),
  )

  if (shiplogicOptions.length === 0) {
    console.warn(
      '[setup-shipping] no shiplogic shipping options found — create the Courier Guy option in Admin first, then re-run',
    )
  }
  if (shiplogicOptions.length > 1) {
    console.warn(
      `[setup-shipping] ${shiplogicOptions.length} shiplogic options found — all will be flat R${FLAT_RATE_RAND}. ` +
        'If only one Courier Guy option should show at checkout, disable the rest in Admin.',
    )
  }

  for (const option of shiplogicOptions) {
    const zarPrice = (option.prices ?? []).find((p: any) => p.currency_code === 'zar')
    const alreadyFlat = option.price_type === 'flat' && Number(zarPrice?.amount) === FLAT_RATE_RAND
    if (alreadyFlat) {
      console.log(`[setup-shipping] "${option.name}" already flat R${FLAT_RATE_RAND} — skipping`)
      continue
    }

    await updateShippingOptionsWorkflow(container).run({
      input: [
        {
          id: option.id,
          price_type: 'flat',
          prices: [{ currency_code: 'zar', amount: FLAT_RATE_RAND }],
        },
      ],
    })
    console.log(
      `[setup-shipping] "${option.name}" (${option.id}): ${option.price_type} → flat R${FLAT_RATE_RAND}`,
    )
  }

  // ── 2. Free shipping over R2,000 ───────────────────────────────────────────
  const promotionService = container.resolve(Modules.PROMOTION) as any
  const existing = await promotionService.listPromotions({ code: [PROMO_CODE] }).catch(() => [])

  if (existing.length > 0) {
    console.log(`[setup-shipping] promotion ${PROMO_CODE} already exists — skipping`)
  } else {
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: PROMO_CODE,
            is_automatic: true,
            status: 'active',
            type: 'standard',
            application_method: {
              type: 'percentage',
              target_type: 'shipping_methods',
              allocation: 'across',
              value: 100,
              currency_code: 'zar',
            },
            // item_total = cart goods total incl VAT, excl shipping — the
            // agreed threshold basis. Evaluated against the cart compute
            // context, so the discount appears/disappears as the cart crosses
            // the threshold.
            rules: [
              {
                attribute: 'item_total',
                operator: 'gte',
                values: [String(FREE_SHIPPING_THRESHOLD_RAND)],
              },
            ],
          },
        ],
      },
    })
    console.log(
      `[setup-shipping] created automatic promotion ${PROMO_CODE} (100% off shipping at goods ≥ R${FREE_SHIPPING_THRESHOLD_RAND})`,
    )
  }

  console.log('[setup-shipping] done.')
}
