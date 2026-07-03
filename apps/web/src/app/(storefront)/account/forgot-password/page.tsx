'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    const err = await requestPasswordReset(email.trim())
    setLoading(false)
    if (err) { setError(err); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />

      <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20">
        <div className="text-center mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">My account</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Reset your <span className="font-display-italic">password</span>.
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Remembered it?{' '}
            <Link href="/account/login" className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        {sent ? (
          <div className="rounded-[16px] bg-[var(--surface)] border border-[var(--line-3)] px-6 py-8 text-center space-y-3">
            <div className="text-2xl">✉️</div>
            <p className="font-medium text-[var(--ink)]">Check your inbox</p>
            <p className="text-sm text-[var(--muted)]">
              If an account exists for <span className="font-medium text-[var(--ink)]">{email}</span>, you'll
              receive a password reset link shortly.
            </p>
            <Link
              href="/account/login"
              className="inline-block mt-4 text-sm underline underline-offset-4 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
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
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
