import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { installCartMock } from '../helpers/medusaCartMock'
import React from 'react'

// The cart is now backed by a real Medusa cart (server source of truth); these
// tests mock the store cart API and assert against the server-derived state.

function CartConsumer() {
  const { items, count, addItem, removeItem, isOpen, openCart, closeCart } = useCart()
  return (
    <div>
      <div data-testid="count">{count}</div>
      <div data-testid="item-count">{items.length}</div>
      <div data-testid="is-open">{String(isOpen)}</div>
      {items.map((item) => (
        <div key={item.id} data-testid={`item-${item.sku}`}>
          {item.title} × {item.qty} @ {item.price}
        </div>
      ))}
      <button onClick={() => addItem({ id: 'prod_1', title: 'HP 123', sku: 'HP-123', price: 300 })}>
        Add HP
      </button>
      <button onClick={() => addItem({ id: 'prod_2', title: 'Canon 737', sku: 'CAN-737', price: 450 })}>
        Add Canon
      </button>
      <button onClick={() => items[0] && removeItem(items[0].id)}>Remove first</button>
      <button onClick={() => removeItem('li_does_not_exist')}>Remove bogus</button>
      <button onClick={openCart}>Open</button>
      <button onClick={closeCart}>Close</button>
    </div>
  )
}

function renderCart() {
  return render(
    <CartProvider>
      <CartConsumer />
    </CartProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  installCartMock()
})

describe('CartProvider', () => {
  it('renders children', () => {
    render(
      <CartProvider>
        <p>hello</p>
      </CartProvider>,
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('starts with zero items and closed cart', () => {
    renderCart()
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('item-count').textContent).toBe('0')
    expect(screen.getByTestId('is-open').textContent).toBe('false')
  })

  it('adds a new item with qty 1', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(screen.getByTestId('item-count').textContent).toBe('1')
    expect(screen.getByTestId('item-HP-123')).toHaveTextContent('HP 123 × 1')
  })

  it('increments qty when same item is added twice', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(screen.getByTestId('item-count').textContent).toBe('1')
    expect(screen.getByTestId('item-HP-123')).toHaveTextContent('HP 123 × 2')
  })

  it('tracks multiple distinct items', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await userEvent.click(screen.getByText('Add Canon'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(screen.getByTestId('item-count').textContent).toBe('2')
  })

  it('removes an item entirely', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await userEvent.click(screen.getByText('Remove first'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    expect(screen.getByTestId('item-count').textContent).toBe('0')
  })

  it('removing non-existent item does nothing', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add Canon'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await userEvent.click(screen.getByText('Remove bogus'))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('opens and closes the cart drawer', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('is-open').textContent).toBe('true')
    await userEvent.click(screen.getByText('Close'))
    expect(screen.getByTestId('is-open').textContent).toBe('false')
  })

  it('cart drawer renders close button', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByLabelText('Close cart')).toBeInTheDocument()
  })

  it('clicking backdrop closes the drawer', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    const backdrop = document.querySelector('.absolute.inset-0.bg-black\\/40') as HTMLElement
    if (backdrop) fireEvent.click(backdrop)
    expect(screen.getByTestId('is-open').textContent).toBe('false')
  })

  it('shows empty cart lottie when no items and cart is open', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('shows items in drawer when cart has products', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP')) // adding opens the drawer
    expect(await screen.findAllByText(/SKU HP-123/)).not.toHaveLength(0)
  })

  it('shows subtotal and checkout button when items present', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    expect(await screen.findByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText(/Checkout/)).toBeInTheDocument()
  })

  it('can remove item from drawer', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    const removeBtn = await screen.findByLabelText('Remove item')
    await userEvent.click(removeBtn)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
  })

  it('count header shows correct singular/plural', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByText('0 items')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Add HP'))
    expect(await screen.findByText('1 item')).toBeInTheDocument()
  })

  it('persists only the cart_id in localStorage', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(localStorage.getItem('tse_cart_id')).toMatch(/^cart_/))
    // No item/price snapshot is persisted.
    expect(localStorage.getItem('tse_cart')).toBeNull()
  })
})

describe('useCart outside provider', () => {
  it('throws when used outside CartProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BadConsumer() {
      useCart()
      return null
    }
    expect(() => render(<BadConsumer />)).toThrow('useCart must be used within CartProvider')
    spy.mockRestore()
  })
})
