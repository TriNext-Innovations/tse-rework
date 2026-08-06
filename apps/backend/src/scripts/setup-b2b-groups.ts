/**
 * B2B approval model (#272): ONE customer group — see `B2B_GROUP_NAME`.
 * Approval = membership. Discounts are NOT flat price lists anymore; they are
 * per-order threshold promotions created by `setup-b2b-pricing.ts` from the
 * bands in `@tse/types`, so this script no longer creates the retired Reseller
 * / Wholesale groups. If those legacy groups still exist, their members are
 * migrated into the B2B group; deleting the empty groups and their price lists
 * is left to Admin (destructive, so not automated).
 *
 * Safe to re-run.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/setup-b2b-groups.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { B2B_GROUP_NAME, B2B_TIERS, b2bTierLabel } from '@tse/types'

const LEGACY_GROUP_NAMES = ['Reseller', 'Wholesale']

export default async function setupB2BGroups({ container }: { container: MedusaContainer }) {
  const customerService = container.resolve(Modules.CUSTOMER) as any

  let [group] = await customerService.listCustomerGroups({ name: [B2B_GROUP_NAME] }).catch(() => [])
  if (group) {
    console.log(`[setup-b2b] "${B2B_GROUP_NAME}" group already exists — skipping create`)
  } else {
    group = await customerService.createCustomerGroups({
      name: B2B_GROUP_NAME,
      metadata: { tier: 'b2b-approved' },
    })
    console.log(`[setup-b2b] created customer group: "${B2B_GROUP_NAME}"`)
  }

  // Migrate members out of the retired flat-discount groups.
  const legacyGroups = await customerService
    .listCustomerGroups({ name: LEGACY_GROUP_NAMES }, { relations: ['customers'] })
    .catch(() => [])

  for (const legacy of legacyGroups) {
    const members = legacy.customers ?? []
    if (members.length === 0) {
      console.log(`[setup-b2b] legacy group "${legacy.name}" has no members — delete it in Admin`)
      continue
    }
    await customerService.addCustomerToGroup(
      members.map((c: any) => ({ customer_id: c.id, customer_group_id: group.id })),
    )
    console.log(
      `[setup-b2b] migrated ${members.length} customer(s) from "${legacy.name}" → "${B2B_GROUP_NAME}"`,
    )
    console.log(
      `[setup-b2b]   → remove them from "${legacy.name}" and delete the group + its price list in Admin once verified`,
    )
  }

  console.log('[setup-b2b] done.')
  console.log('')
  console.log('Next steps:')
  console.log(`  1. Run setup-b2b-pricing.ts to create the threshold promotions (${B2B_TIERS.map(b2bTierLabel).join(', ')})`)
  console.log(`  2. When approving a B2B application, add the customer to "${B2B_GROUP_NAME}"`)
  console.log('     in Medusa Admin → Customers → [customer] → Groups')
  console.log('  3. Retire any legacy "Reseller Pricing" / "Wholesale Pricing" price lists in Admin')
}
