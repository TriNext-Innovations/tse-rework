/**
 * Repoint product-description links from the legacy WooCommerce shop to this
 * storefront (#361).
 *
 * 211 of 301 published products carry copy imported from the old site:
 *
 *   Browse through <a href="https://www.tse.co.za/shop/">our shop</a> to
 *   discover a wide array of high-quality cartridges…
 *
 * On the new storefront that sends a buyer mid-consideration to a site that
 * does not take orders through us, and bleeds link equity to www.tse.co.za on
 * exactly the pages we want ranking. The call-to-action is doing a real job —
 * it is just pointing the wrong way — so we rewrite the href and keep the
 * anchor text ("our shop") and the surrounding sentence intact.
 *
 * Only the URL is touched. Idempotent: it matches the legacy host, which no
 * longer exists in the copy afterwards, so re-running is a no-op. Safe to run
 * again after any future WooCommerce re-import.
 *
 * Usage (from monorepo root):
 *   # report only, changes nothing
 *   DRY_RUN=1 pnpm --filter @tse/backend exec medusa exec src/scripts/fix-product-shop-links.ts
 *   # apply
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/fix-product-shop-links.ts
 *
 * Afterwards, re-index so search reflects the new copy:
 *   pnpm --filter @tse/backend exec medusa exec src/scripts/bulk-index.ts
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

// Matches http/https, with or without www, with or without the trailing slash.
// The www group MUST stay non-capturing: Postgres `substring(x from pattern)`
// returns the first capture group when the pattern has one, so a capturing
// `(www\.)?` makes the preview print "www." instead of the matched URL.
const LEGACY_SHOP_RE = 'https?://(?:www\\.)?tse\\.co\\.za/shop/?'
const REPLACEMENT = '/products'

export default async function fixProductShopLinks({ container }: { container: MedusaContainer }) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const dryRun = process.env.DRY_RUN === '1'

  const { rows: before } = await knex.raw(
    `SELECT count(*)::int AS n FROM product
     WHERE deleted_at IS NULL AND description ~ ?`,
    [LEGACY_SHOP_RE],
  )
  const affected = before[0]?.n ?? 0

  if (affected === 0) {
    console.log('[fix-product-shop-links] no descriptions link to the legacy shop — nothing to do')
    return
  }

  console.log(`[fix-product-shop-links] ${affected} product(s) link to the legacy shop`)

  // Show one before/after so the change is reviewable rather than blind.
  const { rows: sample } = await knex.raw(
    `SELECT id, title,
            substring(description from '.{0,90}' || ? || '.{0,40}') AS snippet
     FROM product
     WHERE deleted_at IS NULL AND description ~ ?
     LIMIT 1`,
    [LEGACY_SHOP_RE, LEGACY_SHOP_RE],
  )
  if (sample[0]?.snippet) {
    console.log(`[fix-product-shop-links] example (${sample[0].title}):`)
    console.log(`  before: …${sample[0].snippet}…`)
    console.log(`  after : …${String(sample[0].snippet).replace(new RegExp(LEGACY_SHOP_RE, 'g'), REPLACEMENT)}…`)
  }

  if (dryRun) {
    console.log('[fix-product-shop-links] DRY_RUN=1 — no changes written')
    return
  }

  const { rowCount } = await knex.raw(
    `UPDATE product
     SET description = regexp_replace(description, ?, ?, 'g'),
         updated_at  = now()
     WHERE deleted_at IS NULL AND description ~ ?`,
    [LEGACY_SHOP_RE, REPLACEMENT, LEGACY_SHOP_RE],
  )
  console.log(`[fix-product-shop-links] rewrote ${rowCount} product description(s)`)

  const { rows: after } = await knex.raw(
    `SELECT count(*)::int AS n FROM product
     WHERE deleted_at IS NULL AND description ~ ?`,
    [LEGACY_SHOP_RE],
  )
  const remaining = after[0]?.n ?? 0
  if (remaining > 0) {
    throw new Error(`[fix-product-shop-links] ${remaining} description(s) still link to the legacy shop`)
  }

  console.log('[fix-product-shop-links] done — 0 descriptions now link to the legacy shop')
  console.log('[fix-product-shop-links] re-index search so results reflect the new copy:')
  console.log('  pnpm --filter @tse/backend exec medusa exec src/scripts/bulk-index.ts')
}
