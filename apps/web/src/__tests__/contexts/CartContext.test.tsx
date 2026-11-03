import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
    await userEvent.click(screen.getByText('Add HP'))
    await userEvent.click(screen.getByText('Open')) // adding does not auto-open; open it explicitly
    expect(await screen.findAllByText(/SKU HP-123/)).not.toHaveLength(0)
  })

  it('shows subtotal and checkout button when items present', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await userEvent.click(screen.getByText('Open'))
    expect(await screen.findByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText(/Checkout/)).toBeInTheDocument()
  })

  it('adding an item does not open the cart drawer', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(screen.getByTestId('is-open').textContent).toBe('false')
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

  it('addItem resolves true once the line is in the cart and counts the add', async () => {
    let api!: ReturnType<typeof useCart>
    function Grab() {
      api = useCart()
      return null
    }
    render(
      <CartProvider>
        <Grab />
      </CartProvider>,
    )
    expect(api.addSeq).toBe(0)
    let ok: boolean | undefined
    await act(async () => {
      ok = await api.addItem({ id: 'prod_1', title: 'HP 123', sku: 'HP-123', price: 300 })
    })
    expect(ok).toBe(true)
    expect(api.addSeq).toBe(1)
    expect(api.count).toBe(1)
  })

  it('addItem resolves false when Medusa rejects the line, and does not count it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cartApi = global.fetch
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
      String(url).includes('/line-items')
        ? ({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' } as Response)
        : cartApi(url, init),
    ) as typeof fetch
    let api!: ReturnType<typeof useCart>
    function Grab() {
      api = useCart()
      return null
    }
    render(
      <CartProvider>
        <Grab />
      </CartProvider>,
    )
    let ok: boolean | undefined
    await act(async () => {
      ok = await api.addItem({ id: 'prod_1', title: 'HP 123', sku: 'HP-123', price: 300 })
    })
    expect(ok).toBe(false)
    expect(api.addSeq).toBe(0)
    spy.mockRestore()
  })

  it('shows placeholder lines, not "empty", while a saved cart is still loading', async () => {
    localStorage.setItem('tse_cart_id', 'cart_saved')
    let answer!: (v: unknown) => void
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    ) as unknown as typeof fetch
    renderCart()
    await userEvent.click(screen.getByText('Open'))
    expect(screen.getByLabelText('Loading your cart')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument()

    // The saved cart turns out to be gone: the drawer settles on the empty state.
    await act(async () => {
      answer({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' })
    })
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading your cart')).not.toBeInTheDocument()
  })

  it('marks a line busy while its quantity is being updated', async () => {
    renderCart()
    await userEvent.click(screen.getByText('Add HP'))
    await userEvent.click(screen.getByText('Open'))
    const more = await screen.findByLabelText('Increase quantity')
    const line = more.closest('li') as HTMLElement
    fireEvent.click(more)
    expect(line).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(line).not.toHaveAttribute('aria-busy'))
    expect(screen.getByTestId('count').textContent).toBe('2')
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
