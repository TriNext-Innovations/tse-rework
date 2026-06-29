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
   * This deployment stores money as integer cents (a R450 product = amount
   * 45000). PayFast expects rand with two decimals, so amounts are divided by
   * this before formatting. Set to 1 if your prices are already in major units.
   * NB: verify against the cart total in a PayFast sandbox before going live.
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
