'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'

const TIERS = [
  {
    name: 'Standard',
    discount: null,
    desc: 'No account required. Order online or by phone at regular pricing.',
    for: ['Home users', 'Occasional buyers'],
    cta: null,
    highlight: false,
  },
  {
    name: 'Reseller',
    discount: '15% off',
    desc: 'For IT resellers, office managers, and SMEs with regular monthly spend.',
    for: ['IT resellers', 'Office managers', 'SMEs (R2 000+/mo)'],
    cta: 'Apply for Reseller',
    highlight: false,
  },
  {
    name: 'Wholesale',
    discount: '25% off',
    desc: 'For print shops, large corporates, and distributors with high-volume needs.',
    for: ['Print shops', 'Large corporates', 'Distributors (R5 000+/mo)'],
    cta: 'Apply for Wholesale',
    highlight: true,
  },
]

type Form = {
  company_name: string; contact_name: string; email: string; phone: string
  business_type: string; monthly_volume: string; message: string
}
const EMPTY: Form = {
  company_name: '', contact_name: '', email: '', phone: '',
  business_type: '', monthly_volume: '', message: '',
}

export default function B2BPage() {
  const router = useRouter()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form>>({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  function validate(): boolean {
    const errs: Partial<Form> = {}
    if (!form.company_name.trim()) errs.company_name = 'Required'
    if (!form.contact_name.trim()) errs.contact_name = 'Required'
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = 'Valid email required'
    if (!form.phone.trim()) errs.phone = 'Required'
    if (!form.business_type) errs.business_type = 'Required'
    if (!form.monthly_volume) errs.monthly_volume = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setApiError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/store/b2b/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setApiError(d.error ?? 'Submission failed — please try again')
        return
      }
      router.push('/b2b/confirmed')
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function f(key: keyof Form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [key]: e.target.value }),
      className: `w-full px-4 py-3 rounded-[12px] border bg-white text-sm outline-none transition-colors ${errors[key] ? 'border-red-400' : 'border-black/15 focus:border-[#111827]'}`,
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111827]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />

      {/* ── Hero ── */}
      <section className="px-4 sm:px-8 lg:px-12 pt-32 pb-16 relative overflow-hidden">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#6B6B66] mb-4">Business accounts</div>
            <h1 className="font-display font-light text-[13vw] sm:text-[9vw] lg:text-[7vw] leading-[0.9] tracking-[-0.03em]">
              Print smarter.<br />
              <span className="font-display-italic text-[#41e0f5]">Pay less.</span>
            </h1>
            <p className="mt-8 max-w-xl text-[15px] text-[#374151] leading-relaxed">
              Volume pricing for offices, IT resellers, print shops, and schools.
              Get up to 25% off all cartridges — with same next-day delivery to Johannesburg and Pretoria.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#apply" className="inline-flex items-center gap-2 bg-[#111827] text-white rounded-full pl-6 pr-2 py-2.5 text-sm font-semibold hover:bg-[#dfe344] hover:text-[#111827] transition-colors">
                Apply for B2B pricing
                <span className="inline-flex items-center justify-center w-9 h-9 bg-white/20 rounded-full">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </a>
              <Link href="/b2b/quote" className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-[6px] decoration-1 hover:text-[#41e0f5] transition-colors">
                Request a quote
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 grid grid-cols-3 gap-3">
            {[
              { stat: '25%', label: 'Max discount' },
              { stat: '<2h', label: 'Quote turnaround' },
              { stat: 'COD', label: 'JHB/PTA option' },
            ].map(({ stat, label }) => (
              <div key={label} className="bg-white rounded-[20px] p-5 text-center">
                <div className="font-display text-3xl font-light">{stat}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B6B66] mt-2">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing tiers ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6B6B66] mb-3">Pricing tiers</div>
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95] mb-10">
            Which tier fits <span className="font-display-italic">your business?</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-[24px] p-7 flex flex-col ${
                  tier.highlight
                    ? 'bg-[#111827] text-white'
                    : 'bg-white text-[#111827]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-60">{tier.name}</div>
                  {tier.discount && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tier.highlight ? 'bg-[#dfe344] text-[#111827]' : 'bg-[#dfe344]/20 text-[#111827]'}`}>
                      {tier.discount}
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed mb-5 flex-1 ${tier.highlight ? 'text-white/70' : 'text-[#374151]'}`}>
                  {tier.desc}
                </p>
                <ul className="space-y-1.5 mb-6">
                  {tier.for.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-xs ${tier.highlight ? 'text-white/60' : 'text-[#6B6B66]'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {tier.cta ? (
                  <a href="#apply" className={`text-center text-sm font-medium py-3 rounded-full transition-colors ${tier.highlight ? 'bg-white text-[#111827] hover:bg-[#dfe344]' : 'border border-black/15 hover:border-[#111827]'}`}>
                    {tier.cta}
                  </a>
                ) : (
                  <Link href="/products" className="text-center text-sm text-[#6B6B66] hover:text-[#111827] transition-colors py-3 rounded-full border border-black/10 hover:border-black/30">
                    Shop now
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Application form ── */}
      <section id="apply" className="px-4 sm:px-8 lg:px-12 py-16 scroll-mt-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6B6B66] mb-3">Apply</div>
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95] mb-3">
            Get started in <span className="font-display-italic">minutes</span>.
          </h2>
          <p className="text-sm text-[#6B6B66] mb-10">
            Fill in the form — we'll review your application and contact you within 1 business day.
          </p>

          <form onSubmit={handleSubmit} noValidate className="bg-white rounded-[24px] p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Company name</label>
                <input type="text" placeholder="Acme Office Supplies" {...f('company_name')} />
                {errors.company_name && <p className="text-xs text-red-500 mt-1">{errors.company_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Contact name</label>
                <input type="text" placeholder="Jane Smith" {...f('contact_name')} />
                {errors.contact_name && <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Work email</label>
                <input type="email" placeholder="jane@acme.co.za" {...f('email')} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Phone</label>
                <input type="tel" placeholder="011 234 5678" {...f('phone')} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Business type</label>
                <select {...f('business_type')}>
                  <option value="">Select type</option>
                  <option>IT Reseller</option>
                  <option>Office Manager / Admin</option>
                  <option>Print Shop</option>
                  <option>School / University</option>
                  <option>Government / Municipality</option>
                  <option>Other</option>
                </select>
                {errors.business_type && <p className="text-xs text-red-500 mt-1">{errors.business_type}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">Est. monthly spend</label>
                <select {...f('monthly_volume')}>
                  <option value="">Select range</option>
                  <option>R500 – R2 000</option>
                  <option>R2 000 – R5 000</option>
                  <option>R5 000 – R10 000</option>
                  <option>R10 000+</option>
                </select>
                {errors.monthly_volume && <p className="text-xs text-red-500 mt-1">{errors.monthly_volume}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[#374151] mb-1.5">
                Message <span className="normal-case text-[#9ca3af]">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Which printers do you use? Any specific SKUs you need regularly?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-3 rounded-[12px] border border-black/15 bg-white text-sm outline-none focus:border-[#111827] transition-colors resize-none"
              />
            </div>

            {apiError && (
              <p className="text-sm text-red-500 bg-red-50 rounded-[10px] px-4 py-3">{apiError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#dfe344] hover:text-[#111827] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Sending application…' : 'Submit application'}
            </button>
            <p className="text-[11px] text-[#9ca3af] text-center">
              We respond within 1 business day. No spam, ever.
            </p>
          </form>
        </div>
      </section>

      {/* ── Process ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-display font-light text-3xl sm:text-4xl tracking-tight mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Apply', body: 'Fill in the form above. We review every application manually — usually same business day.' },
              { step: '02', title: 'Get approved', body: "We set up your account with the right pricing tier. You'll shop at your discount automatically." },
              { step: '03', title: 'Order and save', body: 'Order online, by phone, or WhatsApp. Next-day delivery JHB/PTA — COD available for our own drivers.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="border-t-2 border-[#dfe344] pt-5">
                <div className="font-display text-5xl font-light text-[#dfe344] leading-none mb-4">{step}</div>
                <h3 className="font-display text-xl font-light mb-2">{title}</h3>
                <p className="text-sm text-[#374151] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-12">
        <div className="mx-auto max-w-7xl bg-[#111827] text-white rounded-[28px] p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <h3 className="font-display font-light text-3xl sm:text-4xl leading-tight">
              Need pricing fast? <span className="font-display-italic text-[#dfe344]">Call us.</span>
            </h3>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
            <a href="tel:0117082304" className="inline-flex items-center justify-center gap-2 bg-white text-[#111827] hover:bg-[#dfe344] rounded-full px-5 py-3 text-sm font-medium transition-colors">
              011 708 2304
            </a>
            <Link href="/b2b/quote" className="inline-flex items-center justify-center gap-2 border border-white/30 hover:bg-white/10 rounded-full px-5 py-3 text-sm transition-colors">
              Request a quote →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
