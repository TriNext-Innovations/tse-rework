'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '',
  })
  const [errors, setErrors] = useState<Partial<typeof form & { general: string }>>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = 'Valid email required'
    if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const err = await register({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim() || undefined,
    })
    setLoading(false)
    if (err) { setErrors({ general: err }); return }
    router.push('/account/orders')
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
      className: `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${errors[key] ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`,
    }
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
            Create an <span className="font-display-italic">account</span>.
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Already registered?{' '}
            <Link href="/account/login" className="underline underline-offset-4 hover:text-[var(--ink)] transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">First name</label>
              <input type="text" autoComplete="given-name" placeholder="Jane" {...field('first_name')} />
              {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Last name</label>
              <input type="text" autoComplete="family-name" placeholder="Smith" {...field('last_name')} />
              {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Email address</label>
            <input type="email" autoComplete="email" placeholder="jane@example.com" {...field('email')} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
              Phone <span className="normal-case text-[var(--muted-2)]">(optional)</span>
            </label>
            <input type="tel" autoComplete="tel" placeholder="082 123 4567" {...field('phone')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Password</label>
            <input type="password" autoComplete="new-password" placeholder="Minimum 8 characters" {...field('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Confirm password</label>
            <input type="password" autoComplete="new-password" placeholder="••••••••" {...field('confirm')} />
            {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
          </div>

          {errors.general && (
            <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{errors.general}</p>
          )}

          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            By creating an account you agree to our{' '}
            <Link href="/legal/privacy" className="underline underline-offset-2">privacy policy</Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--ink)] text-[var(--paper)] rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
