import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddToCartButton } from '@/app/(storefront)/products/AddToCartButton'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { installCartMock } from '../helpers/medusaCartMock'
import React from 'react'

beforeEach(() => {
  localStorage.clear()
  installCartMock()
})

function renderButton(props = {}) {
  const defaults = { id: 'prod_1', title: 'HP 123 Black', sku: 'HP-123-BK', price: 300 }
  return render(
    <CartProvider>
      <AddToCartButton {...defaults} {...props} />
    </CartProvider>,
  )
}

describe('AddToCartButton', () => {
  it('renders a button with correct aria-label', () => {
    renderButton()
    expect(screen.getByRole('button', { name: /Add HP 123 Black to cart/i })).toBeInTheDocument()
  })

  it('renders the plus icon SVG', () => {
    renderButton({ title: 'Canon 737' })
    const btn = screen.getByRole('button', { name: /Add Canon 737 to cart/i })
    expect(btn.querySelector('svg')).toBeInTheDocument()
  })

  it('stops event propagation on click', () => {
    const parentHandler = vi.fn()
    render(
      <CartProvider>
        <div onClick={parentHandler}>
          <AddToCartButton id="prod_1" title="HP 123 Black" sku="HP-123-BK" price={300} />
        </div>
      </CartProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Add HP 123 Black to cart/i }))
    expect(parentHandler).not.toHaveBeenCalled()
  })

  it('adds item to cart when clicked', async () => {
    function Inspector() {
      const { items } = useCart()
      return <div data-testid="cart-count">{items.length}</div>
    }
    render(
      <CartProvider>
        <AddToCartButton id="prod_x" title="Test" sku="TST-1" price={100} />
        <Inspector />
      </CartProvider>,
    )
    expect(screen.getByTestId('cart-count').textContent).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: /Add Test to cart/i }))
    await waitFor(() => expect(screen.getByTestId('cart-count').textContent).toBe('1'))
  })

  it('renders for null price (POA products)', () => {
    renderButton({ price: null })
    expect(screen.getByRole('button', { name: /Add HP 123 Black to cart/i })).toBeInTheDocument()
  })

  // #498: the button sits inside the card's link. Without preventDefault the
  // browser followed the link after adding, taking the shopper off the listing.
  it('does not follow the card link it sits in', () => {
    render(
      <CartProvider>
        <a href="/products/hp-123-black">
          <AddToCartButton id="prod_1" title="HP 123 Black" sku="HP-123-BK" price={300} />
        </a>
      </CartProvider>,
    )
    const followed = fireEvent.click(screen.getByRole('button', { name: /Add HP 123 Black to cart/i }))
    expect(followed).toBe(false)
  })

  it('shows the added state and announces it once the line is in the cart', async () => {
    renderButton({ id: 'prod_1', title: 'HP 123 Black' })
    const btn = screen.getByRole('button', { name: /Add HP 123 Black to cart/i })
    expect(btn).toHaveAttribute('data-status', 'idle')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('data-status', 'pending')
    await waitFor(() => expect(btn).toHaveAttribute('data-status', 'added'))
    expect(screen.getByText('HP 123 Black added to cart')).toBeInTheDocument()
  })
})
