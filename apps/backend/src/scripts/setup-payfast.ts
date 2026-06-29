/**
 * Enable the PayFast payment provider on the ZAR region.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-payfast.ts
 *
 * Requires PAYFAST_MERCHANT_ID + PAYFAST_MERCHANT_KEY so the provider is loaded
 * (see medusa-config.ts). Safe to re-run.
 *
 * ⚠️ DRAFT — verify the payment-provider id (`pp_payfast_payfast`) and the
 * region link in a sandbox; the id is derived from the provider's config id +
 * static identifier and may differ. If the link API rejects it, enable the
 * provider via Admin → Settings → Regions → ZAR → Payment Providers instead.
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

const PROVIDER_ID = 'pp_payfast_payfast'

export default async function setupPayfast({ container }: { container: MedusaContainer }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'name', 'currency_code'],
  })
  const zar = regions?.find((r: any) => r.currency_code?.toLowerCase() === 'zar')
  if (!zar) {
    console.error('[setup-payfast] no ZAR region found — create one first')
    return
  }

  try {
    await link.create({
      [Modules.REGION]: { region_id: zar.id },
      [Modules.PAYMENT]: { payment_provider_id: PROVIDER_ID },
    })
    console.log(`[setup-payfast] linked ${PROVIDER_ID} to ZAR region ${zar.id}`)
  } catch (err: any) {
    console.error(
      `[setup-payfast] could not link provider (${err.message}). ` +
        `Enable "${PROVIDER_ID}" on the ZAR region via Admin → Regions instead.`,
    )
  }
}
