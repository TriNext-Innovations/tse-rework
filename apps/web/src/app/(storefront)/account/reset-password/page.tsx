'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'

// Best-effort client-side read of the JWT payload — purely to decide whether
// to show the form. Not a trust boundary: the signature isn't verified here,
// and the backend independently enforces expiry + single-use on submit
// (apps/backend — Medusa's validateToken middleware). This just avoids
// showing a live-looking password form for a link that's already dead.
function tokenLooksUsable(token: string): boolean {
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    // JWT payloads are base64url without padding — atob() requires padded
    // standard base64, so both translate the alphabet and restore the '='.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = JSON.parse(atob(padded))
    if (json.purpose !== 'reset') return false
    if (typeof json.exp !== 'number') return false
    return json.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function ResetPasswordContent() {
  const { resetPassword } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const tokenUsable = token.length > 0 && tokenLooksUsable(token)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const err = await resetPassword(token, password)
    setLoading(false)
    if (err) { setError(err); return }
    router.push('/account/login?reset=1')
  }

  if (!tokenUsable) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20 text-center space-y-4">
        <p className="text-sm text-[var(--muted)]">This reset link is invalid or has expired.</p>
        <Link
          href="/account/forgot-password"
          className="inline-block text-sm underline underline-offset-4 hover:text-[var(--ink)] transition-colors"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20">
      <div className="text-center mb-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">My account</div>
        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
          New <span className="font-display-italic">password</span>.
        </h1>
        <p className="mt-4 text-sm text-[var(--muted)]">Choose a strong password to secure your account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full px-4 py-3 rounded-[12px] border border-[var(--line-4)] bg-[var(--surface)] text-sm outline-none focus:border-[var(--ink)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
            Confirm password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-[12px] border border-[var(--line-4)] bg-[var(--surface)] text-sm outline-none focus:border-[var(--ink)] transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--ink)] text-[var(--paper)] rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors disabled:opacity-60 cursor-pointer mt-2"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />
      <Suspense>
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
