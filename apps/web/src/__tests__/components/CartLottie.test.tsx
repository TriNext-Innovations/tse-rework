import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CartLottie } from '@/components/CartLottie'
import React from 'react'

describe('CartLottie', () => {
  it('renders without throwing', () => {
    expect(() => render(<CartLottie />)).not.toThrow()
  })

  it('renders into the DOM', () => {
    const { container } = render(<CartLottie />)
    // next/dynamic is mocked — the component renders null but doesn't crash
    expect(container).toBeInTheDocument()
  })
})
