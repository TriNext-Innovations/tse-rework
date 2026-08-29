'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''

type LineItem = { id: number; sku: string; description: string; qty: string }

let nextId = 1

function emptyLine(): LineItem {
  return { id: nextId++, sku: '', description: '', qty: '' }
}

export default function QuotePage() {
  const router = useRouter()
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryArea, setDeliveryArea] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([emptyLine()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  function addLine() { setItems((prev) => [...prev, emptyLine()]) }
  function removeLine(id: number) { setItems((prev) => prev.filter((i) => i.id !== id)) }
  function updateLine(id: number, field: keyof Omit<LineItem, 'id'>, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!company.trim()) errs.company = 'Required'
    if (!contact.trim()) errs.contact = 'Required'
    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) errs.email = 'Valid email required'
    if (!phone.trim()) errs.phone = 'Required'
    const validItems = items.filter((i) => i.description.trim())
    if (!validItems.length) errs.items = 'Add at least one item'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setApiError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/store/b2b/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY },
        body: JSON.stringify({
          company_name: company,
          contact_name: contact,
          email,
          phone,
          delivery_area: deliveryArea,
          items: items
            .filter((i) => i.description.trim())
            .map((i) => ({ sku: i.sku.trim(), description: i.description.trim(), qty: Number(i.qty) || 1 })),
          notes,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setApiError(d.error ?? 'Submission failed — please try again')
        return
      }
      router.push('/b2b/confirmed?type=quote')
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (key: string) =>
    `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${errors[key] ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 pt-32 pb-16">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Link href="/b2b" className="hover:text-[var(--ink)] transition-colors">B2B</Link>
          <span>/</span>
          <span className="text-[var(--ink)]">Request a quote</span>
        </div>

        <div className="mb-10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Pricing</div>
          <h1 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95]">
            Request a <span className="font-display-italic">quote</span>.
          </h1>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Tell us what you need and we'll come back within 2 business hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Contact details */}
          <div className="bg-[var(--surface)] rounded-[20px] p-6 sm:p-7 space-y-5">
            <h2 className="font-display text-lg font-light">Your details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Company name</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Office Supplies" className={inputCls('company')} />
                {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Contact name</label>
                <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Jane Smith" className={inputCls('contact')} />
                {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Work email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.co.za" className={inputCls('email')} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="011 234 5678" className={inputCls('phone')} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">
                Delivery area <span className="normal-case text-[var(--muted-2)]">(optional)</span>
              </label>
              <input type="text" value={deliveryArea} onChange={(e) => setDeliveryArea(e.target.value)} placeholder="Randburg, Johannesburg" className={inputCls('deliveryArea')} />
            </div>
          </div>

          {/* Line items */}
          <div className="bg-[var(--surface)] rounded-[20px] p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-light">Items needed</h2>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add row
              </button>
            </div>

            {errors.items && <p className="text-xs text-red-500 mb-3">{errors.items}</p>}

            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-3 mb-2">
              <div className="col-span-3 text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)]">SKU (optional)</div>
              <div className="col-span-6 text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)]">Description / Product</div>
              <div className="col-span-2 text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)]">Qty</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 sm:gap-3 items-start">
                  <div className="col-span-12 sm:col-span-3">
                    {idx === 0 && <label className="sm:hidden block text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)] mb-1">SKU</label>}
                    <input
                      type="text"
                      value={item.sku}
                      onChange={(e) => updateLine(item.id, 'sku', e.target.value)}
                      placeholder="CRG-737"
                      className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--line-4)] bg-[var(--paper)] text-sm outline-none focus:border-[var(--ink)] transition-colors"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    {idx === 0 && <label className="sm:hidden block text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)] mb-1">Description</label>}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                      placeholder="Canon 737 Black Toner"
                      className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--line-4)] bg-[var(--paper)] text-sm outline-none focus:border-[var(--ink)] transition-colors"
                    />
                  </div>
                  <div className="col-span-10 sm:col-span-2">
                    {idx === 0 && <label className="sm:hidden block text-[10px] uppercase tracking-[0.15em] text-[var(--muted-2)] mb-1">Qty</label>}
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateLine(item.id, 'qty', e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--line-4)] bg-[var(--paper)] text-sm outline-none focus:border-[var(--ink)] transition-colors"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end pt-1 sm:pt-0">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 transition-colors text-[var(--muted-2)] cursor-pointer"
                        aria-label="Remove row"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="mt-4 w-full py-2.5 rounded-[10px] border border-dashed border-[var(--line-4)] text-xs text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              + Add another item
            </button>
          </div>

          {/* Notes */}
          <div className="bg-[var(--surface)] rounded-[20px] p-6 sm:p-7">
            <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">
              Additional notes <span className="normal-case text-[var(--muted-2)]">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery frequency, account terms, anything else we should know…"
              className="w-full px-4 py-3 rounded-[12px] border border-[var(--line-4)] bg-[var(--surface)] text-sm outline-none focus:border-[var(--ink)] transition-colors resize-none"
            />
          </div>

          {apiError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{apiError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--ink)] text-[var(--paper)] rounded-full py-3.5 text-sm font-medium hover:bg-[#dfe344] hover:text-[var(--on-accent)] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Sending quote request…' : 'Send quote request'}
          </button>
          <p className="text-[11px] text-center text-[var(--muted-2)]">We respond within 2 business hours.</p>
        </form>
      </div>
    </div>
  )
}
