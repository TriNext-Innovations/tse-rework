'use client'

import { useState } from 'react'
import {
  TRACKING_STAGES,
  isTrackingException,
  trackingStatusLabel,
  type TrackingResult,
  type TrackingStage,
} from '@tse/types'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Timeline({ result }: { result: TrackingResult }) {
  // An exception is not a point on the line — a returned parcel has left the
  // happy path entirely, so the stepper would misrepresent it.
  if (isTrackingException(result.status)) {
    return (
      <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--paper-2)] p-6">
        <p className="font-semibold mb-1">{trackingStatusLabel(result.status)}</p>
        <p className="text-sm text-[var(--ink)]/70">
          Something went wrong with this delivery. Please contact us and we&apos;ll sort it out.
        </p>
      </div>
    )
  }

  const currentIndex = TRACKING_STAGES.indexOf(result.status as TrackingStage)

  return (
    <ol className="relative">
      {TRACKING_STAGES.map((stage, i) => {
        const done = i <= currentIndex
        const current = i === currentIndex
        const event = [...result.events].reverse().find((e) => e.status === stage)
        return (
          <li key={stage} className="relative pl-9 pb-7 last:pb-0">
            {i < TRACKING_STAGES.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[7px] top-4 bottom-0 w-px ${
                  i < currentIndex ? 'bg-[var(--magenta)]' : 'bg-[var(--ink)]/15'
                }`}
              />
            )}
            <span
              aria-hidden
              className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 ${
                done
                  ? 'bg-[var(--magenta)] border-[var(--magenta)]'
                  : 'bg-[var(--paper)] border-[var(--ink)]/25'
              }`}
            />
            <p className={`text-sm ${current ? 'font-semibold' : done ? '' : 'text-[var(--ink)]/45'}`}>
              {trackingStatusLabel(stage)}
              {current && <span className="sr-only"> — current status</span>}
            </p>
            {event?.date && (
              <p className="text-xs text-[var(--ink)]/55 mt-0.5">{formatDate(event.date)}</p>
            )}
            {event?.description && (
              <p className="text-xs text-[var(--ink)]/70 mt-0.5">{event.description}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function TrackClient() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TrackingResult | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${BACKEND}/store/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY },
        body: JSON.stringify({ order_number: orderNumber, email }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? 'Something went wrong. Please try again.')
        return
      }
      setResult(body as TrackingResult)
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 mb-10">
        <div className="sm:col-span-1">
          <label htmlFor="order-number" className="block text-xs uppercase tracking-[0.16em] text-[var(--ink)]/60 mb-2">
            Order number
          </label>
          <input
            id="order-number"
            name="order_number"
            inputMode="numeric"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. 1042"
            className="w-full rounded-full border border-[var(--ink)]/20 bg-[var(--paper)] px-5 py-3 text-sm outline-none focus:border-[var(--magenta)]"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="email" className="block text-xs uppercase tracking-[0.16em] text-[var(--ink)]/60 mb-2">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-full border border-[var(--ink)]/20 bg-[var(--paper)] px-5 py-3 text-sm outline-none focus:border-[var(--magenta)]"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--magenta)] text-[var(--on-accent)] px-6 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Looking up…' : 'Track my parcel'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {error && (
          <div role="alert" className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--paper-2)] p-6 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--paper-2)] p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
              <h2 className="text-lg font-semibold">Order #{result.order_number}</h2>
              <p className="text-xs text-[var(--ink)]/55">Placed {formatDate(result.order_date)}</p>
            </div>

            {!result.live_tracking_available && (
              <p className="text-sm text-[var(--ink)]/70 mb-6">
                {result.tracking_reference
                  ? "We couldn't reach the courier just now. Your waybill number is below — the courier's own tracking page will have the latest."
                  : "Your order is being picked and packed. We'll email you a tracking number as soon as it's collected."}
              </p>
            )}

            <Timeline result={result} />

            {result.tracking_reference && (
              <div className="mt-7 pt-6 border-t border-[var(--ink)]/10 text-sm">
                <p className="text-[var(--ink)]/60 text-xs uppercase tracking-[0.16em] mb-1">Waybill</p>
                <p className="font-mono">{result.tracking_reference}</p>
                {result.tracking_url && (
                  <a
                    href={result.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 underline underline-offset-4 hover:text-[var(--magenta)]"
                  >
                    View on The Courier Guy
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
