import type {
  CourierGuyRateRequest,
  CourierGuyRatesResponse,
  CourierGuyShipmentRequest,
  CourierGuyShipmentResponse,
} from './types'

// The Courier Guy's rate/waybill API is served by the ShipLogic platform, so
// the host stays api.shiplogic.com even though the integration is named after
// the courier.
const DEFAULT_BASE_URL = 'https://api.shiplogic.com'

export class CourierGuyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'CourierGuyError'
  }
}

/**
 * Minimal The Courier Guy REST client (ShipLogic-powered API).
 *
 * The API uses a single host for sandbox and production — the environment is
 * determined by the API token, not the URL. Auth is a bearer token.
 */
export class CourierGuyClient {
  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    baseUrl?: string,
  ) {
    // Use || not ?? — an empty string (e.g. TCG_API_URL unset via compose
    // `${TCG_API_URL:-}`) must fall back to the default, not become "".
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  }

  /** POST /rates — live shipping quotes for a collection→delivery route. */
  async getRates(request: CourierGuyRateRequest): Promise<CourierGuyRatesResponse> {
    return this.request<CourierGuyRatesResponse>('POST', '/rates', request)
  }

  /** POST /shipments — book a shipment and generate a waybill. */
  async createShipment(
    request: CourierGuyShipmentRequest,
  ): Promise<CourierGuyShipmentResponse> {
    return this.request<CourierGuyShipmentResponse>('POST', '/shipments', request)
  }

  /** GET /shipments/label — PDF label URL for a shipment. */
  async getLabelUrl(shipmentId: number): Promise<string | null> {
    const res = await this.request<{ url?: string }>(
      'GET',
      `/shipments/label?id=${encodeURIComponent(shipmentId)}`,
    )
    return typeof res?.url === 'string' && res.url !== '' ? res.url : null
  }

  /** GET /tracking/shipments — tracking events for a reference. */
  async getTracking(trackingReference: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/tracking/shipments?tracking_reference=${encodeURIComponent(trackingReference)}`,
    )
  }

  /** POST /shipments/cancel — cancel a booked shipment. */
  async cancelShipment(trackingReference: string): Promise<void> {
    await this.request('POST', '/shipments/cancel', {
      tracking_reference: trackingReference,
    })
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err: any) {
      throw new CourierGuyError(`Courier Guy request failed: ${err?.message ?? err}`)
    }

    const text = await res.text()

    if (!res.ok) {
      const message = extractMessage(text) ?? res.statusText
      throw new CourierGuyError(
        `Courier Guy ${method} ${path} failed (${res.status}): ${message}`,
        res.status,
        text,
      )
    }

    if (text === '') {
      return {} as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new CourierGuyError(
        `Courier Guy returned non-JSON response: ${text.slice(0, 200)}`,
        res.status,
        text,
      )
    }
  }
}

function extractMessage(body: string): string | null {
  try {
    const decoded = JSON.parse(body)
    if (decoded && typeof decoded === 'object') {
      if (typeof decoded.message === 'string') return decoded.message
      if (typeof decoded.error === 'string') return decoded.error
    }
  } catch {
    // not JSON
  }
  return null
}
