export type PayfastOptions = {
  merchantId: string
  merchantKey: string
  passphrase?: string
  sandbox?: boolean
  /** Public storefront origin — used for return/cancel URLs. */
  storefrontUrl?: string
  /** Medusa backend origin — used for the ITN notify_url. */
  backendUrl?: string
  /**
   * Prices are stored in rands (major units), so amounts are divided by 1 (i.e.
   * used as-is) before formatting to PayFast's rand-with-two-decimals. Kept
   * configurable for environments that still store a minor unit (set to 100).
   * Defaults to 1.
   */
  amountDivisor?: number
}

// The PayFast fields we persist on the payment session `data` so the storefront
// can build the redirect and the ITN can be reconciled.
export type PayfastSessionData = {
  m_payment_id: string
  url: string
  params: Record<string, string>
  status: string
  pf_payment_id?: string
  amount_gross?: string
}
