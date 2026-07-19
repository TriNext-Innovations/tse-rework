import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '@/components/layout'
import React from 'react'

function getLogo() {
  return screen.getByRole('img', { name: /TSE Online/i })
}

describe('Logo', () => {
  it('renders with the correct accessible name', () => {
    render(<Logo linked={false} />)
    expect(getLogo()).toBeInTheDocument()
  })

  it('wraps in a link by default (linked=true)', () => {
    render(<Logo />)
    const link = screen.getByRole('link', { name: /TSE Online home/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('does not wrap in a link when linked=false', () => {
    render(<Logo linked={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(getLogo()).toBeInTheDocument()
  })

  it('renders both theme assets in auto variant', () => {
    render(<Logo linked={false} />)
    const imgs = getLogo().querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]!.getAttribute('src')).toContain('logo-v2')
    expect(imgs[1]!.getAttribute('src')).toContain('logo-v2-dark')
  })

  it('applies correct width and derived height', () => {
    render(<Logo width={120} linked={false} />)
    const img = getLogo().querySelector('img')!
    expect(img).toHaveAttribute('width', '120')
    expect(img).toHaveAttribute('height', '65')
  })

  it('uses the dark logo asset for dark-bg variant', () => {
    render(<Logo variant="dark-bg" linked={false} />)
    const imgs = getLogo().querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]!.getAttribute('src')).toContain('logo-v2-dark')
  })

  it('applies mono-dark filter class', () => {
    render(<Logo variant="mono-dark" linked={false} />)
    expect(getLogo().className).toContain('brightness(0)')
  })

  it('applies mono-white filter class', () => {
    render(<Logo variant="mono-white" linked={false} />)
    expect(getLogo().className).toContain('invert(1)')
  })

  it('accepts a custom className', () => {
    render(<Logo className="my-custom-class" linked={false} />)
    expect(getLogo().className).toContain('my-custom-class')
  })

  it('defaults to width=120', () => {
    render(<Logo linked={false} />)
    expect(getLogo().querySelector('img')).toHaveAttribute('width', '120')
  })
})
