import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { PromoCodeField } from '@/components/PromoCodeField'
import { installCartMock } from '../helpers/medusaCartMock'
import { discountLabel, manualPromoCodes } from '@/lib/checkout-cart'

// Renders the field alongside the numbers it is supposed to move, so the tests
// assert on what a shopper actually sees rather than on context internals.
function Harness() {
  const { addItem, goodsTotal, discountTotal, discountLabel: label, items } = useCart()
  return (
    <div>
      <button onClick={() => addItem({ id: 'prod_1', title: 'HP 123', sku: 'HP-123', price: 300 })}>Add</button>
      <div data-testid="lines">{items.length}</div>
      <div data-testid="goods">{goodsTotal}</div>
      <div data-testid="discount">{discountTotal}</div>
      <div data-testid="label">{label}</div>
      <PromoCodeField />
    </div>
  )
}

async function renderWithItem() {
  const user = userEvent.setup()
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  )
  await user.click(screen.getByText('Add'))
  await waitFor(() => expect(screen.getByTestId('lines')).toHaveTextContent('1'))
  return user
}

beforeEach(() => {
  installCartMock()
  localStorage.clear()
})

describe('PromoCodeField', () => {
  it('applies a valid code and reduces the discount total', async () => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), 'SAVE10')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByTestId('discount')).toHaveTextContent('10'))
    expect(screen.getByText('SAVE10')).toBeInTheDocument()
    // Cleared on success so the next code starts from an empty box.
    expect(screen.getByLabelText('Promo code')).toHaveValue('')
  })

  it.each([
    ['lower case', 'save10'],
    ['mixed case', 'SaVe10'],
    ['padded with spaces', '  SAVE10  '],
  ])('applies a code typed in %s — Medusa itself matches exactly', async (_label, typed) => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), typed)
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByTestId('discount')).toHaveTextContent('10'))
    // The chip shows the code as Medusa stores it, not as the shopper typed it.
    expect(screen.getByText('SAVE10')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects a promotion still in draft, which Medusa accepts with 200 but never applies', async () => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), 'DRAFTONLY')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByTestId('discount')).toHaveTextContent('0')
  })

  it('rejects an unknown code, which Medusa refuses with a 400', async () => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), 'NOTREAL')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/isn't a valid promo code/i)
    expect(screen.getByTestId('discount')).toHaveTextContent('0')
    // The rejected code stays put so the shopper can see the typo.
    expect(screen.getByLabelText('Promo code')).toHaveValue('NOTREAL')
  })

  it('removes an applied code and restores the total', async () => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), 'SAVE10')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.getByTestId('discount')).toHaveTextContent('10'))

    await user.click(screen.getByRole('button', { name: 'Remove promo code SAVE10' }))

    await waitFor(() => expect(screen.getByTestId('discount')).toHaveTextContent('0'))
    expect(screen.queryByText('SAVE10')).not.toBeInTheDocument()
  })

  it('clears the error as soon as the shopper edits the code', async () => {
    const user = await renderWithItem()

    await user.type(screen.getByLabelText('Promo code'), 'NOPE')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Promo code'), 'X')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not submit an empty or whitespace-only code', async () => {
    const user = await renderWithItem()

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    await user.type(screen.getByLabelText('Promo code'), '   ')
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  })

  it('switches the discount label once a code is applied', async () => {
    const user = await renderWithItem()
    expect(screen.getByTestId('label')).toHaveTextContent('Business discount')

    await user.type(screen.getByLabelText('Promo code'), 'SAVE10')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.getByTestId('label')).toHaveTextContent('Promo discount'))
  })
})

describe('promotion helpers', () => {
  const auto = { id: 'p_auto', code: 'B2B10', is_automatic: true }
  const manual = { id: 'p_code', code: 'SAVE10', is_automatic: false }

  it('excludes the automatic B2B discount from removable codes', () => {
    expect(manualPromoCodes([auto, manual])).toEqual(['SAVE10'])
    expect(manualPromoCodes([auto])).toEqual([])
    expect(manualPromoCodes(undefined)).toEqual([])
  })

  it('labels the discount line by which kinds are applied', () => {
    expect(discountLabel([auto])).toBe('Business discount')
    expect(discountLabel([manual])).toBe('Promo discount')
    expect(discountLabel([auto, manual])).toBe('Discounts')
    // No promotions at all: the line is not rendered, but the label must still
    // be a sensible string rather than undefined.
    expect(discountLabel([])).toBe('Business discount')
  })
})
