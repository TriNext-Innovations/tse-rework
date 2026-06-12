'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'

function ResetPasswordContent() {
  const { resetPassword } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

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

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20 text-center space-y-4">
        <p className="text-sm text-[#6B6B66]">This reset link is invalid or has expired.</p>
        <Link
          href="/account/forgot-password"
          className="inline-block text-sm underline underline-offset-4 hover:text-[#111827] transition-colors"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 pt-32 pb-20">
      <div className="text-center mb-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#6B6B66] mb-3">My account</div>
        <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
          New <span className="font-display-italic">password</span>.
        </h1>
        <p className="mt-4 text-sm text-[#6B6B66]">Choose a strong password to secure your account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full px-4 py-3 rounded-[12px] border border-black/15 bg-white text-sm outline-none focus:border-[#111827] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">
            Confirm password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-[12px] border border-black/15 bg-white text-sm outline-none focus:border-[#111827] transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors disabled:opacity-60 cursor-pointer mt-2"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
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
