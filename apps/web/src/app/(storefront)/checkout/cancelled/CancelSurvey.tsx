'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY  = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const REASONS: { value: string; label: string }[] = [
  { value: 'payment_method_unsupported', label: 'My payment method isn’t supported' },
  { value: 'unexpected_costs', label: 'The total or delivery cost was higher than expected' },
  { value: 'comparing_prices', label: 'I’m still comparing prices' },
  { value: 'technical_problem', label: 'Something went wrong technically' },
  { value: 'changed_mind', label: 'I changed my mind' },
  { value: 'other', label: 'Other' },
]

export function CancelSurvey() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  const toggle = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const submit = async () => {
    if (state !== 'idle' || (!selected.size && !message.trim())) return
    setState('sending')
    try {
      await fetch(`${BACKEND}/store/payment-surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY },
        body: JSON.stringify({
          reasons: [...selected],
          message: message.trim() || undefined,
          m_payment_id: searchParams.get('ref') ?? undefined,
        }),
      })
    } catch {
      // Fire-and-forget: the survey must never get in the customer's way.
    }
    setState('done')
  }

  return (
    <>
      {state === 'done' ? (
        <div className="bg-[var(--surface)] rounded-[20px] p-6 mb-8">
          <p className="text-sm font-medium">Thank you — that helps us improve.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-[20px] p-6 text-left mb-8">
          <p className="text-sm font-medium mb-1">Mind telling us why? <span className="font-normal text-[var(--muted)]">(optional)</span></p>
          <p className="text-xs text-[var(--muted)] mb-4">Tick anything that applies — it helps us fix what got in your way.</p>

          <fieldset className="space-y-1" disabled={state === 'sending'}>
            <legend className="sr-only">Why didn&apos;t you complete your payment?</legend>
            {REASONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-3 min-h-[44px] px-2 -mx-2 rounded-lg cursor-pointer hover:bg-[var(--paper)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(value)}
                  onChange={() => toggle(value)}
                  className="w-4 h-4 accent-[var(--ink)] shrink-0"
                />
                <span className="text-sm text-[var(--ink-2)]">{label}</span>
              </label>
            ))}
          </fieldset>

          <label className="block mt-4">
            <span className="text-xs text-[var(--muted)]">Anything else? (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={2}
              disabled={state === 'sending'}
              className="mt-1 w-full rounded-lg border border-[var(--line-4)] bg-[var(--paper)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--line-7)] transition-colors resize-none"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={state === 'sending' || (!selected.size && !message.trim())}
            className="mt-4 inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-full bg-[var(--ink)] text-[var(--paper)] text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {state === 'sending' ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/checkout"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--paper)] text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors"
        >
          Return to checkout
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-full border border-[var(--line-4)] text-sm text-[var(--ink-2)] hover:border-[var(--line-7)] transition-colors"
        >
          Continue shopping
        </Link>
      </div>
    </>
  )
}
