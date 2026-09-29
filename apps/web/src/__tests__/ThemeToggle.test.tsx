import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/ThemeToggle'
import { allowMotion, resetMotion } from './helpers/motion'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeToggle', () => {
  it('renders as a switch, unchecked (light) by default', () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('switch')
    expect(btn).toHaveAttribute('aria-checked', 'false')
    expect(btn).toHaveAccessibleName(/dark mode/i)
  })

  it('switches to dark: stamps <html data-theme> and persists to localStorage', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('switch'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('tse_theme')).toBe('dark')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles back to light on a second click', async () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('switch')
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('tse_theme')).toBe('light')
    expect(btn).toHaveAttribute('aria-checked', 'false')
  })

  it('reflects a pre-existing dark theme stamped before hydration', () => {
    document.documentElement.dataset.theme = 'dark'
    render(<ThemeToggle />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('reveals the new theme from the toggle through a view transition when the browser has one', async () => {
    allowMotion()
    const startViewTransition = vi.fn((cb: () => void) => {
      cb()
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })
    Object.defineProperty(document.documentElement, 'animate', { configurable: true, value: vi.fn() })

    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('switch'))
    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')

    delete (document as { startViewTransition?: unknown }).startViewTransition
    delete (document.documentElement as { animate?: unknown }).animate
    resetMotion()
  })
})
