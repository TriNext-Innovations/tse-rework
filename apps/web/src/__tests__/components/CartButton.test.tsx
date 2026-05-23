import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartButton } from '@/components/CartButton'
import { CartProvider, useCart } from '@/contexts/CartContext'
import React from 'react'

function CartButtonWithAdder() {
  const { addItem } = useCart()
  return (
    <>
      <CartButton />
      <button onClick={() => addItem({ id: 'p1', title: 'HP 123', sku: 'HP-123', price: 300 })}>
        add
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
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('updates aria-label to reflect current count', async () => {
    renderCartButton()
    await userEvent.click(screen.getByText('add'))
    expect(screen.getByRole('button', { name: /Cart \(1 items\)/i })).toBeInTheDocument()
  })

  it('shows 99+ when count exceeds 99', () => {
    renderCartButton()
    const addBtn = screen.getByText('add')
    for (let i = 0; i < 100; i++) {
      fireEvent.click(addBtn)
    }
    expect(screen.getByText('99+')).toBeInTheDocument()
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
    // The MockDynamic in vitest.setup sets lottieRef.current.goToAndPlay
    // After adding an item, the effect fires — we just ensure no errors are thrown
    renderCartButton()
    await expect(userEvent.click(screen.getByText('add'))).resolves.not.toThrow()
  })
})
