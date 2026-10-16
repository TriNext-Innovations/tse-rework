import type { CourierGuyParcel } from './types'

/**
 * The whole order as ONE parcel: TSE packs a multi-item order in a single box.
 *
 * This used to return one parcel per unit, so The Courier Guy booked (and
 * quoted) an order of four cartridges as four separate flyers.
 *
 * Variant weight/dimensions are used when present (Medusa stores weight in
 * grams), otherwise the configured default parcel, which is one cartridge in
 * packaging. Weights add up. Length and width take the largest unit, and the
 * units stack on height, so the box holds the volume of everything in it and
 * the volumetric weight the courier charges on stays honest.
 */
export function buildParcels(items: any[], def: CourierGuyParcel): CourierGuyParcel[] {
  let length = 0
  let width = 0
  let height = 0
  let weightKg = 0
  let units = 0

  for (const item of items) {
    const qty = Math.max(1, Number(item?.quantity ?? 1))
    const variant = item?.variant ?? {}

    length = Math.max(length, variant.length > 0 ? variant.length : def.submitted_length_cm)
    width = Math.max(width, variant.width > 0 ? variant.width : def.submitted_width_cm)
    height += qty * (variant.height > 0 ? variant.height : def.submitted_height_cm)
    weightKg += qty * (variant.weight > 0 ? variant.weight / 1000 : def.submitted_weight_kg)
    units += qty
  }

  if (units === 0) return [def]

  return [
    {
      submitted_length_cm: length,
      submitted_width_cm: width,
      submitted_height_cm: height,
      submitted_weight_kg: Math.round(weightKg * 1000) / 1000,
      parcel_description:
        units === 1 ? (items[0]?.title ?? def.parcel_description) : def.parcel_description,
    },
  ]
}
