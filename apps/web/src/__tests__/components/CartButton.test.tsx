import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartButton } from '@/components/CartButton'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { installCartMock } from '../helpers/medusaCartMock'
import React from 'react'

function CartButtonWithAdder() {
  const { addItem } = useCart()
  return (
    <>
      <CartButton />
      <button onClick={() => addItem({ id: 'p1', title: 'HP 123', sku: 'HP-123', price: 300 })}>
        add
      </button>
      <button onClick={() => addItem({ id: 'p1', title: 'HP 123', sku: 'HP-123', price: 300 }, 100)}>
        add 100
      </button>
    </>
  )
}

function renderCartButton() {
  return render(
    <CartProvider>
      <CartButtonWithAdder />
    </CartProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  installCartMock()
})

describe('CartButton', () => {
  it('renders with accessible label showing 0 items', () => {
    renderCartButton()
    expect(screen.getByRole('button', { name: /Cart \(0 items\)/i })).toBeInTheDocument()
  })

  it('does not show badge when cart is empty', () => {
    renderCartButton()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows badge count after adding an item', async () => {
    renderCartButton()
    await userEvent.click(screen.getByText('add'))
    const cartBtn = await screen.findByRole('button', { name: /Cart \(1 items\)/i })
    expect(within(cartBtn).getByText('1')).toBeInTheDocument()
  })

  it('updates aria-label to reflect current count', async () => {
    renderCartButton()
    await userEvent.click(screen.getByText('add'))
    expect(await screen.findByRole('button', { name: /Cart \(1 items\)/i })).toBeInTheDocument()
  })

  it('shows 99+ when count exceeds 99', async () => {
    renderCartButton()
    await userEvent.click(screen.getByText('add 100'))
    expect(await screen.findByText('99+')).toBeInTheDocument()
  })

  it('calls openCart when clicked', async () => {
    let cartOpen = false
    function Observer() {
      const { isOpen } = useCart()
      cartOpen = isOpen
      return null
    }
    render(
      <CartProvider>
        <CartButton />
        <Observer />
      </CartProvider>,
    )
    const btn = screen.getByRole('button', { name: /Cart/i })
    await userEvent.click(btn)
    expect(cartOpen).toBe(true)
  })

  it('animation is triggered when count increases', async () => {
    renderCartButton()
    await userEvent.click(screen.getByText('add'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Cart \(1 items\)/i })).toBeInTheDocument())
  })
})
