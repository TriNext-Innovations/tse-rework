#!/usr/bin/env node
/**
 * TSE Online — Seed Script
 *
 * Seeds the Medusa backend with:
 *   1. South Africa region + ZAR currency
 *   2. TSE Online sales channel
 *   3. Product category hierarchy (Type → Brand)
 *   4. All 340 products from WooCommerce export
 *
 * Run:    pnpm tsx scripts/seed.ts
 * Needs:  Medusa dev server on http://localhost:9000
 */

import fs from "fs"
import path from "path"

const BASE_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL ?? "admin@tse.co.za"
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD ?? "TseAdmin2026!"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8212;/g, "—").replace(/&#8211;/g, "–")
    .replace(/\s+/g, " ").trim()
}

async function api<T = any>(
  token: string | null,
  method: string,
  endpoint: string,
  body?: object
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json() as any
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${JSON.stringify(data).slice(0, 400)}`)
  return data as T
}

// ─── Authentication ────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const data = await api<{ token: string }>(null, "POST", "/auth/user/emailpass", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  console.log("✓ Authenticated")
  return data.token
}

// ─── Region ───────────────────────────────────────────────────────────────────

async function ensureRegion(token: string): Promise<string> {
  const { regions } = await api<{ regions: any[] }>(token, "GET", "/admin/regions?limit=50")
  const existing = regions.find((r: any) => r.currency_code === "zar")
  if (existing) {
    console.log(`✓ Region exists: ${existing.name} (${existing.id})`)
    return existing.id as string
  }

  const { region } = await api<{ region: any }>(token, "POST", "/admin/regions", {
    name: "South Africa",
    currency_code: "zar",
    countries: ["za"],
  })
  console.log(`✓ Created region: South Africa (${region.id})`)
  return region.id as string
}

// ─── Sales Channel ────────────────────────────────────────────────────────────

async function ensureSalesChannel(token: string): Promise<string> {
  const { sales_channels } = await api<{ sales_channels: any[] }>(
    token, "GET", "/admin/sales-channels?limit=50"
  )
  const existing = sales_channels.find((c: any) => c.name === "TSE Online Storefront")
  if (existing) {
    console.log(`✓ Sales channel exists (${existing.id})`)
    return existing.id as string
  }

  const { sales_channel } = await api<{ sales_channel: any }>(
    token, "POST", "/admin/sales-channels",
    { name: "TSE Online Storefront", description: "Main online store — tse-cartridges.co.za" }
  )
  console.log(`✓ Created sales channel (${sales_channel.id})`)
  return sales_channel.id as string
}

// ─── Categories ───────────────────────────────────────────────────────────────

// WooCommerce slug → [Medusa parent, Medusa child]
const CATEGORY_MAP: Record<string, [string, string]> = {
  "brother-inkjet-cartridges":                  ["Inkjet Cartridges", "Brother"],
  "brother-laserjet-cartridges":                ["Laser Cartridges",  "Brother"],
  "canon-inkjet-cartridges":                    ["Inkjet Cartridges", "Canon"],
  "canon-laserjet-cartridges":                  ["Laser Cartridges",  "Canon"],
  "epson-inkjet-cartridges":                    ["Inkjet Cartridges", "Epson"],
  "hp-inkjet-cartridges":                       ["Inkjet Cartridges", "HP"],
  "hp-laserjet-cartridges":                     ["Laser Cartridges",  "HP"],
  "generic-konica-minolta-laserjet-cartridges": ["Laser Cartridges",  "Konica Minolta"],
  "generic-kyocera-laserjet-cartridges":        ["Laser Cartridges",  "Kyocera"],
  "lexmark-inkjet-cartridges":                  ["Inkjet Cartridges", "Lexmark"],
  "lexmark-laserjet-cartridges":                ["Laser Cartridges",  "Lexmark"],
  "generic-oki-laserjet-cartridges":            ["Laser Cartridges",  "OKI"],
  "pantum-cartridges":                          ["Laser Cartridges",  "Pantum"],
  "generic-ricoh-laserjet-cartridges":          ["Laser Cartridges",  "Ricoh"],
  "samsung-inkjet-cartridges":                  ["Inkjet Cartridges", "Samsung"],
  "samsung-laserjet-cartridges":                ["Laser Cartridges",  "Samsung"],
  "xerox-cartridges":                           ["Laser Cartridges",  "Xerox"],
}

async function ensureCategories(token: string): Promise<Map<string, string>> {
  const { product_categories } = await api<{ product_categories: any[] }>(
    token, "GET", "/admin/product-categories?limit=200"
  )
  const byName = new Map<string, string>(
    product_categories.map((c: any) => [c.name as string, c.id as string])
  )

  const ensure = async (name: string, parentId?: string): Promise<string> => {
    if (byName.has(name)) return byName.get(name)!
    const body: any = {
      name,
      handle: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      is_active: true,
    }
    if (parentId) body.parent_category_id = parentId
    const { product_category } = await api<{ product_category: any }>(
      token, "POST", "/admin/product-categories", body
    )
    byName.set(name, product_category.id)
    return product_category.id as string
  }

  const inkjetId = await ensure("Inkjet Cartridges")
  const laserjetId = await ensure("Laser Cartridges")

  // Deduplicate child names per parent
  const seen = new Set<string>()
  for (const [parent, child] of Object.values(CATEGORY_MAP)) {
    const key = `${parent}::${child}`
    if (seen.has(key)) continue
    seen.add(key)
    const parentId = parent === "Inkjet Cartridges" ? inkjetId : laserjetId
    await ensure(child, parentId)
  }

  console.log(`✓ Categories ready (${byName.size} total)`)

  // Build woo-slug → medusa child category ID
  const slugToId = new Map<string, string>()
  for (const [slug, [, child]] of Object.entries(CATEGORY_MAP)) {
    const id = byName.get(child)
    if (id) slugToId.set(slug, id)
  }
  return slugToId
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function seedProducts(
  token: string,
  channelId: string,
  categoryMap: Map<string, string>
): Promise<string[]> {
  const dataPath = path.join(process.cwd(), "migration/raw/products.json")
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as any
  const all: any[] = raw.products as any[]

  // Remove the known dummy product
  const products = all.filter(
    (p) => p.sku !== "HP-123TOETS" && p.name !== "HP - 123 Toets"
  )

  console.log(`\nSeeding ${products.length} products...`)

  const createdIds: string[] = []
  let done = 0, skipped = 0, failed = 0

  for (const product of products) {
    const categoryIds = (product.categories ?? [])
      .map((c: any) => {
        const id = categoryMap.get(c.slug)
        return id ? { id } : null
      })
      .filter(Boolean)

    let options: any[] | undefined
    let variants: any[]

    if (product.type === "variable") {
      const colours: string[] = product.variants.map((v: any) => v.colour as string)
      options = [{ title: "Colour", values: colours }]
      variants = product.variants.map((v: any) => ({
        title: v.colour,
        sku: v.sku,
        options: { Colour: v.colour },
        prices: [{ amount: Math.round(parseFloat(v.price) * 100), currency_code: "zar" }],
        manage_inventory: false,
      }))
    } else {
      options = [{ title: "Title", values: ["Default"] }]
      variants = [{
        title: "Default",
        sku: product.sku,
        options: { Title: "Default" },
        prices: [{ amount: Math.round((parseFloat(product.price) || 0) * 100), currency_code: "zar" }],
        manage_inventory: false,
      }]
    }

    const body: any = {
      title: product.name,
      handle: product.slug,
      description: stripHtml(product.description ?? ""),
      status: "published",
      categories: categoryIds,
      sales_channels: [{ id: channelId }],
      variants,
    }
    if (options) body.options = options

    try {
      const { product: created } = await api<{ product: any }>(
        token, "POST", "/admin/products", body
      )
      createdIds.push(created.id)
      done++
    } catch (err: any) {
      const msg: string = err.message ?? ""
      if (msg.includes("handle") || msg.includes("already")) {
        skipped++
      } else {
        console.error(`  ✗ ${product.name}: ${msg.slice(0, 120)}`)
        failed++
      }
    }

    const total = done + skipped + failed
    if (total % 25 === 0 || total === products.length) {
      process.stdout.write(`\r  ${done} created  ${skipped} skipped  ${failed} failed  / ${products.length}`)
    }
  }

  console.log(`\n✓ Products done: ${done} created, ${skipped} already existed, ${failed} failed`)
  return createdIds
}

// ─── Stock Location ───────────────────────────────────────────────────────────

async function ensureStockLocation(token: string): Promise<string> {
  const { stock_locations } = await api<{ stock_locations: any[] }>(
    token, "GET", "/admin/stock-locations?limit=50"
  )
  const existing = stock_locations.find((l: any) => l.name === "Kya Sands Warehouse")
  if (existing) {
    console.log(`✓ Stock location exists (${existing.id})`)
    return existing.id as string
  }
  const { stock_location } = await api<{ stock_location: any }>(
    token, "POST", "/admin/stock-locations",
    { name: "Kya Sands Warehouse", address: { address_1: "Unit 34, A.P.D. Industrial Park", city: "Johannesburg", country_code: "za" } }
  )
  console.log(`✓ Created stock location (${stock_location.id})`)
  return stock_location.id as string
}

// ─── Shipping Options ─────────────────────────────────────────────────────────

async function ensureShippingOptions(token: string, locationId: string): Promise<void> {
  // Get fulfillment providers (manual is always present; shiplogic if configured)
  const { fulfillment_providers } = await api<{ fulfillment_providers: any[] }>(
    token, "GET", "/admin/fulfillment-providers"
  )
  const providerId: string =
    fulfillment_providers?.find((p: any) => p.id?.includes("manual"))?.id ?? "manual_manual"
  const shiplogicId: string | undefined =
    fulfillment_providers?.find((p: any) => p.id?.includes("shiplogic"))?.id

  // Associate fulfillment providers with stock location (required before creating shipping options)
  const providerIds = [providerId, ...(shiplogicId ? [shiplogicId] : [])]
  await api(token, "POST", `/admin/stock-locations/${locationId}/fulfillment-providers`,
    { add: providerIds }
  ).catch(() => { /* already associated — ignore */ })

  // Get or create fulfillment set via stock location
  const locData = await api<{ stock_location: any }>(
    token, "GET", `/admin/stock-locations/${locationId}?fields=*fulfillment_sets`
  )
  let fulfillmentSetId: string
  const existingSets: any[] = locData.stock_location?.fulfillment_sets ?? []
  if (existingSets.length) {
    fulfillmentSetId = existingSets[0].id
  } else {
    await api(token, "POST", `/admin/stock-locations/${locationId}/fulfillment-sets`,
      { name: "TSE Delivery", type: "shipping" }
    )
    const locData2 = await api<{ stock_location: any }>(
      token, "GET", `/admin/stock-locations/${locationId}?fields=*fulfillment_sets`
    )
    fulfillmentSetId = locData2.stock_location.fulfillment_sets[0].id
  }

  // Get or create service zone covering South Africa.
  // GET /admin/fulfillment-sets/:id does not exist in Medusa v2 — expand via stock location.
  const locData2 = await api<{ stock_location: any }>(
    token, "GET",
    `/admin/stock-locations/${locationId}?fields=*fulfillment_sets,*fulfillment_sets.service_zones`
  )
  const fSets: any[] = locData2.stock_location?.fulfillment_sets ?? []
  const existingZones: any[] = fSets.flatMap((f: any) => f.service_zones ?? [])
  let serviceZoneId: string
  if (existingZones.length) {
    serviceZoneId = existingZones[0].id
  } else {
    const { fulfillment_set: updated } = await api<{ fulfillment_set: any }>(
      token, "POST", `/admin/fulfillment-sets/${fulfillmentSetId}/service-zones`,
      { name: "South Africa", geo_zones: [{ type: "country", country_code: "za" }] }
    )
    serviceZoneId = updated.service_zones[0].id
  }

  // Get or create shipping profile (Medusa requires one on every shipping option)
  let profileId: string
  const { shipping_profiles } = await api<{ shipping_profiles: any[] }>(
    token, "GET", "/admin/shipping-profiles?limit=1"
  )
  if (shipping_profiles?.length) {
    profileId = shipping_profiles[0].id
  } else {
    const { shipping_profile } = await api<{ shipping_profile: any }>(
      token, "POST", "/admin/shipping-profiles",
      { name: "Default", type: "default" }
    )
    profileId = shipping_profile.id
  }

  // Check existing options
  const { shipping_options } = await api<{ shipping_options: any[] }>(
    token, "GET", "/admin/shipping-options?limit=50"
  )
  const existingNames = new Set(shipping_options.map((o: any) => o.name as string))

  // Flat options run on the manual provider; courier options are quoted live
  // from The Courier Guy (ShipLogic) via the shiplogic provider.
  const flatOptions = [
    { name: "JHB/PTA Own Delivery (COD)", amount: 0, code: "jhb_pta_delivery" },
  ]
  const calculatedOptions = shiplogicId
    ? [
        { name: "The Courier Guy — Economy",   code: "ECO", optionId: "shiplogic-eco" },
        { name: "The Courier Guy — Overnight", code: "OVN", optionId: "shiplogic-ovn" },
      ]
    : []

  let created = 0

  for (const opt of flatOptions) {
    if (existingNames.has(opt.name)) continue
    await api(token, "POST", "/admin/shipping-options", {
      name: opt.name,
      service_zone_id: serviceZoneId,
      shipping_profile_id: profileId,
      provider_id: providerId,
      price_type: "flat",
      type: { label: opt.name, description: opt.name, code: opt.code },
      prices: [{ amount: opt.amount, currency_code: "zar" }],
      rules: [{ attribute: "is_return", value: "false", operator: "eq" }],
    })
    created++
  }

  for (const opt of calculatedOptions) {
    if (existingNames.has(opt.name)) continue
    await api(token, "POST", "/admin/shipping-options", {
      name: opt.name,
      service_zone_id: serviceZoneId,
      shipping_profile_id: profileId,
      provider_id: shiplogicId,
      price_type: "calculated",
      // `data` must match a FulfillmentOption from the provider's getFulfillmentOptions().
      data: { id: opt.optionId, service_level_code: opt.code, name: opt.name },
      type: { label: opt.name, description: opt.name, code: opt.code },
      rules: [{ attribute: "is_return", value: "false", operator: "eq" }],
    })
    created++
  }

  const total = flatOptions.length + calculatedOptions.length
  if (!shiplogicId) {
    console.warn("  ⚠ shiplogic provider not registered — skipping live courier options")
  }
  console.log(`✓ Shipping options ready (${created} created, ${total - created} already existed)`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("TSE Online — Seed Script")
  console.log("========================\n")

  const token = await login()
  const regionId = await ensureRegion(token)
  const channelId = await ensureSalesChannel(token)
  const categoryMap = await ensureCategories(token)
  await seedProducts(token, channelId, categoryMap)

  const locationId = await ensureStockLocation(token)
  await ensureShippingOptions(token, locationId).catch((err) => {
    console.warn(`⚠ Shipping options skipped: ${err.message?.slice(0, 100)}`)
  })

  console.log("\n✅ Seed complete!\n")
  console.log("Next: open http://localhost:9000/app")
  console.log("  → Settings → Publishable API Keys → create a key")
  console.log("  → add it to apps/web/.env.local as NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err)
  process.exit(1)
})
