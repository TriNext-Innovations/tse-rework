'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

const JHB_PTA_PROVINCES = new Set(['Gauteng'])

type ContactForm = { name: string; email: string; phone: string }
type AddressForm = { line1: string; suburb: string; city: string; province: string; postalCode: string }

const EMPTY_CONTACT: ContactForm = { name: '', email: '', phone: '' }
const EMPTY_ADDRESS: AddressForm = { line1: '', suburb: '', city: '', province: '', postalCode: '' }

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

function inputClass(error?: string) {
  return `w-full px-4 py-3 rounded-[12px] border bg-white text-sm outline-none transition-colors ${error ? 'border-red-400' : 'border-black/15 focus:border-[#111827]'}`
}

export default function CheckoutForm() {
  const { items, count, clearCart } = useCart()
  const [step, setStep] = useState(1)
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT)
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS)
  const [contactErrors, setContactErrors] = useState<Partial<ContactForm>>({})
  const [addressErrors, setAddressErrors] = useState<Partial<AddressForm>>({})
  const [payfastLoading, setPayfastLoading] = useState(false)
  const [payfastError, setPayfastError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const subtotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)
  const vatContent = Math.round((subtotal * 15) / 115)
  const isGauteng = JHB_PTA_PROVINCES.has(address.province)

  function validateContact(): boolean {
    const errs: Partial<ContactForm> = {}
    if (!contact.name.trim()) errs.name = 'Required'
    if (!contact.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(contact.email))
      errs.email = 'Valid email required'
    if (!contact.phone.trim() || !/^(\+27|0)[0-9]{9}$/.test(contact.phone.replace(/\s/g, '')))
      errs.phone = 'Valid SA number required (e.g. 0821234567)'
    setContactErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateAddress(): boolean {
    const errs: Partial<AddressForm> = {}
    if (!address.line1.trim()) errs.line1 = 'Required'
    if (!address.suburb.trim()) errs.suburb = 'Required'
    if (!address.city.trim()) errs.city = 'Required'
    if (!address.province) errs.province = 'Required'
    if (!address.postalCode.trim() || !/^\d{4}$/.test(address.postalCode))
      errs.postalCode = '4-digit postal code required'
    setAddressErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleWhatsApp() {
    const itemLines = items
      .map((i) => `• ${i.qty}x ${i.title} (SKU: ${i.sku})${i.price ? ` — R${(i.price * i.qty).toFixed(0)}` : ''}`)
      .join('\n')
    const message = encodeURIComponent(
      `Hi TSE, I'd like to place the following order:\n\n` +
      `ITEMS:\n${itemLines}\n\n` +
      `TOTAL: R${subtotal.toFixed(0)} (incl. VAT)\n\n` +
      `DELIVER TO:\n${contact.name}\n${address.line1}\n${address.suburb}, ${address.city}\n` +
      `${address.province} ${address.postalCode}\n\n` +
      `CONTACT:\nEmail: ${contact.email}\nPhone: ${contact.phone}\n\n` +
      `Please confirm availability and arrange delivery.`,
    )
    clearCart()
    window.open(`https://wa.me/27798733558?text=${message}`, '_blank')
    window.location.href = '/checkout/confirmed'
  }

  async function handlePayFast() {
    setPayfastError('')
    setPayfastLoading(true)
    try {
      const res = await fetch('/api/payfast/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, contact, address }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Payment service unavailable' }))
        setPayfastError(error ?? 'Could not initiate payment. Please try again.')
        return
      }
      const { url, params } = await res.json()

      // Build and submit a hidden form — the standard PayFast redirect method
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = url
      for (const [key, value] of Object.entries(params as Record<string, string>)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      }
      clearCart()
      document.body.appendChild(form)
      form.submit()
    } catch {
      setPayfastError('Network error — please try again.')
    } finally {
      setPayfastLoading(false)
    }
  }

  if (items.length === 0 && step < 3) {
    return (
      <div className="text-center py-24 max-w-md mx-auto px-4">
        <h2 className="font-display font-light text-2xl mb-4">Your cart is empty</h2>
        <Link href="/products" className="text-sm text-[#6B6B66] hover:text-[#111827] transition-colors">
          ← Go to shop
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 lg:px-12 pt-28 pb-16">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <div className="mb-8 flex items-center gap-2 text-xs text-[#6B6B66]">
        <Link href="/" className="hover:text-[#111827] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-[#111827] transition-colors">Cart</Link>
        <span>/</span>
        <span className="text-[#111827]">Checkout</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-10">
        {[{ n: 1, label: 'Contact' }, { n: 2, label: 'Delivery' }, { n: 3, label: 'Review' }].map(
          ({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 ${step >= n ? 'text-[#111827]' : 'text-[#9ca3af]'}`}>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    step > n
                      ? 'bg-[#dfe344] text-[#111827]'
                      : step === n
                      ? 'bg-[#111827] text-white'
                      : 'bg-black/8 text-[#9ca3af]'
                  }`}
                >
                  {step > n ? '✓' : n}
                </span>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {idx < 2 && (
                <div className={`flex-1 h-px w-8 sm:w-16 ${step > n ? 'bg-[#dfe344]' : 'bg-black/10'}`} />
              )}
            </div>
          ),
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Main form */}
        <div className="lg:col-span-3">

          {/* ── Step 1: Contact ── */}
          {step === 1 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Contact info</h1>
              <div className="space-y-4">
                {([
                  { key: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Smith', ac: 'name' },
                  { key: 'email', label: 'Email address', type: 'email', placeholder: 'jane@example.com', ac: 'email' },
                  { key: 'phone', label: 'Phone number', type: 'tel', placeholder: '082 123 4567', ac: 'tel' },
                ] as const).map(({ key, label, type, placeholder, ac }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">
                      {label}
                    </label>
                    <input
                      type={type}
                      autoComplete={ac}
                      value={contact[key]}
                      onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
                      placeholder={placeholder}
                      className={inputClass(contactErrors[key])}
                    />
                    <FieldError msg={contactErrors[key]} />
                  </div>
                ))}
              </div>
              <button
                onClick={() => validateContact() && setStep(2)}
                className="mt-8 w-full bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors cursor-pointer"
              >
                Continue to delivery →
              </button>
            </div>
          )}

          {/* ── Step 2: Address ── */}
          {step === 2 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Delivery address</h1>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">Street address</label>
                  <input
                    type="text" autoComplete="address-line1" placeholder="12 Acacia Street"
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    className={inputClass(addressErrors.line1)}
                  />
                  <FieldError msg={addressErrors.line1} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">Suburb</label>
                    <input
                      type="text" autoComplete="address-level3" placeholder="Randburg"
                      value={address.suburb}
                      onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
                      className={inputClass(addressErrors.suburb)}
                    />
                    <FieldError msg={addressErrors.suburb} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">City</label>
                    <input
                      type="text" autoComplete="address-level2" placeholder="Johannesburg"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className={inputClass(addressErrors.city)}
                    />
                    <FieldError msg={addressErrors.city} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">Province</label>
                    <select
                      autoComplete="address-level1"
                      value={address.province}
                      onChange={(e) => setAddress({ ...address, province: e.target.value })}
                      className={inputClass(addressErrors.province)}
                    >
                      <option value="">Select province</option>
                      {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <FieldError msg={addressErrors.province} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5 uppercase tracking-[0.12em]">Postal code</label>
                    <input
                      type="text" autoComplete="postal-code" placeholder="2194" maxLength={4}
                      value={address.postalCode}
                      onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                      className={inputClass(addressErrors.postalCode)}
                    />
                    <FieldError msg={addressErrors.postalCode} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-full border border-black/15 text-sm text-[#374151] hover:border-black/40 transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => validateAddress() && setStep(3)}
                  className="flex-1 bg-[#111827] text-white rounded-full py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors cursor-pointer"
                >
                  Review order →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Payment ── */}
          {step === 3 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Review your order</h1>

              <div className="bg-white rounded-[16px] p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[#6B6B66]">Contact</h3>
                  <button onClick={() => setStep(1)} className="text-xs text-[#6B6B66] hover:text-[#111827] transition-colors cursor-pointer">Edit</button>
                </div>
                <p className="text-sm">{contact.name}</p>
                <p className="text-sm text-[#6B6B66]">{contact.email} · {contact.phone}</p>
              </div>

              <div className="bg-white rounded-[16px] p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[#6B6B66]">Delivery address</h3>
                  <button onClick={() => setStep(2)} className="text-xs text-[#6B6B66] hover:text-[#111827] transition-colors cursor-pointer">Edit</button>
                </div>
                <p className="text-sm">{address.line1}</p>
                <p className="text-sm text-[#6B6B66]">{address.suburb}, {address.city}</p>
                <p className="text-sm text-[#6B6B66]">{address.province} {address.postalCode}</p>
              </div>

              {/* Payment options */}
              <div className="mb-6">
                <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[#6B6B66] mb-4">How would you like to pay?</h3>

                {/* PayFast — pay online */}
                <button
                  onClick={handlePayFast}
                  disabled={payfastLoading}
                  className="w-full bg-[#111827] text-white rounded-[16px] p-5 text-left hover:bg-[#1f2937] transition-colors cursor-pointer disabled:opacity-60 mb-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {payfastLoading ? (
                          <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        )}
                        Pay online via PayFast
                      </div>
                      <div className="text-xs text-white/60 mt-0.5">Credit / debit card, instant EFT — secure and instant</div>
                    </div>
                    <span className="text-xs bg-[#dfe344] text-[#111827] font-semibold px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                </button>

                {payfastError && (
                  <p className="text-xs text-red-500 mb-3 px-1">{payfastError}</p>
                )}

                {/* WhatsApp — COD option */}
                <button
                  onClick={handleWhatsApp}
                  className="w-full border border-black/15 rounded-[16px] p-5 text-left hover:border-black/30 transition-colors cursor-pointer"
                >
                  <div className="font-medium text-sm flex items-center gap-2 text-[#111827]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {isGauteng ? 'WhatsApp order — pay on delivery (JHB/PTA)' : 'WhatsApp order'}
                  </div>
                  <div className="text-xs text-[#6B6B66] mt-0.5">
                    {isGauteng
                      ? 'COD available on our own drivers. Team confirms stock within 1 hour.'
                      : 'Our team will contact you to arrange prepayment and courier.'}
                  </div>
                </button>
              </div>

              <button
                onClick={() => setStep(2)}
                className="text-sm text-[#6B6B66] hover:text-[#111827] transition-colors cursor-pointer"
              >
                ← Back to address
              </button>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[20px] p-6 sticky top-24">
            <h2 className="font-display font-light text-lg mb-4">
              {count} {count === 1 ? 'item' : 'items'}
            </h2>
            <ul className="space-y-3 mb-5">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.title}</p>
                    <p className="text-[10px] text-[#9ca3af]">SKU {item.sku} · qty {item.qty}</p>
                  </div>
                  <span className="flex-shrink-0 font-medium">
                    {item.price ? `R${(item.price * item.qty).toFixed(0)}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-black/8 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-[#6B6B66]">
                <span>Subtotal</span><span>R{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-[#6B6B66]">
                <span>VAT (incl.)</span><span>R{vatContent}</span>
              </div>
              <div className="flex justify-between text-[#6B6B66]">
                <span>Delivery</span>
                <span>{isGauteng ? 'Free (own driver)' : 'Arranged on order'}</span>
              </div>
            </div>
            <div className="border-t border-black/8 mt-4 pt-4 flex justify-between items-baseline">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl">R{subtotal.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden form ref for PayFast submission (unused but kept for fallback) */}
      <form ref={formRef} method="POST" className="hidden" />
    </div>
  )
}
