import type {
  TCGRateRequest,
  TCGRateResponse,
  TCGShipmentRequest,
  TCGShipment,
  TCGPickupPoint,
} from './types'

// Updated to new portal URL (May 2026 — old: api.thecourierguy.co.za/v2)
const BASE_URL = 'https://api.portal.thecourierguy.co.za/v2'

export class CourierGuyClient {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // ─── Core ────────────────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data: any = await res.json()

    if (!res.ok) {
      const msg = data?.message ?? data?.error ?? JSON.stringify(data)
      throw new Error(`TCG ${method} ${path} (${res.status}): ${msg}`)
    }

    return data as T
  }

  // ─── Rates ───────────────────────────────────────────────────────────────────

  async getRates(req: TCGRateRequest): Promise<TCGRateResponse> {
    return this.request<TCGRateResponse>('POST', '/rates', req)
  }

  // ─── Shipments ───────────────────────────────────────────────────────────────

  async createShipment(req: TCGShipmentRequest): Promise<TCGShipment> {
    return this.request<TCGShipment>('POST', '/shipments', req)
  }

  async getShipment(id: string): Promise<TCGShipment> {
    return this.request<TCGShipment>('GET', `/shipments/${id}`)
  }

  async cancelShipment(id: string): Promise<void> {
    await this.request('DELETE', `/shipments/${id}`)
  }

  // ─── Pickup points (PUDO / lockers) ──────────────────────────────────────────

  async getPickupPoints(params?: { lat?: number; lng?: number; type?: 'locker' | 'counter' }): Promise<TCGPickupPoint[]> {
    const qs = new URLSearchParams()
    qs.set('country', 'ZA')
    if (params?.lat) qs.set('lat', String(params.lat))
    if (params?.lng) qs.set('lng', String(params.lng))
    if (params?.type) qs.set('types', params.type)

    const data: any = await this.request('GET', `/pickup-points?${qs}`)
    return (data?.pickup_points ?? data ?? []) as TCGPickupPoint[]
  }
}
