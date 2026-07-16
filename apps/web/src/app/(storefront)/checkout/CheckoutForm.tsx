'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'
import { useAuth, type CustomerAddress } from '@/contexts/AuthContext'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import {
  setCartContact,
  listShippingOptions,
  selectShippingMethod,
  initPayfastSession,
  PAYFAST_PROVIDER_ENABLED,
  type ShippingOption,
  type CartTotals,
} from '@/lib/checkout-cart'

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

type ContactForm = { name: string; email: string; phone: string }
type AddressForm = { line1: string; suburb: string; city: string; province: string; postalCode: string }

const EMPTY_CONTACT: ContactForm = { name: '', email: '', phone: '' }
const EMPTY_ADDRESS: AddressForm = { line1: '', suburb: '', city: '', province: '', postalCode: '' }

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

function inputClass(error?: string) {
  return `w-full px-4 py-3 rounded-[12px] border bg-[var(--surface)] text-sm outline-none transition-colors ${error ? 'border-red-400' : 'border-[var(--line-4)] focus:border-[var(--ink)]'}`
}

// Map a saved customer address onto the checkout form shape.
function toAddressForm(a: CustomerAddress): AddressForm {
  return {
    line1: a.address_1,
    suburb: a.address_2 ?? '',
    city: a.city,
    province: a.province ?? '',
    postalCode: a.postal_code ?? '',
  }
}

