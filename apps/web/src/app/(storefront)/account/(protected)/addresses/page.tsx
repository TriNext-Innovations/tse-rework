'use client'

import { useState } from 'react'
import { useAuth, type CustomerAddress } from '@/contexts/AuthContext'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

// address_2 is the suburb (checkout convention); company is the complex/
// building/room detail printed on the courier waybill.
type AddressForm = {
  first_name: string; last_name: string; phone: string
  address_1: string; address_2: string; company: string; city: string; province: string; postal_code: string
}

const EMPTY: AddressForm = {
  first_name: '', last_name: '', phone: '',
  address_1: '', address_2: '', company: '', city: '', province: '', postal_code: '',
}

export default function AddressesPage() {
  const { customer, token, refreshCustomer, setDefaultAddress } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddressForm>(EMPTY)
  const [errors, setErrors] = useState<Partial<AddressForm>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)
  const [apiError, setApiError] = useState('')

  function validate(): boolean {
    const errs: Partial<AddressForm> = {}
    if (!form.address_1.trim()) errs.address_1 = 'Required'
    if (!form.city.trim()) errs.city = 'Required'
    if (!form.province) errs.province = 'Required'
    if (!form.postal_code.trim() || !/^\d{4}$/.test(form.postal_code)) errs.postal_code = '4-digit code required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function authHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-publishable-api-key': PUB_KEY,
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !token) return
    setSaving(true)
    setApiError('')
    try {
      const res = await fetch(`${BACKEND}/store/customers/me/addresses`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          first_name: form.first_name.trim() || customer?.first_name,
          last_name: form.last_name.trim() || customer?.last_name,
          phone: form.phone.trim() || customer?.phone,
          address_1: form.address_1.trim(),
          address_2: form.address_2.trim() || undefined,
          company: form.company.trim() || undefined,
          city: form.city.trim(),
          province: form.province,
          postal_code: form.postal_code.trim(),
          country_code: 'ZA',
          // First address on the account becomes the default automatically.
          ...(addresses.length === 0 ? { is_default_shipping: true } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setApiError(d.message ?? 'Failed to save address')
        return
      }
      await refreshCustomer()
      setForm(EMPTY)
      setShowForm(false)
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault(addressId: string) {
    setSettingDefault(addressId)
    setApiError('')
    const err = await setDefaultAddress(addressId)
    if (err) setApiError(err)
    setSettingDefault(null)
  }

  async function handleDelete(addressId: string) {
    if (!token) return
    setDeleting(addressId)
    try {
      await fetch(`${BACKEND}/store/customers/me/addresses/${addressId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      await refreshCustomer()
    } catch {}
    setDeleting(null)
  }

  const addresses: CustomerAddress[] = customer?.addresses ?? []

  function inputClass(err?: string) {
    return `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${err ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-light text-3xl">Addresses</h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setApiError(''); setErrors({}) }}
            className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] rounded-full px-4 py-2 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add address
          </button>
        )}
      </div>

      {/* Address list */}
      {addresses.length === 0 && !showForm && (
        <div className="bg-[var(--surface)] rounded-[20px] p-8 text-center">
          <div className="text-3xl mb-3">📍</div>
          <h3 className="font-display text-lg font-light mb-2">No saved addresses</h3>
          <p className="text-sm text-[var(--muted)] mb-5">Add a delivery address to speed up checkout next time.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] rounded-full px-5 py-2.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors cursor-pointer"
          >
            Add address
          </button>
        </div>
      )}

      {addresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-[var(--surface)] rounded-[20px] p-5 relative">
              <div className="text-sm space-y-0.5">
                {addr.is_default_shipping && (
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#dfe344] text-[#111827] px-2 py-0.5 rounded-full mb-1.5">
                    Default
                  </span>
                )}
                {(addr.first_name || addr.last_name) && (
                  <div className="font-medium">{[addr.first_name, addr.last_name].filter(Boolean).join(' ')}</div>
                )}
                <div className="text-[var(--ink-2)]">{addr.address_1}</div>
                {addr.company && <div className="text-[var(--ink-2)]">{addr.company}</div>}
                {addr.address_2 && <div className="text-[var(--ink-2)]">{addr.address_2}</div>}
                <div className="text-[var(--ink-2)]">{addr.city}</div>
                {addr.province && <div className="text-[var(--muted)]">{addr.province} {addr.postal_code}</div>}
                {addr.phone && <div className="text-[var(--muted)] text-xs mt-1">{addr.phone}</div>}
              </div>
              {!addr.is_default_shipping && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  disabled={settingDefault === addr.id}
                  className="mt-3 text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-40"
                >
                  {settingDefault === addr.id ? 'Setting default…' : 'Make default'}
                </button>
              )}
              <button
                onClick={() => handleDelete(addr.id)}
                disabled={deleting === addr.id}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 transition-colors text-[var(--muted-2)] cursor-pointer disabled:opacity-40"
                aria-label="Delete address"
              >
                {deleting === addr.id ? (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add address form */}
      {showForm && (
        <div className="bg-[var(--surface)] rounded-[20px] p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl font-light">New address</h3>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY); setErrors({}) }}
              className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">First name</label>
                <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputClass()} placeholder={customer?.first_name ?? ''} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Last name</label>
                <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputClass()} placeholder={customer?.last_name ?? ''} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Street address</label>
              <input type="text" autoComplete="address-line1" placeholder="12 Acacia Street" value={form.address_1} onChange={(e) => setForm({ ...form, address_1: e.target.value })} className={inputClass(errors.address_1)} />
              {errors.address_1 && <p className="text-xs text-red-500 mt-1">{errors.address_1}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
                Complex / building <span className="normal-case text-[var(--muted-2)]">(optional)</span>
              </label>
              <input type="text" autoComplete="address-line2" placeholder="Unit 4, Sunset Villas" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
                Suburb <span className="normal-case text-[var(--muted-2)]">(optional)</span>
              </label>
              <input type="text" autoComplete="address-level3" placeholder="Randburg" value={form.address_2} onChange={(e) => setForm({ ...form, address_2: e.target.value })} className={inputClass()} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass(errors.city)} placeholder="Johannesburg" />
                {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Province</label>
                <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={inputClass(errors.province)}>
                  <option value="">Select</option>
                  {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.province && <p className="text-xs text-red-500 mt-1">{errors.province}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Postal code</label>
                <input type="text" maxLength={4} placeholder="2194" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={inputClass(errors.postal_code)} />
                {errors.postal_code && <p className="text-xs text-red-500 mt-1">{errors.postal_code}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
                Phone <span className="normal-case text-[var(--muted-2)]">(optional)</span>
              </label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass()} placeholder="082 123 4567" />
            </div>

            {apiError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{apiError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-[var(--ink)] text-[var(--paper)] rounded-full px-6 py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save address'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY); setErrors({}) }}
                className="px-6 py-3 rounded-full border border-[var(--line-4)] text-sm text-[var(--ink-2)] hover:border-[var(--line-7)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
