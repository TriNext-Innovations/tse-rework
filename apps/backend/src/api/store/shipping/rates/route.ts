import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { CourierGuyClient } from '../../../../modules/courier-guy/client'
import type { TCGAddress } from '../../../../modules/courier-guy/types'

const COLLECTION_ADDRESS: TCGAddress = {
  type: 'business',
  company: 'The Stationery Exchange',
  street_address: process.env.TCG_ORIGIN_STREET ?? 'Kya Sands',
  local_area: process.env.TCG_ORIGIN_SUBURB ?? 'Kya Sands',
  city: process.env.TCG_ORIGIN_CITY ?? 'Johannesburg',
  zone: process.env.TCG_ORIGIN_PROVINCE ?? 'GP',
  country: 'ZA',
  code: process.env.TCG_ORIGIN_POSTAL_CODE ?? '2163',
}

/**
 * POST /store/shipping/rates
 *
 * Body: { delivery_address: TCGAddress, parcels: TCGParcel[] }
 * Returns all available TCG rates for the delivery address.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { delivery_address, parcels } = req.body as any

  if (!delivery_address?.city || !delivery_address?.code) {
    return res.status(400).json({ error: 'delivery_address must include city and code (postal code)' })
  }

  if (!Array.isArray(parcels) || parcels.length === 0) {
    return res.status(400).json({ error: 'parcels array is required' })
  }

  const client = new CourierGuyClient(process.env.TCG_API_KEY ?? '')

  const { rates } = await client.getRates({
    collection_address: COLLECTION_ADDRESS,
    delivery_address,
    parcels,
  })

  return res.json({ rates })
}
