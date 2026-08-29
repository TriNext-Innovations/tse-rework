'use client'

import { useState } from 'react'
import { useCart } from '@/contexts/CartContext'

// Promo-code entry, shared by the cart page and the checkout summary. The cart
// is the source of truth: this component only submits a code and renders
// whatever came back on the cart, so a code Medusa dropped by itself (the order
// fell under its minimum) disappears here without any local bookkeeping.
//
// The automatic B2B discount is deliberately NOT listed as a removable chip —
// `promoCodes` excludes it. It isn't the shopper's to take off, and showing an
// × next to it would invite a support call when the click does nothing.
export function PromoCodeField({ className = '' }: { className?: string }) {
  const { promoCodes, promoPending, promoError, applyPromo, removePromo, clearPromoError } = useCart()
  const [code, setCode] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || promoPending) return
    // Only clear the box on success. Keeping a rejected code visible lets the
    // shopper see the typo they made rather than retype from memory — and
    // `promoError` names the code, so a cleared field would orphan the message.
    // applyPromo reports failure by return value, not by throwing: an unknown
    // code is an ordinary outcome, and every caller renders it inline.
    const entered = code
    if (await applyPromo(entered)) setCode((current) => (current === entered ? '' : current))
  }

  return (
    <div className={className}>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="promo-code" className="sr-only">
          Promo code
        </label>
        <input
          id="promo-code"
          name="promo-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (promoError) clearPromoError()
          }}
          placeholder="Promo code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(promoError)}
          aria-describedby={promoError ? 'promo-code-error' : undefined}
          className="flex-1 min-w-0 rounded-full border border-[var(--line-4)] bg-[var(--paper)] px-4 py-2.5 text-sm uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--ink)] transition-colors"
        />
        <button
          type="submit"
          disabled={!code.trim() || promoPending}
          className="flex-shrink-0 rounded-full border border-[var(--ink)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--ink)] cursor-pointer"
        >
          {promoPending ? 'Applying…' : 'Apply'}
        </button>
      </form>

      {promoError && (
        <p id="promo-code-error" role="alert" className="mt-2 text-xs text-[#ef4444]">
          {promoError}
        </p>
      )}

      {promoCodes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {promoCodes.map((applied) => (
            <li
              key={applied}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f7a4a]/10 border border-[#0f7a4a]/30 pl-3 pr-1.5 py-1 text-xs text-[#0f7a4a]"
            >
              <span className="font-medium uppercase tracking-wide">{applied}</span>
              <button
                type="button"
                onClick={() => removePromo(applied)}
                disabled={promoPending}
                aria-label={`Remove promo code ${applied}`}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#0f7a4a]/20 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
