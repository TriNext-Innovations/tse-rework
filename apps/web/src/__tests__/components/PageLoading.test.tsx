import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PageLoading } from '@/components/motion'
import { announceNavigation } from '@/lib/motion'

// Links prevent their own default here, as Next's <Link> does.
const stop = (e: React.MouseEvent) => e.preventDefault()

function Page() {
  return (
    <>
      <PageLoading />
      <a href="/products" onClick={stop}>
        Shop
      </a>
      <a href="/products/hp-85a" onClick={stop}>
        <span>HP 85A</span>
        <button onClick={stop}>Add HP 85A</button>
      </a>
      <a href="https://payfast.co.za/" onClick={stop}>
        PayFast
      </a>
      <a href="/" onClick={stop}>
        Home
      </a>
      <a href="/products" target="_blank" onClick={stop}>
        New tab
      </a>
    </>
  )
}

const status = () => screen.getByRole('status')

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(usePathname).mockReturnValue('/')
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

afterEach(() => {
  vi.useRealTimers()
  delete document.documentElement.dataset.navigating
})

describe('PageLoading', () => {
  it('shows nothing until a navigation is slow', () => {
    render(<Page />)
    expect(status()).toHaveAttribute('data-visible', 'false')
    expect(status()).not.toHaveTextContent('Loading')
  })

  it('shows the orb and steps the page back when the next page is slow, and clears when it arrives', () => {
    const { rerender } = render(<Page />)
    fireEvent.click(screen.getByText('Shop'))
    act(() => vi.advanceTimersByTime(200))
    expect(status()).toHaveAttribute('data-visible', 'false')
    act(() => vi.advanceTimersByTime(150))
    expect(status()).toHaveAttribute('data-visible', 'true')
    // Says what is loading, not just that something is
    expect(status()).toHaveTextContent('Loading all cartridges…')
    expect(status().querySelector('.dot-orb')).not.toBeNull()
    expect(document.documentElement.dataset.navigating).toBe('page')

    vi.mocked(usePathname).mockReturnValue('/products')
    rerender(<Page />)
    expect(status()).toHaveAttribute('data-visible', 'false')
    expect(document.documentElement.dataset.navigating).toBeUndefined()
  })

  it('never shows for a navigation that lands quickly', () => {
    const { rerender } = render(<Page />)
    fireEvent.click(screen.getByText('Shop'))
    act(() => vi.advanceTimersByTime(150))
    vi.mocked(usePathname).mockReturnValue('/products')
    rerender(<Page />)
    act(() => vi.advanceTimersByTime(1000))
    expect(status()).toHaveAttribute('data-visible', 'false')
  })

  it.each([
    ['an add-to-cart button inside a card link', () => fireEvent.click(screen.getByText('Add HP 85A'))],
    ['an external link', () => fireEvent.click(screen.getByText('PayFast'))],
    ['a link to the page already showing', () => fireEvent.click(screen.getByText('Home'))],
    ['a link opening a new tab', () => fireEvent.click(screen.getByText('New tab'))],
    ['a cmd/ctrl-click', () => fireEvent.click(screen.getByText('Shop'), { metaKey: true })],
  ])('ignores %s', (_label, click) => {
    render(<Page />)
    click()
    act(() => vi.advanceTimersByTime(1000))
    expect(status()).toHaveAttribute('data-visible', 'false')
  })

  it('dims only the results for a filter or sort change on the same page', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Page />)
    act(() => announceNavigation('/?type=laser'))
    act(() => vi.advanceTimersByTime(350))
    expect(document.documentElement.dataset.navigating).toBe('results')
  })

  it('follows programmatic navigations announced with announceNavigation', () => {
    render(<Page />)
    act(() => announceNavigation('/compatibility?model=Canon%20MF273dw'))
    act(() => vi.advanceTimersByTime(350))
    expect(status()).toHaveAttribute('data-visible', 'true')
  })

  // Following a same-page #anchor fires popstate too; nothing is loading then.
  it('ignores the popstate a same-page #anchor fires', () => {
    render(<Page />)
    window.history.pushState(null, '', '/#finder')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(status()).toHaveAttribute('data-visible', 'false')
    window.history.pushState(null, '', '/')
  })

  it('shows for back/forward to another page', () => {
    render(<Page />)
    window.history.pushState(null, '', '/products')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    act(() => vi.advanceTimersByTime(350))
    expect(status()).toHaveAttribute('data-visible', 'true')
    window.history.pushState(null, '', '/')
  })

  it('gives up if the page never changes', () => {
    render(<Page />)
    fireEvent.click(screen.getByText('Shop'))
    act(() => vi.advanceTimersByTime(10_500))
    expect(status()).toHaveAttribute('data-visible', 'false')
    expect(document.documentElement.dataset.navigating).toBeUndefined()
  })
})
