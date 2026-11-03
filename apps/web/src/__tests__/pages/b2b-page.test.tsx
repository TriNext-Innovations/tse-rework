import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { useRouter } from 'next/navigation'
import B2BPage from '@/app/(storefront)/b2b/page'
import { CartProvider } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'

const push = vi.fn()

type AuthState = ReturnType<typeof useAuth>

function signedIn(overrides: Partial<NonNullable<AuthState['customer']>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    ...vi.mocked(useAuth)(),
    token: 'jwt_customer',
    loading: false,
    customer: {
      id: 'cus_01',
      email: 'jane@acme.co.za',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '011 234 5678',
      groups: [],
      ...overrides,
    },
  } as AuthState)
}

function renderPage() {
  return render(
    <CartProvider>
      <B2BPage />
    </CartProvider>,
  )
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() } as unknown as ReturnType<typeof useRouter>)
})

describe('B2B application', () => {
  it('asks a signed-out visitor to create an account first, and brings them back to the form', () => {
    renderPage()
    expect(screen.getByText('First, a TSE account.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit application/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/account/register?next=%2Fb2b%23apply')
    expect(screen.getByRole('link', { name: 'I have an account — sign in' })).toHaveAttribute('href', '/account/login?next=%2Fb2b%23apply')
  })

  it('tells an approved customer they already have business pricing', () => {
    signedIn({ groups: [{ id: 'cusgroup_1', name: 'B2B Approved' }] })
    renderPage()
    expect(screen.getByText('Your account has business pricing.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit application/i })).not.toBeInTheDocument()
  })

  it('lets a signed-in customer apply as their account, sending their session and no email of their own choosing', async () => {
    signedIn()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }))
    global.fetch = fetchMock as unknown as typeof fetch
    renderPage()

    expect(screen.getByText('jane@acme.co.za')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jane Smith')).toBeInTheDocument()
    expect(screen.getByDisplayValue('011 234 5678')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Acme Office Supplies'), { target: { value: 'Acme Office Supplies' } })
    const [type, volume] = screen.getAllByRole('combobox')
    fireEvent.change(type!, { target: { value: 'IT Reseller' } })
    fireEvent.change(volume!, { target: { value: 'R2 000 – R5 000' } })
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/b2b/confirmed'))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/store\/b2b\/apply$/)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt_customer')
    expect(JSON.parse(init.body as string)).not.toHaveProperty('email')
  })

  it('asks the customer to sign in again when the session has expired', async () => {
    signedIn()
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Acme Office Supplies'), { target: { value: 'Acme' } })
    const [type, volume] = screen.getAllByRole('combobox')
    fireEvent.change(type!, { target: { value: 'Other' } })
    fireEvent.change(volume!, { target: { value: 'R10 000+' } })
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
