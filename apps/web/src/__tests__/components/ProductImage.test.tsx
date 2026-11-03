import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { ProductImage } from '@/components/motion'

// The shared next/image mock drops onLoad; this one keeps it so the load can be simulated.
vi.mock('next/image', () => ({
  default: ({ src, alt, className, onLoad }: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement('img', { src, alt, className, onLoad }),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const photo = () => (
  <ProductImage src="https://images.example/hp-85a.jpg" alt="HP 85A" width={180} height={220} className="h-31 w-auto" />
)

describe('ProductImage', () => {
  it('shows the orb in place of a photo that is slow to arrive, and removes it when it lands', () => {
    const { container } = render(photo())
    expect(container.querySelector('.img-orb')).toBeNull()
    act(() => vi.advanceTimersByTime(300))
    expect(container.querySelector('.img-orb .dot-orb')).not.toBeNull()
    fireEvent.load(screen.getByAltText('HP 85A'))
    expect(container.querySelector('.img-orb')).toBeNull()
  })

  it('never shows the orb for a photo that loads quickly', () => {
    const { container } = render(photo())
    fireEvent.load(screen.getByAltText('HP 85A'))
    act(() => vi.advanceTimersByTime(1000))
    expect(container.querySelector('.img-orb')).toBeNull()
  })

  it("keeps the caller's classes and still calls their onLoad", () => {
    const onLoad = vi.fn()
    render(<ProductImage src="https://images.example/a.jpg" alt="A" width={10} height={10} className="h-28" onLoad={onLoad} />)
    const img = screen.getByAltText('A')
    expect(img).toHaveClass('h-28')
    fireEvent.load(img)
    expect(onLoad).toHaveBeenCalledOnce()
  })
})
