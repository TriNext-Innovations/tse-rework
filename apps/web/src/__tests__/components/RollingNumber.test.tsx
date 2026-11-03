import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { RollingNumber } from '@/components/motion'
import { allowMotion, resetMotion } from '../helpers/motion'

afterEach(resetMotion)

describe('RollingNumber', () => {
  it('renders the value', () => {
    render(<RollingNumber value={1240} />)
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('swaps straight to the new value under reduced motion', () => {
    const { container, rerender } = render(<RollingNumber value="1240" />)
    rerender(<RollingNumber value="1540" />)
    expect(screen.getByText('1540')).toBeInTheDocument()
    expect(container.querySelector('.roll')).toBeNull()
  })

  it('rolls only the digits that changed, upward when the number grows', () => {
    allowMotion()
    const { container, rerender } = render(<RollingNumber value="1240" />)
    rerender(<RollingNumber value="1540" />)
    const rolls = container.querySelectorAll('.roll')
    expect(rolls).toHaveLength(1)
    expect(rolls[0]).toHaveAttribute('data-prev', '2')
    expect(rolls[0]).toHaveAttribute('data-dir', 'up')
    // The outgoing digit is a pseudo-element: the DOM text is only the new value.
    expect(container.textContent).toBe('1540')
  })

  it('rolls downward when the number shrinks', () => {
    allowMotion()
    const { container, rerender } = render(<RollingNumber value={3} />)
    rerender(<RollingNumber value={2} />)
    expect(container.querySelector('.roll')).toHaveAttribute('data-dir', 'down')
  })

  it('aligns digits from the right when the length changes', () => {
    allowMotion()
    const { container, rerender } = render(<RollingNumber value={99} />)
    rerender(<RollingNumber value={100} />)
    const prev = [...container.querySelectorAll('.roll')].map((el) => el.getAttribute('data-prev'))
    expect(prev).toEqual(['', '9', '9'])
    expect(container.textContent).toBe('100')
  })

  it('does not animate on first render', () => {
    allowMotion()
    const { container } = render(<RollingNumber value={42} />)
    expect(container.querySelector('.roll')).toBeNull()
  })
})
