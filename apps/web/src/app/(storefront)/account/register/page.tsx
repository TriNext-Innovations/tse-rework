'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { useAuth } from '@/contexts/AuthContext'

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

export default function RegisterPage() {
  const { register, addAddress } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '',
  })
  const [address, setAddress] = useState({
    line1: '', suburb: '', city: '', province: '', postalCode: '',
  })
  const [errors, setErrors] = useState<Partial<typeof form & typeof address & { general: string }>>({})
  const [loading, setLoading] = useState(false)

  // The address block is optional — but once any field is filled, the rest
  // must be completed so we don't save a half-address to the account.
  const addressStarted = Object.values(address).some((v) => v.trim() !== '')

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = 'Valid email required'
    if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    if (addressStarted) {
      if (!address.line1.trim()) errs.line1 = 'Required'
      if (!address.city.trim()) errs.city = 'Required'
      if (!address.province) errs.province = 'Required'
      if (!address.postalCode.trim() || !/^\d{4}$/.test(address.postalCode)) errs.postalCode = '4-digit code required'
    }
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
    if (err) { setLoading(false); setErrors({ general: err }); return }

    // Save the delivery address (if given) as the account's default. A failure
    // here shouldn't block the signup — the account exists; the address can be
    // added later under Account → Addresses.
    if (addressStarted) {
      await addAddress({
        address_1: address.line1.trim(),
        address_2: address.suburb.trim() || undefined,
        city: address.city.trim(),
        province: address.province,
        postal_code: address.postalCode.trim(),
        phone: form.phone.trim() || undefined,
        is_default_shipping: true,
      })
    }
    setLoading(false)
    router.push('/account/orders')
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
      className: inputClass(errors[key]),
    }
  }

  function inputClass(err?: string) {
    return `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${err ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`
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

          {/* ── Optional delivery address — saved as the account default ── */}
          <div className="border-t border-[var(--line-2)] pt-5 mt-6">
            <h2 className="text-xs font-medium text-[var(--ink-2)] uppercase tracking-[0.12em] mb-1.5">
              Delivery address <span className="normal-case text-[var(--muted-2)]">(optional — speeds up checkout)</span>
            </h2>
            <div className="space-y-4 mt-3">
              <div>
                <AddressAutocomplete
                  value={address.line1}
                  placeholder="Start typing your address…"
                  autoComplete="address-line1"
                  className={inputClass(errors.line1)}
                  onChange={(v) => setAddress((a) => ({ ...a, line1: v }))}
                  onSelect={(p) =>
                    setAddress((a) => ({
                      ...a,
                      line1: p.line1 ?? a.line1,
                      suburb: p.suburb ?? a.suburb,
                      city: p.city ?? a.city,
                      province: p.province && SA_PROVINCES.includes(p.province) ? p.province : a.province,
                      postalCode: p.postalCode ?? a.postalCode,
                    }))
                  }
                />
                {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1}</p>}
              </div>
              {addressStarted && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text" autoComplete="address-level3" placeholder="Suburb"
                        value={address.suburb}
                        onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <input
                        type="text" autoComplete="address-level2" placeholder="City"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        className={inputClass(errors.city)}
                      />
                      {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <select
                        autoComplete="address-level1"
                        value={address.province}
                        onChange={(e) => setAddress({ ...address, province: e.target.value })}
                        className={inputClass(errors.province)}
                      >
                        <option value="">Select province</option>
                        {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {errors.province && <p className="text-xs text-red-500 mt-1">{errors.province}</p>}
                    </div>
                    <div>
                      <input
                        type="text" autoComplete="postal-code" placeholder="Postal code" maxLength={4}
                        value={address.postalCode}
                        onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                        className={inputClass(errors.postalCode)}
                      />
                      {errors.postalCode && <p className="text-xs text-red-500 mt-1">{errors.postalCode}</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
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
