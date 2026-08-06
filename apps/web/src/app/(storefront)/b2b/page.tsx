'use client'

import { useState } from 'react'
import Link from 'next/link'
import { B2B_MAX_PERCENT, B2B_MIN_THRESHOLD_RAND, B2B_TIERS, formatRand } from '@tse/types'
import { siteConfig } from '@/lib/site-config'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'

// The bands below are generated from the same constants the Medusa promotions
// are built from (`@tse/types`), so this page can't advertise a discount the
// store won't actually give. There is ONE account type — approval is what you
// apply for; the rate is then decided per order by its size.
const BANDS = [
  {
    range: `Under ${formatRand(B2B_MIN_THRESHOLD_RAND)}`,
    discount: null,
    desc: 'List price, same as everyone else. No account needed to order.',
    highlight: false,
  },
  ...B2B_TIERS.map((tier, i) => ({
    range:
      tier.maxRand === null
        ? `${formatRand(tier.minRand)} and up`
        : `${formatRand(tier.minRand)} – ${formatRand(tier.maxRand - 1)}`,
    discount: `${tier.percent}% off`,
    desc:
      tier.maxRand === null
        ? 'Bulk and stock-up orders. The best rate we do online.'
        : 'The typical monthly top-up order for an office or a small reseller.',
    highlight: i === B2B_TIERS.length - 1,
  })),
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

      {/* ── Hero ── */}
      <section className="px-4 sm:px-8 lg:px-12 pt-32 pb-16 relative overflow-hidden">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-4">Business accounts</div>
            <h1 className="font-display font-light text-[13vw] sm:text-[9vw] lg:text-[7vw] leading-[0.9] tracking-[-0.03em]">
              Print smarter.<br />
              <span className="font-display-italic text-[#41e0f5]">Pay less.</span>
            </h1>
            <p className="mt-8 max-w-xl text-[15px] text-[var(--ink-2)] leading-relaxed">
              Volume pricing for offices, IT resellers, print shops, and schools. Approved accounts
              get {B2B_TIERS[0]!.percent}% off orders from {formatRand(B2B_MIN_THRESHOLD_RAND)} and{' '}
              {B2B_MAX_PERCENT}% from {formatRand(B2B_TIERS[B2B_TIERS.length - 1]!.minRand)} — worked
              out automatically at checkout, with next-day delivery to Johannesburg and Pretoria.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#apply" className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] rounded-full pl-6 pr-2 py-2.5 text-sm font-semibold hover:bg-[#dfe344] hover:text-[var(--on-accent)] transition-colors">
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
              { stat: `${B2B_MAX_PERCENT}%`, label: 'Max discount' },
              { stat: '<2h', label: 'Quote turnaround' },
              { stat: 'COD', label: 'JHB/PTA option' },
            ].map(({ stat, label }) => (
              <div key={label} className="bg-[var(--surface)] rounded-[20px] p-5 text-center">
                <div className="font-display text-3xl font-light">{stat}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] mt-2">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing tiers ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Volume pricing</div>
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95] mb-4">
            One account. <span className="font-display-italic">The order decides the rate.</span>
          </h2>
          <p className="max-w-2xl text-sm text-[var(--ink-2)] leading-relaxed mb-10">
            There are no membership levels to negotiate. Once your business account is approved,
            every order is priced on its own size — so a big month earns the bigger discount without
            you asking for it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BANDS.map((band) => (
              <div
                key={band.range}
                className={`rounded-[24px] p-7 flex flex-col ${
                  band.highlight
                    ? 'panel-dark bg-[var(--ink)] text-[var(--paper)]'
                    : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-2)]'
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-3">Order total</div>
                <div className="font-display font-light text-2xl leading-tight mb-4">{band.range}</div>
                <div className="mb-5">
                  {band.discount ? (
                    <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${band.highlight ? 'bg-[#dfe344] text-[var(--ink)]' : 'bg-[#dfe344]/20 text-[var(--ink)]'}`}>
                      {band.discount}
                    </span>
                  ) : (
                    <span className={`text-sm px-3 py-1.5 rounded-full border ${band.highlight ? 'border-white/25 text-white/60' : 'border-[var(--line-4)] text-[var(--muted)]'}`}>
                      List price
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed flex-1 ${band.highlight ? 'text-white/70' : 'text-[var(--ink-2)]'}`}>
                  {band.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                t: 'Measured on goods, incl. VAT',
                b: 'The order total that counts is the cartridges themselves — delivery is excluded, and VAT is already in the price you see.',
              },
              {
                t: 'One rate per order',
                b: 'The bands do not stack. Cross a threshold and the whole order moves up to the better rate.',
              },
              {
                t: 'Sign in to get it',
                b: 'The discount is tied to your approved account, so check out signed in — a guest checkout pays list price.',
              },
            ].map(({ t, b }) => (
              <div key={t} className="border-t border-[var(--line-3)] pt-4">
                <h3 className="text-sm font-medium mb-1.5">{t}</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Application form ── */}
      <section id="apply" className="px-4 sm:px-8 lg:px-12 py-16 scroll-mt-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-3">Apply</div>
          <h2 className="font-display font-light text-4xl sm:text-5xl tracking-tight leading-[0.95] mb-3">
            Get started in <span className="font-display-italic">minutes</span>.
          </h2>
          <p className="text-sm text-[var(--muted)] mb-10">
            Fill in the form — we'll review your application and contact you within 1 business day.
          </p>

          <form onSubmit={handleSubmit} noValidate className="bg-[var(--surface)] rounded-[24px] p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Company name</label>
                <input type="text" placeholder="Acme Office Supplies" {...f('company_name')} />
                {errors.company_name && <p className="text-xs text-red-500 mt-1">{errors.company_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Contact name</label>
                <input type="text" placeholder="Jane Smith" {...f('contact_name')} />
                {errors.contact_name && <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Work email</label>
                <input type="email" placeholder="jane@acme.co.za" {...f('email')} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Phone</label>
                <input type="tel" placeholder="011 234 5678" {...f('phone')} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Business type</label>
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
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">Est. monthly spend</label>
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
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-2)] mb-1.5">
                Message <span className="normal-case text-[var(--muted-2)]">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Which printers do you use? Any specific SKUs you need regularly?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
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
              {submitting ? 'Sending application…' : 'Submit application'}
            </button>
            <p className="text-[11px] text-[var(--muted-2)] text-center">
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
              { step: '02', title: 'Get approved', body: 'We approve the account against your email address. Nothing to install, no code to remember — the discount is attached to the account itself.' },
              { step: '03', title: 'Order and save', body: `Sign in, fill the cart, and the ${B2B_TIERS[0]!.percent}% or ${B2B_MAX_PERCENT}% comes off at checkout on its own. Next-day delivery JHB/PTA — COD available for our own drivers.` },
            ].map(({ step, title, body }) => (
              <div key={step} className="border-t-2 border-[#dfe344] pt-5">
                <div className="font-display text-5xl font-light text-[#dfe344] leading-none mb-4">{step}</div>
                <h3 className="font-display text-xl font-light mb-2">{title}</h3>
                <p className="text-sm text-[var(--ink-2)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-12">
        <div className="panel-dark mx-auto max-w-7xl bg-[var(--ink)] text-[var(--paper)] rounded-[28px] p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <h3 className="font-display font-light text-3xl sm:text-4xl leading-tight">
              Need pricing fast? <span className="font-display-italic text-[#dfe344]">Call us.</span>
            </h3>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
            <a href={siteConfig.phone.tel} className="inline-flex items-center justify-center gap-2 bg-[var(--surface)] text-[var(--ink)] hover:bg-[#dfe344] rounded-full px-5 py-3 text-sm font-medium transition-colors">
              {siteConfig.phone.display}
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
