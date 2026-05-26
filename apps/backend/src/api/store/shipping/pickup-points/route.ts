import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { CourierGuyClient } from '../../../../modules/courier-guy/client'

/**
 * GET /store/shipping/pickup-points?lat=-26.2&lng=28.0&type=locker
 *
 * Returns TCG locker / counter pickup points, optionally filtered by
 * proximity (lat/lng) and type.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { lat, lng, type } = req.query as Record<string, string>

  const client = new CourierGuyClient(process.env.TCG_API_KEY ?? '')

  const points = await client.getPickupPoints({
    lat: lat ? parseFloat(lat) : undefined,
    lng: lng ? parseFloat(lng) : undefined,
    type: type === 'locker' || type === 'counter' ? type : undefined,
  })

  return res.json({ pickup_points: points })
}
