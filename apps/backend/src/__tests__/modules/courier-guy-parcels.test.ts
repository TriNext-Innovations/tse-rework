import { describe, it, expect } from 'vitest'
import { buildParcels } from '../../modules/courier-guy/parcels'

const def = {
  submitted_length_cm: 22,
  submitted_width_cm: 11,
  submitted_height_cm: 6,
  submitted_weight_kg: 0.5,
  parcel_description: 'Printer consumables',
}

describe('buildParcels', () => {
  it('books a multi-item order as one parcel, not one flyer per unit', () => {
    // The client's report: four items arrived at the courier as four flyers.
    const parcels = buildParcels([{ quantity: 1 }, { quantity: 1 }, { quantity: 2 }], def)
    expect(parcels).toHaveLength(1)
    expect(parcels[0]).toEqual({
      submitted_length_cm: 22,
      submitted_width_cm: 11,
      submitted_height_cm: 24,
      submitted_weight_kg: 2,
      parcel_description: 'Printer consumables',
    })
  })

  it('keeps a single unit at the default size, named after the item', () => {
    expect(buildParcels([{ quantity: 1, title: 'HP 85A' }], def)).toEqual([
      { ...def, parcel_description: 'HP 85A' },
    ])
  })

  it('uses variant weight (grams) and dimensions when present', () => {
    const parcels = buildParcels(
      [
        { quantity: 1, variant: { weight: 1200, length: 35, width: 15, height: 14 } },
        { quantity: 2 },
      ],
      def,
    )
    expect(parcels).toEqual([
      {
        submitted_length_cm: 35,
        submitted_width_cm: 15,
        submitted_height_cm: 26,
        submitted_weight_kg: 2.2,
        parcel_description: 'Printer consumables',
      },
    ])
  })

  it('falls back to the default parcel for an empty item list', () => {
    expect(buildParcels([], def)).toEqual([def])
  })
})
