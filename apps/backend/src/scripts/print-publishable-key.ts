/**
 * Print the storefront's publishable API key (#372).
 *
 * A clean checkout has an empty NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY, and every
 * /store call then fails with "Publishable API key required in the request
 * header: x-publishable-api-key" — the storefront renders no products, no cart
 * and no search. The key already exists in the DB after seeding; the only
 * missing step was knowing how to read it out without digging through Admin.
 *
 * Read-only. Safe to re-run.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend key
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'

export default async function printPublishableKey({ container }: { container: MedusaContainer }) {
  const apiKeyService = container.resolve(Modules.API_KEY) as any

  const keys = await apiKeyService.listApiKeys({ type: 'publishable' })

  if (!keys?.length) {
    console.log(
      '\nNo publishable API key exists yet.\n' +
        'Seed the store first (pnpm --filter @tse/backend exec medusa exec src/scripts/seed.ts),\n' +
        'or create one in Admin: Settings -> Publishable API keys.\n'
    )
    return
  }

  console.log('\nPublishable API key(s) — copy into NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:\n')
  for (const key of keys) {
    const revoked = key.revoked_at ? '  (REVOKED)' : ''
    console.log(`  ${key.token}   ${key.title ?? 'untitled'}${revoked}`)
  }
  console.log()
}