export default function CheckoutForm() {
  const { items, count, clearCart, cartId } = useCart()
  const { customer, register, addAddress } = useAuth()
  const [step, setStep] = useState(1)
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT)
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS)
  const [contactErrors, setContactErrors] = useState<Partial<ContactForm>>({})
  const [addressErrors, setAddressErrors] = useState<Partial<AddressForm>>({})
  const [payfastLoading, setPayfastLoading] = useState(false)
  const [payfastError, setPayfastError] = useState('')

  // Saved-address picker: a saved address id, or 'new' for the manual form.
  const savedAddresses = customer?.addresses ?? []
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)

  // Guest "create account" option (step 1)
  const [createAccount, setCreateAccount] = useState(false)
  const [accountPassword, setAccountPassword] = useState('')
  const [accountConfirm, setAccountConfirm] = useState('')
  const [accountError, setAccountError] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)

  // Prefill from the signed-in customer once it loads — only fields the
  // shopper hasn't already typed into, so we never clobber their input.
  useEffect(() => {
    if (!customer) return
    setContact((c) => ({
      name: c.name || [customer.first_name, customer.last_name].filter(Boolean).join(' '),
      email: c.email || customer.email,
      phone: c.phone || customer.phone || '',
    }))
    const addrs = customer.addresses ?? []
    const preferred = addrs.find((a) => a.is_default_shipping) ?? addrs[0]
    if (preferred) {
      setSelectedAddressId((sel) => sel ?? preferred.id)
      setAddress((a) => (a === EMPTY_ADDRESS || !a.line1 ? toAddressForm(preferred) : a))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  function chooseSavedAddress(a: CustomerAddress) {
    setSelectedAddressId(a.id)
    setAddress(toAddressForm(a))
    setAddressErrors({})
  }

  // Delivery state (the cart itself is the session Medusa cart from context)
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [totals, setTotals] = useState<CartTotals | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [optionsNotice, setOptionsNotice] = useState('')

  const formRef = useRef<HTMLFormElement>(null)

  const subtotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)
  const selectedOption = options.find((o) => o.id === selectedOptionId) ?? null

  // Prefer authoritative cart totals once a method is chosen; fall back to the
  // local subtotal (+ selected delivery) before the cart has computed.
  const deliveryRand = totals ? totals.shipping_total : selectedOption ? selectedOption.amount : 0
  const totalRand = totals ? totals.total : subtotal + deliveryRand
  const vatContent = Math.round((totalRand * 15) / 115)

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

  // Step-1 continue: optionally create the account first (guest + checkbox),
  // then move to the address step.
  async function continueFromContact() {
    if (!validateContact()) return
    setAccountError('')
    if (createAccount && !customer) {
      if (accountPassword.length < 8) { setAccountError('Password: minimum 8 characters'); return }
      if (accountPassword !== accountConfirm) { setAccountError('Passwords do not match'); return }
      setAccountLoading(true)
      const nameParts = contact.name.trim().split(/\s+/)
      const err = await register({
        email: contact.email.trim(),
        password: accountPassword,
        first_name: nameParts[0] ?? contact.name,
        last_name: nameParts.slice(1).join(' ') || '-',
        phone: contact.phone.replace(/\s/g, '') || undefined,
      })
      setAccountLoading(false)
      if (err) { setAccountError(err); return }
    }
    setStep(2)
  }

  // Set the address/email on the existing session cart, then load
  // admin-configured shipping options (Collect / Courier Guy Economy +
  // Overnight) with live prices.
  async function loadDeliveryOptions() {
    if (!validateAddress()) return
    if (!cartId) {
      setOptionsError('Your cart could not be found. Please add an item again.')
      return
    }
    setOptionsError('')
    setOptionsNotice('')
    setOptionsLoading(true)
    setSelectedOptionId(null)
    setTotals(null)
    try {
      const nameParts = contact.name.trim().split(/\s+/)
      await setCartContact(cartId, contact.email, {
        first_name: nameParts[0] ?? contact.name,
        last_name: nameParts.slice(1).join(' ') || '-',
        phone: contact.phone.replace(/\s/g, ''),
        address_1: address.line1,
        address_2: address.suburb,
        city: address.city,
        province: address.province,
        postal_code: address.postalCode,
      })
      const { options: opts, unavailable } = await listShippingOptions(cartId)
      if (opts.length === 0) {
        setOptionsError('No delivery options are available for this address. Please check your details.')
        return
      }
      if (unavailable.length > 0) {
        setOptionsNotice(`Not available for this address: ${unavailable.join(', ')}.`)
      }

      // Persist a newly typed address to the signed-in customer's address book
      // (first one becomes the default). Failures are non-blocking — the cart
      // already has the address; the account copy is a convenience.
      if (customer && (selectedAddressId === 'new' || savedAddresses.length === 0)) {
        addAddress({
          address_1: address.line1,
          address_2: address.suburb || undefined,
          city: address.city,
          province: address.province,
          postal_code: address.postalCode,
          phone: contact.phone.replace(/\s/g, '') || undefined,
          is_default_shipping: savedAddresses.length === 0,
        }).catch(() => {})
      }

      setOptions(opts)
      setStep(3)
    } catch (err: any) {
      setOptionsError(err?.message ?? 'Could not load delivery options. Please try again.')
    } finally {
      setOptionsLoading(false)
    }
  }

  async function chooseOption(optionId: string) {
    if (!cartId) return
    setSelectedOptionId(optionId)
    setOptionsError('')
    try {
      const t = await selectShippingMethod(cartId, optionId)
      setTotals(t)
    } catch (err: any) {
      setOptionsError(err?.message ?? 'Could not select that delivery option.')
      setSelectedOptionId(null)
    }
  }

  // Standard PayFast redirect: POST a hidden form to their process URL.
  function submitToPayfast(url: string, params: Record<string, string>) {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = url
    for (const [key, value] of Object.entries(params)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  async function handlePayFast() {
    if (!cartId) {
      setPayfastError('Your delivery selection expired. Please reselect a delivery option.')
      return
    }
    setPayfastError('')
    setPayfastLoading(true)
    try {
      if (PAYFAST_PROVIDER_ENABLED) {
        // Canonical flow: Medusa payment provider signs the redirect params.
        // Keep the cart_id so /checkout/confirmed can complete the cart → order.
        const { url, params } = await initPayfastSession(cartId, { email: contact.email, name: contact.name })
        submitToPayfast(url, params)
        return
      }

      // Legacy flow: storefront API route signs + persists the pending cart;
      // the ITN turns it into an order, so the local cart can be cleared now.
      const res = await fetch('/api/payfast/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_id: cartId, contact }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Payment service unavailable' }))
        setPayfastError(error ?? 'Could not initiate payment. Please try again.')
        return
      }
      const { url, params } = await res.json()
      clearCart()
      submitToPayfast(url, params)
    } catch (err: any) {
      setPayfastError(err?.message ?? 'Network error — please try again.')
    } finally {
      setPayfastLoading(false)
    }
  }

  if (items.length === 0 && step < 4) {
    return (
      <div className="text-center py-24 max-w-md mx-auto px-4">
        <h2 className="font-display font-light text-2xl mb-4">Your cart is empty</h2>
        <Link href="/products" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
          ← Go to shop
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 lg:px-12 pt-32 pb-16">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <div className="mb-8 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-[var(--ink)] transition-colors">Cart</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Checkout</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-10">
        {[{ n: 1, label: 'Contact' }, { n: 2, label: 'Address' }, { n: 3, label: 'Delivery' }, { n: 4, label: 'Review' }].map(
          ({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 ${step >= n ? 'text-[var(--ink)]' : 'text-[var(--muted-2)]'}`}>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    step > n
                      ? 'bg-[#dfe344] text-[var(--ink)]'
                      : step === n
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-[var(--hover-2)] text-[var(--muted-2)]'
                  }`}
                >
                  {step > n ? '✓' : n}
                </span>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {idx < 3 && (
                <div className={`flex-1 h-px w-6 sm:w-12 ${step > n ? 'bg-[#dfe344]' : 'bg-[var(--hover-3)]'}`} />
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
              {customer && (
                <p className="text-xs text-[var(--muted)] -mt-5 mb-6">
                  Signed in as <span className="text-[var(--ink)]">{customer.email}</span> — details filled in for you.
                </p>
              )}
              <div className="space-y-4">
                {([
                  { key: 'name', label: 'Full name', type: 'text', placeholder: 'Jane Smith', ac: 'name' },
                  { key: 'email', label: 'Email address', type: 'email', placeholder: 'jane@example.com', ac: 'email' },
                  { key: 'phone', label: 'Phone number', type: 'tel', placeholder: '082 123 4567', ac: 'tel' },
                ] as const).map(({ key, label, type, placeholder, ac }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">
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

              {/* Guest: offer to create an account with these details */}
              {!customer && (
                <div className="mt-6 bg-[var(--surface)] rounded-[16px] p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => { setCreateAccount(e.target.checked); setAccountError('') }}
                      className="mt-0.5 w-4 h-4 accent-[var(--ink)] cursor-pointer"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Create an account</span>
                      <span className="block text-xs text-[var(--muted)] mt-0.5">
                        Save your details and track orders. Already have one?{' '}
                        <Link href="/account/login?next=/checkout" className="underline underline-offset-2 hover:text-[var(--ink)]">Sign in</Link>
                      </span>
                    </span>
                  </label>
                  {createAccount && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Password</label>
                        <input
                          type="password" autoComplete="new-password" placeholder="Min 8 characters"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          className={inputClass(accountError || undefined)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Confirm</label>
                        <input
                          type="password" autoComplete="new-password" placeholder="••••••••"
                          value={accountConfirm}
                          onChange={(e) => setAccountConfirm(e.target.value)}
                          className={inputClass(accountError || undefined)}
                        />
                      </div>
                    </div>
                  )}
                  {accountError && <p className="text-xs text-red-500 mt-2">{accountError}</p>}
                </div>
              )}

              <button
                onClick={continueFromContact}
                disabled={accountLoading}
                className="mt-8 w-full bg-[var(--ink)] text-[var(--paper)] rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {accountLoading && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {accountLoading ? 'Creating account…' : 'Continue to address →'}
              </button>
            </div>
          )}

          {/* ── Step 2: Address ── */}
          {step === 2 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Delivery address</h1>

              {/* Saved addresses (signed-in): default preselected, swap by tapping */}
              {savedAddresses.length > 0 && (
                <div className="space-y-3 mb-6">
                  {savedAddresses.map((a) => {
                    const selected = selectedAddressId === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => chooseSavedAddress(a)}
                        className={`w-full text-left rounded-[16px] p-4 border transition-colors cursor-pointer flex items-start gap-3 ${
                          selected ? 'border-[var(--ink)] bg-[var(--paper)]' : 'border-[var(--line-4)] hover:border-[var(--line-6)]'
                        }`}
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${selected ? 'border-[var(--ink)]' : 'border-[var(--line-6)]'}`}>
                          {selected && <span className="w-2 h-2 rounded-full bg-[var(--ink)]" />}
                        </span>
                        <span className="text-sm min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-medium truncate">{a.address_1}</span>
                            {a.is_default_shipping && (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#dfe344] text-[#111827] px-2 py-0.5 rounded-full flex-shrink-0">
                                Default
                              </span>
                            )}
                          </span>
                          <span className="block text-[var(--muted)]">
                            {[a.address_2, a.city, a.province, a.postal_code].filter(Boolean).join(', ')}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => { setSelectedAddressId('new'); setAddress(EMPTY_ADDRESS); setAddressErrors({}) }}
                    className={`w-full text-left rounded-[16px] p-4 border border-dashed transition-colors cursor-pointer text-sm ${
                      selectedAddressId === 'new' ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-[var(--line-4)] text-[var(--muted)] hover:border-[var(--line-6)]'
                    }`}
                  >
                    + Use a different address
                  </button>
                </div>
              )}

              {(savedAddresses.length === 0 || selectedAddressId === 'new') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Street address</label>
                  <AddressAutocomplete
                    value={address.line1}
                    placeholder="Start typing your address…"
                    autoComplete="address-line1"
                    className={inputClass(addressErrors.line1)}
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
                  <FieldError msg={addressErrors.line1} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Suburb</label>
                    <input
                      type="text" autoComplete="address-level3" placeholder="Randburg"
                      value={address.suburb}
                      onChange={(e) => setAddress({ ...address, suburb: e.target.value })}
                      className={inputClass(addressErrors.suburb)}
                    />
                    <FieldError msg={addressErrors.suburb} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">City</label>
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
                    <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Province</label>
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
                    <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5 uppercase tracking-[0.12em]">Postal code</label>
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
              )}
              {optionsError && <p className="text-xs text-red-500 mt-4">{optionsError}</p>}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-full border border-[var(--line-4)] text-sm text-[var(--ink-2)] hover:border-[var(--line-7)] transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={loadDeliveryOptions}
                  disabled={optionsLoading}
                  className="flex-1 bg-[var(--ink)] text-[var(--paper)] rounded-full py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {optionsLoading && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {optionsLoading ? 'Finding delivery options…' : 'Continue to delivery →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Delivery method ── */}
          {step === 3 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Delivery options</h1>
              <div className="space-y-3">
                {options.map((o) => {
                  const isFree = o.amount === 0
                  const selected = o.id === selectedOptionId
                  return (
                    <button
                      key={o.id}
                      onClick={() => chooseOption(o.id)}
                      className={`w-full text-left rounded-[16px] p-5 border transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        selected ? 'border-[var(--ink)] bg-[var(--paper)]' : 'border-[var(--line-4)] hover:border-[var(--line-6)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${selected ? 'border-[var(--ink)]' : 'border-[var(--line-6)]'}`}>
                          {selected && <span className="w-2 h-2 rounded-full bg-[var(--ink)]" />}
                        </span>
                        <span className="font-medium text-sm text-[var(--ink)]">{o.name}</span>
                        {o.priceType === 'calculated' && (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#dfe344] text-[var(--ink)] px-2 py-0.5 rounded-full flex-shrink-0">
                            Live rate
                          </span>
                        )}
                      </div>
                      <span className="font-display text-base flex-shrink-0">
                        {isFree ? 'Free' : `R${o.amount.toFixed(0)}`}
                      </span>
                    </button>
                  )
                })}
              </div>
              {optionsNotice && <p className="text-xs text-[#B45309] mt-4">{optionsNotice}</p>}
              {optionsError && <p className="text-xs text-red-500 mt-4">{optionsError}</p>}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-full border border-[var(--line-4)] text-sm text-[var(--ink-2)] hover:border-[var(--line-7)] transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  onClick={() => selectedOptionId && setStep(4)}
                  disabled={!selectedOptionId}
                  className="flex-1 bg-[var(--ink)] text-[var(--paper)] rounded-full py-3 text-sm font-medium hover:bg-[#41e0f5] hover:text-[var(--on-accent)] transition-colors cursor-pointer disabled:opacity-40"
                >
                  Review order →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Payment ── */}
          {step === 4 && (
            <div>
              <h1 className="font-display font-light text-3xl mb-8">Review your order</h1>

              <div className="bg-[var(--surface)] rounded-[16px] p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Contact</h3>
                  <button onClick={() => setStep(1)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer">Edit</button>
                </div>
                <p className="text-sm">{contact.name}</p>
                <p className="text-sm text-[var(--muted)]">{contact.email} · {contact.phone}</p>
              </div>

              <div className="bg-[var(--surface)] rounded-[16px] p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Delivery address</h3>
                  <button onClick={() => setStep(2)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer">Edit</button>
                </div>
                <p className="text-sm">{address.line1}</p>
                <p className="text-sm text-[var(--muted)]">{address.suburb}, {address.city}</p>
                <p className="text-sm text-[var(--muted)]">{address.province} {address.postalCode}</p>
              </div>

              <div className="bg-[var(--surface)] rounded-[16px] p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Delivery method</h3>
                  <button onClick={() => setStep(3)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer">Edit</button>
                </div>
                <p className="text-sm">{selectedOption?.name}</p>
                <p className="text-sm text-[var(--muted)]">{selectedOption && selectedOption.amount === 0 ? 'Free' : `R${(selectedOption?.amount ?? 0).toFixed(0)}`}</p>
              </div>

              {/* Payment */}
              <div className="mb-6">
                <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)] mb-4">How would you like to pay?</h3>

                <button
                  onClick={handlePayFast}
                  disabled={payfastLoading}
                  className="panel-dark w-full bg-[var(--ink)] text-[var(--paper)] rounded-[16px] p-5 text-left hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 mb-3 group"
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
                    <span className="text-xs bg-[#dfe344] text-[var(--ink)] font-semibold px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                </button>

                {payfastError && (
                  <p className="text-xs text-red-500 mb-3 px-1">{payfastError}</p>
                )}
              </div>

              <button
                onClick={() => setStep(3)}
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                ← Back to delivery
              </button>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--surface)] rounded-[20px] p-6 sticky top-24">
            <h2 className="font-display font-light text-lg mb-4">
              {count} {count === 1 ? 'item' : 'items'}
            </h2>
            <ul className="space-y-3 mb-5">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.title}</p>
                    <p className="text-[10px] text-[var(--muted-2)]">SKU {item.sku} · qty {item.qty}</p>
                  </div>
                  <span className="flex-shrink-0 font-medium">
                    {item.price ? `R${(item.price * item.qty).toFixed(0)}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--line-2)] pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-[var(--muted)]">
                <span>Subtotal</span><span>R{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>VAT (incl.)</span><span>R{vatContent}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>Delivery</span>
                <span>{selectedOption ? (deliveryRand === 0 ? 'Free' : `R${deliveryRand.toFixed(0)}`) : 'Select at checkout'}</span>
              </div>
            </div>
            <div className="border-t border-[var(--line-2)] mt-4 pt-4 flex justify-between items-baseline">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl">R{totalRand.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden form ref for PayFast submission (unused but kept for fallback) */}
      <form ref={formRef} method="POST" className="hidden" />
    </div>
  )
}
