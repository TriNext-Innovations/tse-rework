import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import ResetPasswordPage from '@/app/(storefront)/account/reset-password/page'
import { CartProvider } from '@/contexts/CartContext'

function base64UrlEncode(json: object): string {
  return Buffer.from(JSON.stringify(json))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function makeToken(payload: object): string {
  return `header.${base64UrlEncode(payload)}.signature`
}

function setToken(token: string) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ token }) as any)
}

describe('ResetPasswordPage', () => {
  it('shows the update-password form for a valid, unexpired reset token', () => {
    setToken(makeToken({ purpose: 'reset', exp: Math.floor(Date.now() / 1000) + 900 }))
    render(<CartProvider><ResetPasswordPage /></CartProvider>)
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('shows an invalid/expired message instead of the form for an expired token', () => {
    setToken(makeToken({ purpose: 'reset', exp: Math.floor(Date.now() / 1000) - 900 }))
    render(<CartProvider><ResetPasswordPage /></CartProvider>)
    expect(screen.queryByRole('button', { name: /update password/i })).not.toBeInTheDocument()
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows an invalid/expired message for a malformed token', () => {
    setToken('not-a-real-jwt')
    render(<CartProvider><ResetPasswordPage /></CartProvider>)
    expect(screen.queryByRole('button', { name: /update password/i })).not.toBeInTheDocument()
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows an invalid/expired message when there is no token at all', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as any)
    render(<CartProvider><ResetPasswordPage /></CartProvider>)
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })

  it('shows an invalid/expired message for a token missing purpose=reset', () => {
    setToken(makeToken({ exp: Math.floor(Date.now() / 1000) + 900 }))
    render(<CartProvider><ResetPasswordPage /></CartProvider>)
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument()
  })
})
