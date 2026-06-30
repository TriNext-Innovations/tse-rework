import crypto from 'crypto'
import { AbstractPaymentProvider } from '@medusajs/framework/utils'
import {
  type AuthorizePaymentInput,
  type AuthorizePaymentOutput,
  type CancelPaymentInput,
  type CancelPaymentOutput,
  type CapturePaymentInput,
  type CapturePaymentOutput,
  type DeletePaymentInput,
  type DeletePaymentOutput,
  type GetPaymentStatusInput,
  type GetPaymentStatusOutput,
  type InitiatePaymentInput,
  type InitiatePaymentOutput,
  type PaymentSessionStatus,
  type ProviderWebhookPayload,
  type RefundPaymentInput,
  type RefundPaymentOutput,
  type RetrievePaymentInput,
  type RetrievePaymentOutput,
  type UpdatePaymentInput,
  type UpdatePaymentOutput,
  type WebhookActionResult,
} from '@medusajs/framework/types'
import type { PayfastOptions, PayfastSessionData } from './types'

// PayFast production IP ranges (validate ITN source in production).
const PAYFAST_IPS = new Set([
  '197.97.145.144', '41.74.179.194', '196.33.227.144',
  '196.33.227.145', '196.33.227.146', '196.33.227.147',
])

/**
 * PayFast payment provider (Medusa v2 payment module).
 *
 * Flow (canonical / Option B):
 *  1. Storefront creates a payment collection for the cart, then a payment
 *     session with this provider — Medusa calls `initiatePayment`, which signs
 *     the PayFast redirect params (m_payment_id = the Medusa session id) and
 *     returns them on the session `data`.
 *  2. Storefront redirects the customer to PayFast using `data.url` + `data.params`.
 *  3. PayFast posts the ITN to `${backendUrl}/hooks/payment/payfast_payfast`
 *     (the route resolves the provider as `pp_{path}`; this provider is
 *     registered as `pp_payfast_payfast`); Medusa's
 *     webhook route calls `getWebhookActionAndData`, which verifies IP +
 *     signature and returns `{ action: 'authorized', data: { session_id, amount }}`.
 *     Medusa authorizes the session; a subscriber then completes the cart → order.
 *
 * ⚠️ DRAFT — not verified against a PayFast sandbox. Confirm: amount units (see
 * `amountDivisor`), the session_id round-trip via m_payment_id, and signature
 * encoding, before enabling on a live region.
 */
class PayfastProviderService extends AbstractPaymentProvider<PayfastOptions> {
  static override identifier = 'payfast'

  protected readonly options_: PayfastOptions

  constructor(container: Record<string, unknown>, options: PayfastOptions) {
    super(container, options)
    this.options_ = options
  }

  static override validateOptions(options: Record<string, unknown>) {
    if (!options.merchantId || !options.merchantKey) {
      throw new Error('PayFast provider requires `merchantId` and `merchantKey`')
    }
  }

  private get processUrl(): string {
    return this.options_.sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process'
  }

  private encode(value: string): string {
    return encodeURIComponent(value).replace(/%20/g, '+')
  }

