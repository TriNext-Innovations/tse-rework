import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '@/components/layout'
import React from 'react'

describe('Logo', () => {
  it('renders an image with the correct alt text', () => {
    render(<Logo />)
    expect(screen.getByAltText(/TSE Online/i)).toBeInTheDocument()
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
    expect(screen.getByAltText(/TSE Online/i)).toBeInTheDocument()
  })

  it('applies correct width and derived height', () => {
    render(<Logo width={120} linked={false} />)
    const img = screen.getByAltText(/TSE Online/i)
    expect(img).toHaveAttribute('width', '120')
    expect(img).toHaveAttribute('height', '60')
  })

  it('applies mono-dark filter class for dark variant', () => {
    render(<Logo variant="mono-dark" linked={false} />)
    const wrapper = screen.getByAltText(/TSE Online/i).parentElement!
    expect(wrapper.className).toContain('brightness(0)')
  })

  it('applies dark-bg background class for dark-bg variant', () => {
    render(<Logo variant="dark-bg" linked={false} />)
    const wrapper = screen.getByAltText(/TSE Online/i).parentElement!
    expect(wrapper.className).toContain('bg-white')
  })

  it('applies mono-white filter class', () => {
    render(<Logo variant="mono-white" linked={false} />)
    const wrapper = screen.getByAltText(/TSE Online/i).parentElement!
    expect(wrapper.className).toContain('invert(1)')
  })

  it('accepts a custom className', () => {
    render(<Logo className="my-custom-class" linked={false} />)
    const wrapper = screen.getByAltText(/TSE Online/i).parentElement!
    expect(wrapper.className).toContain('my-custom-class')
  })

  it('defaults to width=120', () => {
    render(<Logo linked={false} />)
    const img = screen.getByAltText(/TSE Online/i)
    expect(img).toHaveAttribute('width', '120')
  })
})
