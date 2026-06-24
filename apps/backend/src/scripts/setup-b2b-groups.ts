/**
 * Creates the two B2B customer groups in Medusa.
 * Safe to re-run — skips groups that already exist.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-b2b-groups.ts
 *
 * After running, create matching price lists in Medusa Admin:
 *   - "Reseller Pricing" — 15% off all products — assigned to "Reseller" group
 *   - "Wholesale Pricing" — 25% off all products — assigned to "Wholesale" group
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'

const GROUPS = [
  { name: 'Reseller', metadata: { tier: 'reseller', discount_pct: 15 } },
  { name: 'Wholesale', metadata: { tier: 'wholesale', discount_pct: 25 } },
]

export default async function setupB2BGroups({ container }: { container: MedusaContainer }) {
  const customerService = container.resolve(Modules.CUSTOMER) as any

  for (const group of GROUPS) {
    const existing = await customerService
      .listCustomerGroups({ name: [group.name] })
      .catch(() => [])

    if (existing.length > 0) {
      console.log(`[setup-b2b] "${group.name}" group already exists — skipping`)
      continue
    }

    await customerService.createCustomerGroups({ name: group.name, metadata: group.metadata })
    console.log(`[setup-b2b] created customer group: "${group.name}"`)
  }

  console.log('[setup-b2b] done.')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Go to Medusa Admin → Pricing → Create price list "Reseller Pricing"')
  console.log('     - Type: Sale, applies to "Reseller" customer group')
  console.log('     - Add prices at 15% below standard for all or specific SKUs')
  console.log('  2. Create price list "Wholesale Pricing"')
  console.log('     - Type: Sale, applies to "Wholesale" customer group')
  console.log('     - Add prices at 25% below standard')
  console.log('  3. When approving a B2B application, add the customer to the relevant group')
  console.log('     in Medusa Admin → Customers → [customer] → Groups')
}