  // Build the MD5 signature PayFast expects over the ordered params (+passphrase).
  private sign(params: Record<string, string>): string {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${this.encode(v)}`)
      .join('&')
    const toHash = this.options_.passphrase
      ? `${query}&passphrase=${this.encode(this.options_.passphrase)}`
      : query
    return crypto.createHash('md5').update(toHash).digest('hex')
  }

  private verifySignature(data: Record<string, string>): boolean {
    const { signature, ...rest } = data
    return this.sign(rest) === signature
  }

  // Verify the ITN signature from the RAW posted body so field order and
  // PayFast's own url-encoding are preserved — a parsed object reorders keys and
  // re-encodes values, which breaks the MD5. This is the reliable path.
  private verifyRawSignature(rawData: unknown): boolean {
    if (!rawData) return false
    const raw = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData)
    let signature = ''
    const kept: string[] = []
    for (const pair of raw.split('&')) {
      const idx = pair.indexOf('=')
      const k = idx === -1 ? pair : pair.slice(0, idx)
      const v = idx === -1 ? '' : pair.slice(idx + 1)
      if (k === 'signature') { signature = v; continue }
      kept.push(`${k}=${v}`)
    }
    const base = kept.join('&')
    const toHash = this.options_.passphrase
      ? `${base}&passphrase=${this.encode(this.options_.passphrase)}`
      : base
    return crypto.createHash('md5').update(toHash).digest('hex') === signature
  }

  private toRand(amount: unknown): string {
    const divisor = this.options_.amountDivisor ?? 100
    return (Number(amount) / divisor).toFixed(2)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = (input.data?.session_id as string) ?? crypto.randomUUID()
    const customer = input.context?.customer
    const origin = this.options_.storefrontUrl ?? 'https://tse-cartridges.co.za'
    const backend = this.options_.backendUrl ?? 'http://localhost:9000'

    const params: Record<string, string> = {
      merchant_id: this.options_.merchantId,
      merchant_key: this.options_.merchantKey,
      return_url: `${origin}/checkout/confirmed`,
      cancel_url: `${origin}/checkout`,
      // The webhook route resolves the provider as `pp_{path-segment}`, and this
      // provider registers as `pp_payfast_payfast` (identifier `payfast` + config
      // id `payfast`) — so the path must be `payfast_payfast`, not `payfast`.
      notify_url: `${backend}/hooks/payment/payfast_payfast`,
      ...(customer?.first_name ? { name_first: customer.first_name } : {}),
      ...(customer?.last_name ? { name_last: customer.last_name } : {}),
      ...(customer?.email ? { email_address: customer.email } : {}),
      // m_payment_id carries the Medusa session id so the ITN can reconcile it.
      m_payment_id: sessionId,
      amount: this.toRand(input.amount),
      item_name: 'TSE Online order',
    }
    params.signature = this.sign(params)

    const data: PayfastSessionData = {
      m_payment_id: sessionId,
      url: this.processUrl,
      params,
      status: 'pending',
    }
    return { id: sessionId, status: 'pending', data: data as unknown as Record<string, unknown> }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const status = await this.getPaymentStatus(input)
    return { status: status.status, data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const raw = (input.data?.status as string) ?? 'pending'
    const map: Record<string, PaymentSessionStatus> = {
      pending: 'pending',
      complete: 'authorized',
      authorized: 'authorized',
      captured: 'captured',
      cancelled: 'canceled',
      canceled: 'canceled',
      failed: 'error',
    }
    return { status: map[raw.toLowerCase()] ?? 'pending', data: input.data }
  }

  // PayFast settles immediately on COMPLETE, so capture is a no-op success.
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: { ...(input.data ?? {}), status: 'captured' } }
  }

  // TODO(claus): implement via the PayFast refunds API once enabled on the
  // merchant account; verify in sandbox. Throws for now so refunds aren't
  // silently swallowed.
  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new Error('PayFast refunds are not yet implemented')
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Re-run initiate to rebuild signed params for the new amount.
    const res = await this.initiatePayment(input as unknown as InitiatePaymentInput)
    return { status: res.status, data: res.data }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload['payload'],
  ): Promise<WebhookActionResult> {
    const body = (webhookData.data ?? {}) as Record<string, string>
    const headers = (webhookData.headers ?? {}) as Record<string, string>

    // Source IP check (best-effort — behind a proxy use x-forwarded-for).
    const fwd = headers['x-forwarded-for'] ?? headers['x-real-ip'] ?? ''
    const ip = String(fwd).split(',')[0]?.trim()
    const isProd = !this.options_.sandbox
    if (isProd && ip && !PAYFAST_IPS.has(ip)) {
      return { action: 'failed' }
    }

    if (body.merchant_id && body.merchant_id !== this.options_.merchantId) {
      return { action: 'failed' }
    }
    // Prefer the raw body for signature (preserves order); fall back to the
    // parsed object if the platform didn't surface rawData.
    const verified = (webhookData as any).rawData
      ? this.verifyRawSignature((webhookData as any).rawData)
      : this.verifySignature(body)
    if (!verified) {
      return { action: 'failed' }
    }

    const sessionId = body.m_payment_id ?? ''
    const status = (body.payment_status ?? '').toUpperCase()

    if (status === 'COMPLETE') {
      return {
        action: 'authorized',
        data: { session_id: sessionId, amount: Number(body.amount_gross ?? body.amount ?? 0) },
      }
    }
    if (status === 'CANCELLED' || status === 'FAILED') {
      return {
        action: 'canceled',
        data: { session_id: sessionId, amount: Number(body.amount_gross ?? body.amount ?? 0) },
      }
    }
    return { action: 'pending', data: { session_id: sessionId, amount: Number(body.amount_gross ?? 0) } }
  }
}

export default PayfastProviderService
