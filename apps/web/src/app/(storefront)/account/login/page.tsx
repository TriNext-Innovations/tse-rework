'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'
import { siteConfig } from '@/lib/site-config'

function LoginContent() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const passwordReset = searchParams.get('reset') === '1'
  // Post-login destination (e.g. /checkout). Internal paths only — a value
  // like "//evil.com" or "https://…" must not become an open redirect.
  const rawNext = searchParams.get('next') ?? ''
  const nextPath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account/orders'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Email and password are required'); return }
    setLoading(true)
    const err = await login(email.trim(), password)
    setLoading(false)
    if (err) { setError(err); return }
    router.push(nextPath)
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20">
      <div className="text-center mb-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">My account</div>
        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
          Welcome <span className="font-display-italic">back</span>.
        </h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Don't have an account?{' '}
          <Link href="/account/register" className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">
            Register
          </Link>
        </p>
      </div>

      {passwordReset && (
        <p className="mb-6 text-sm text-green-700 bg-green-50 rounded-[10px] px-4 py-3">
          Password updated — sign in with your new password.
        </p>
      )}

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
        <div>
          <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-[var(--muted)]">
        <Link href="/account/forgot-password" className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">
          Forgot password?
        </Link>
        <a href={siteConfig.email.mailto} className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">
          Contact us
        </a>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />
      <Suspense>
        <LoginContent />
      </Suspense>
    </div>
  )
}
