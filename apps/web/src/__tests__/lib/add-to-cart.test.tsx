import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { CartProvider } from '@/contexts/CartContext'
import { useAddToCart, addStatusMessage } from '@/lib/add-to-cart'
import { installCartMock } from '../helpers/medusaCartMock'

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>
const ITEM = { id: 'prod_1', title: 'HP 123', sku: 'HP-123', price: 300 }

beforeEach(() => {
  localStorage.clear()
  installCartMock()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useAddToCart', () => {
  it('is pending while the cart call runs, then added, then back to idle', async () => {
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    expect(result.current.status).toBe('idle')

    let adding!: Promise<boolean>
    act(() => {
      adding = result.current.add(ITEM)
    })
    expect(result.current.status).toBe('pending')

    await act(async () => {
      expect(await adding).toBe(true)
    })
    expect(result.current.status).toBe('added')

    await waitFor(() => expect(result.current.status).toBe('idle'), { timeout: 3000 })
  })

  it('reports an error when the line could not be added', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cartApi = global.fetch
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      String(url).includes('/line-items')
        ? ({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' } as Response)
        : cartApi(url, init),
    ) as typeof fetch

    const { result } = renderHook(() => useAddToCart(), { wrapper })
    await act(async () => {
      expect(await result.current.add(ITEM)).toBe(false)
    })
    expect(result.current.status).toBe('error')
  })
})

describe('addStatusMessage', () => {
  it('announces the outcome and stays silent otherwise', () => {
    expect(addStatusMessage('added', 'HP 85A')).toBe('HP 85A added to cart')
    expect(addStatusMessage('error', 'HP 85A')).toMatch(/Couldn't add HP 85A/)
    expect(addStatusMessage('pending', 'HP 85A')).toBe('')
    expect(addStatusMessage('idle', 'HP 85A')).toBe('')
  })
})
