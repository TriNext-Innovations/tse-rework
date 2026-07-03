'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

export default function ProfilePage() {
  const { customer, token, refreshCustomer } = useAuth()

  const [form, setForm] = useState({
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    phone: customer?.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND}/store/customers/me`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-publishable-api-key': PUB_KEY,
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to save changes')
        return
      }
      await refreshCustomer()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  function inputClass(hasError = false) {
    return `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${hasError ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`
  }

  return (
    <div>
      <h2 className="font-display font-light text-3xl mb-6">Profile</h2>

      <div className="bg-[var(--surface)] rounded-[20px] p-6 sm:p-8">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Email address</label>
            <input
              type="email"
              value={customer?.email ?? ''}
              disabled
              className="w-full px-4 py-3 rounded-[12px] border border-[var(--line-3)] bg-[var(--paper)] text-sm text-[var(--muted)] cursor-not-allowed"
            />
            <p className="text-[11px] text-[var(--muted-2)] mt-1">Email cannot be changed. Contact us if you need to update it.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">First name</label>
              <input
                type="text"
                autoComplete="given-name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Last name</label>
              <input
                type="text"
                autoComplete="family-name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className={inputClass()}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
              Phone <span className="normal-case text-[var(--muted-2)]">(optional)</span>
            </label>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="082 123 4567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass()}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{error}</p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-[var(--ink)] text-[var(--paper)] rounded-full px-6 py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
