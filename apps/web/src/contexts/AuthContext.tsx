'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000'
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ''
const TOKEN_KEY = 'tse_auth_token'

export type CustomerGroup = { id: string; name: string }

export type Customer = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  addresses: CustomerAddress[]
  groups?: CustomerGroup[]
}

export type CustomerAddress = {
  id: string
  first_name?: string | null
  last_name?: string | null
  address_1: string
  address_2?: string | null
  city: string
  province?: string | null
  postal_code?: string | null
  country_code: string
  phone?: string | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

type RegisterInput = {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

export type NewAddressInput = {
  first_name?: string
  last_name?: string
  phone?: string
  address_1: string
  address_2?: string
  city: string
  province: string
  postal_code: string
  is_default_shipping?: boolean
}

type AuthContextType = {
  customer: Customer | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (input: RegisterInput) => Promise<string | null>
  logout: () => void
  refreshCustomer: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string | null>
  resetPassword: (token: string, password: string) => Promise<string | null>
  addAddress: (input: NewAddressInput) => Promise<string | null>
  setDefaultAddress: (addressId: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

function storeHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-publishable-api-key': PUB_KEY,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCustomer = useCallback(async (tok: string): Promise<Customer | null> => {
    try {
      const res = await fetch(`${BACKEND}/store/customers/me?fields=*groups,*addresses`, {
        headers: storeHeaders(tok),
        cache: 'no-store',
      })
      if (!res.ok) return null
      const { customer } = await res.json()
      return customer as Customer
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY)
      if (!stored) { setLoading(false); return }
      setToken(stored)
      fetchCustomer(stored).then((c) => {
        if (c) {
          setCustomer(c)
        } else {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setLoading(false)
      })
    } catch {
      setLoading(false)
    }
  }, [fetchCustomer])

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${BACKEND}/auth/customer/emailpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return data.message ?? 'Invalid email or password'
      const tok = data.token as string
      localStorage.setItem(TOKEN_KEY, tok)
      setToken(tok)
      const c = await fetchCustomer(tok)
      setCustomer(c)
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  async function register(input: RegisterInput): Promise<string | null> {
    try {
      // Step 1: create auth identity
      const authRes = await fetch(`${BACKEND}/auth/customer/emailpass/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.email, password: input.password }),
      })
      const authData = await authRes.json()
      if (!authRes.ok) return authData.message ?? 'Registration failed'
      const tok = authData.token as string

      // Step 2: create customer profile
      await fetch(`${BACKEND}/store/customers`, {
        method: 'POST',
        headers: storeHeaders(tok),
        body: JSON.stringify({
          email: input.email,
          first_name: input.first_name,
          last_name: input.last_name,
          ...(input.phone ? { phone: input.phone } : {}),
        }),
      })

      localStorage.setItem(TOKEN_KEY, tok)
      setToken(tok)
      const c = await fetchCustomer(tok)
      setCustomer(c)
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  function logout() {
    try { localStorage.removeItem(TOKEN_KEY) } catch {}
    setToken(null)
    setCustomer(null)
  }

  async function refreshCustomer() {
    if (!token) return
    const c = await fetchCustomer(token)
    if (c) setCustomer(c)
  }

  // Create a saved address on the customer profile. Medusa clears any previous
  // default when is_default_shipping is set, so callers don't have to.
  async function addAddress(input: NewAddressInput): Promise<string | null> {
    if (!token) return 'Not signed in'
    try {
      const res = await fetch(`${BACKEND}/store/customers/me/addresses`, {
        method: 'POST',
        headers: storeHeaders(token),
        body: JSON.stringify({
          first_name: input.first_name || customer?.first_name || undefined,
          last_name: input.last_name || customer?.last_name || undefined,
          phone: input.phone || customer?.phone || undefined,
          address_1: input.address_1,
          address_2: input.address_2 || undefined,
          city: input.city,
          province: input.province,
          postal_code: input.postal_code,
          country_code: 'ZA',
          ...(input.is_default_shipping ? { is_default_shipping: true } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return data.message ?? 'Failed to save address'
      }
      const c = await fetchCustomer(token)
      if (c) setCustomer(c)
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  async function setDefaultAddress(addressId: string): Promise<string | null> {
    if (!token) return 'Not signed in'
    try {
      const res = await fetch(`${BACKEND}/store/customers/me/addresses/${addressId}`, {
        method: 'POST',
        headers: storeHeaders(token),
        body: JSON.stringify({ is_default_shipping: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return data.message ?? 'Failed to set default address'
      }
      const c = await fetchCustomer(token)
      if (c) setCustomer(c)
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  async function requestPasswordReset(email: string): Promise<string | null> {
    try {
      const res = await fetch(`${BACKEND}/auth/customer/emailpass/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      })
      if (!res.ok) {
        const data = await res.json()
        return data.message ?? 'Failed to send reset email'
      }
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  async function resetPassword(resetToken: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${BACKEND}/auth/customer/emailpass/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resetToken}`,
        },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json()
        return data.message ?? 'Failed to reset password'
      }
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  return (
    <AuthContext.Provider value={{ customer, token, loading, login, register, logout, refreshCustomer, requestPasswordReset, resetPassword, addAddress, setDefaultAddress }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
