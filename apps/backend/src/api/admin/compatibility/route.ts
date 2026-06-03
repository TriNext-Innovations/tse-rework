import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sku = (req.query as Record<string, string>).sku?.trim()

  if (!sku) {
    return res.status(400).json({ error: 'sku query param is required' })
  }

  const compatService = req.scope.resolve('compatibility') as any

  try {
    const models = await compatService.findBySku(sku)
    return res.status(200).json({ models, count: models.length })
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? 'Failed to query compatibility data' })
  }
}
