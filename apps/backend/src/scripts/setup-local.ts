/**
 * Local order-flow bootstrap (#528). Gives a freshly seeded database the
 * warehouse and shipping options that prod was set up with by hand in Admin,
 * so a cart can check out and staff can fulfil, ship and deliver it.
 *
 * Runs after seed.ts and before setup-shipping.ts (which then flattens the
 * courier rates and adds Pudo, exactly as on prod). Idempotent.
 *
 * Refuses to run against anything but a localhost database.
 *
 * Usage (from monorepo root):
 *   pnpm --filter @tse/backend local:setup
 */

import { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from '@medusajs/medusa/core-flows'

const LOCATION_NAME = 'Kya Sands Warehouse'
const COLLECT_NAME = 'Collect from Kya Sands Warehouse'

export default async function setupLocal({ container }: { container: MedusaContainer }) {
  const dbHost = new URL(process.env.DATABASE_URL ?? 'postgres://x').hostname
  if (!['localhost', '127.0.0.1'].includes(dbHost)) {
    throw new Error(`[setup-local] refusing to run against ${dbHost}; this script is for local databases only`)
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const { data: channels } = await query.graph({ entity: 'sales_channel', fields: ['id'] })
  const { data: profiles } = await query.graph({
    entity: 'shipping_profile',
    fields: ['id'],
    filters: { type: 'default' },
  })
  const profileId = profiles[0]!.id

  // Stock location, linked to the sales channel and both fulfilment providers.
  const { data: locations } = await query.graph({
    entity: 'stock_location',
    fields: ['id'],
    filters: { name: LOCATION_NAME },
  })
  let locationId = locations[0]?.id
  if (!locationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: LOCATION_NAME,
            address: { address_1: 'Unit 34, A.P.D. Industrial Park', city: 'Johannesburg', country_code: 'za', postal_code: '2163' },
          },
        ],
      },
    })
    locationId = result[0]!.id
    for (const provider of ['manual_manual', 'shiplogic_shiplogic']) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: provider },
      })
    }
    console.log(`[setup-local] created stock location ${locationId}`)
  }
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: locationId, add: channels.map((c: any) => c.id) },
  })

  // Shipping fulfilment set with one South Africa service zone.
  const { data: located } = await query.graph({
    entity: 'stock_location',
    fields: ['fulfillment_sets.id', 'fulfillment_sets.service_zones.id'],
    filters: { id: locationId },
  })
  let zoneId = (located[0] as any)?.fulfillment_sets?.[0]?.service_zones?.[0]?.id
  if (!zoneId) {
    const set = await fulfillment.createFulfillmentSets({
      name: `${LOCATION_NAME} shipping`,
      type: 'shipping',
      service_zones: [{ name: 'South Africa', geo_zones: [{ type: 'country', country_code: 'za' }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
    zoneId = set.service_zones[0]!.id
    console.log(`[setup-local] created service zone ${zoneId}`)
  }

  // Seeded products carry no shipping profile; without one no option applies.
  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id', 'shipping_profile.id'],
  })
  const unlinked = products.filter((p: any) => !p.shipping_profile?.id)
  if (unlinked.length > 0) {
    await link.create(
      unlinked.map((p: any) => ({
        [Modules.PRODUCT]: { product_id: p.id },
        [Modules.FULFILLMENT]: { shipping_profile_id: profileId },
      })),
    )
    console.log(`[setup-local] linked ${unlinked.length} products to the default shipping profile`)
  }

  // The three options prod has: two courier tiers (calculated here, flattened
  // by setup-shipping.ts) and collection on the manual provider.
  const existing = await fulfillment.listShippingOptions({ service_zone: { id: zoneId } })
  const names = new Set(existing.map((o) => o.name))
  const wanted = [
    { name: 'The Courier Guy — Economy', provider_id: 'shiplogic_shiplogic', price_type: 'calculated' as const, data: { id: 'shiplogic-eco', service_level_code: 'ECO' } },
    { name: 'The Courier Guy — Overnight', provider_id: 'shiplogic_shiplogic', price_type: 'calculated' as const, data: { id: 'shiplogic-ovn', service_level_code: 'OVN' } },
    { name: COLLECT_NAME, provider_id: 'manual_manual', price_type: 'flat' as const, data: { id: 'manual-fulfillment' } },
  ].filter((o) => !names.has(o.name))

  if (wanted.length > 0) {
    await createShippingOptionsWorkflow(container).run({
      input: wanted.map((o) => ({
        name: o.name,
        price_type: o.price_type,
        provider_id: o.provider_id,
        service_zone_id: zoneId,
        shipping_profile_id: profileId,
        type: { label: o.name, description: o.name, code: o.data.id },
        data: o.data,
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
        ...(o.price_type === 'flat' ? { prices: [{ currency_code: 'zar', amount: 0 }] } : {}),
      })) as any,
    })
    console.log(`[setup-local] created shipping options: ${wanted.map((o) => o.name).join(', ')}`)
  }

  // Medusa's built-in test payment, next to PayFast, so the fulfilment emails
  // can be run without a sandbox round trip. Local only: prod never runs this.
  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'payment_providers.id'],
    filters: { currency_code: 'zar' },
  })
  const region = regions[0] as any
  if (region && !region.payment_providers?.some((p: any) => p.id === 'pp_system_default')) {
    await link.create({
      [Modules.REGION]: { region_id: region.id },
      [Modules.PAYMENT]: { payment_provider_id: 'pp_system_default' },
    })
    console.log('[setup-local] enabled the test payment provider (pp_system_default)')
  }
}
