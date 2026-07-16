/**
 * Client pre-go-live shipping model (#273):
 *   - The Courier Guy = flat per-service-level rate (replaces live ShipLogic
 *     rate quoting at checkout — the provider stays `shiplogic` so waybills
 *     still auto-create on fulfillment; only the price becomes flat):
 *       Economy (3–4 days)   R150
 *       Overnight (next day) R200
 *     Pricing Overnight above Economy keeps the faster service a deliberate
 *     upsell; at one flat rate for both, every customer would rationally pick
 *     Overnight and we'd absorb the next-day cost on every order.
 *   - Free shipping when the cart's goods total (incl VAT, excl shipping) is
 *     R2,000 or more — an automatic 100%-off-shipping promotion.
 *   - Pudo locker-to-locker pickup (#274 MVP): flat-priced option on the
 *     manual fulfillment provider — staff coordinate the destination locker
 *     with the customer after the order. R60 is a placeholder pending the
 *     client's price confirmation; adjust in Admin (re-runs won't clobber it).
 *
 * Rates are keyed on the fulfillment-option id persisted in shipping_option
 * `data.id` (`shiplogic-eco` / `shiplogic-ovn`) — a stable key that survives
 * option renames, unlike the display name.
 *
 * Idempotent — safe to re-run: options already flat at their target rate are
 * skipped, and the promotion is only created if the code doesn't exist yet.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-shipping.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createPromotionsWorkflow,
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from '@medusajs/medusa/core-flows'

const FLAT_RATE_RAND_BY_OPTION: Record<string, number> = {
  'shiplogic-eco': 150,
  'shiplogic-ovn': 200,
}
const FREE_SHIPPING_THRESHOLD_RAND = 2000
const PROMO_CODE = 'FREE-SHIPPING-OVER-R2000'

const PUDO_NAME = 'Pudo Locker-to-Locker'
// Placeholder pending client price confirmation (#274) — Pudo L2L is typically
// ~R60. Staff can change it in Admin; existing options are never overwritten.
const PUDO_FLAT_RATE_RAND = 60

export default async function setupShipping({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ── 1. Courier Guy options → flat per-service-level rate ───────────────────
  const { data: options } = await query.graph({
    entity: 'shipping_option',
    fields: [
      'id',
      'name',
      'price_type',
      'provider_id',
      'data',
      'prices.amount',
      'prices.currency_code',
    ],
  })

  const shiplogicOptions = (options ?? []).filter((o: any) =>
    String(o.provider_id ?? '').includes('shiplogic'),
  )

  if (shiplogicOptions.length === 0) {
    console.warn(
      '[setup-shipping] no shiplogic shipping options found — create the Courier Guy option in Admin first, then re-run',
    )
  }

  for (const option of shiplogicOptions) {
    const fulfillmentOptionId = String((option.data as any)?.id ?? '')
    const targetRate = FLAT_RATE_RAND_BY_OPTION[fulfillmentOptionId]

    // Priced by service level, so an unrecognised option is left on live rates
    // rather than guessed at — mispricing shipping is worse than not changing it.
    if (targetRate === undefined) {
      console.warn(
        `[setup-shipping] "${option.name}" (${option.id}) has unknown fulfillment option id ` +
          `"${fulfillmentOptionId}" — no rate configured, leaving as-is. ` +
          `Known: ${Object.keys(FLAT_RATE_RAND_BY_OPTION).join(', ')}`,
      )
      continue
    }

    const zarPrice = (option.prices ?? []).find((p: any) => p.currency_code === 'zar')
    const alreadyFlat = option.price_type === 'flat' && Number(zarPrice?.amount) === targetRate
    if (alreadyFlat) {
      console.log(`[setup-shipping] "${option.name}" already flat R${targetRate} — skipping`)
      continue
    }

    await updateShippingOptionsWorkflow(container).run({
      input: [
        {
          id: option.id,
          price_type: 'flat',
          prices: [{ currency_code: 'zar', amount: targetRate }],
        },
      ],
    })
    console.log(
      `[setup-shipping] "${option.name}" (${option.id}): ${option.price_type} → flat R${targetRate}`,
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

  // ── 3. Pudo locker-to-locker pickup (#274 MVP) ─────────────────────────────
  const pudoExists = (options ?? []).some((o: any) =>
    String(o.name ?? '').toLowerCase().startsWith('pudo'),
  )

  if (pudoExists) {
    console.log(`[setup-shipping] "${PUDO_NAME}" already exists — skipping`)
  } else {
    // Reuse the zone + profile of an existing option so Pudo appears alongside
    // the other methods at checkout. Prefer a manual-provider option (the
    // own-delivery one) since Pudo is also staff-booked on the manual provider.
    const { data: existingOptions } = await query.graph({
      entity: 'shipping_option',
      fields: ['id', 'provider_id', 'service_zone_id', 'shipping_profile_id'],
    })
    const template =
      (existingOptions ?? []).find((o: any) => String(o.provider_id ?? '').includes('manual')) ??
      (existingOptions ?? [])[0]

    if (!template) {
      console.warn(
        '[setup-shipping] no existing shipping option to copy zone/profile from — create one in Admin first, then re-run',
      )
    } else {
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: PUDO_NAME,
            price_type: 'flat',
            service_zone_id: template.service_zone_id,
            shipping_profile_id: template.shipping_profile_id,
            provider_id: 'manual_manual',
            type: {
              label: 'Pudo',
              code: 'pudo-l2l',
              description: 'Locker-to-locker pickup via Pudo — we confirm your locker after checkout',
            },
            prices: [{ currency_code: 'zar', amount: PUDO_FLAT_RATE_RAND }],
            rules: [
              { attribute: 'enabled_in_store', operator: 'eq', value: 'true' },
              { attribute: 'is_return', operator: 'eq', value: 'false' },
            ],
            data: { id: 'manual-fulfillment' },
          },
        ],
      })
      console.log(
        `[setup-shipping] created "${PUDO_NAME}" — flat R${PUDO_FLAT_RATE_RAND}, manual fulfillment (staff book Pudo + coordinate the destination locker)`,
      )
    }
  }

  console.log('[setup-shipping] done.')
}
