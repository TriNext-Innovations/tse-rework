import { describe, it, expect, vi } from 'vitest'

// next/font only works inside the Next compiler.
vi.mock('next/font/google', () => {
  const font = () => ({ variable: '', className: '' })
  return { Inter: font, Fraunces: font }
})
import { metadata } from '@/app/layout'

describe('root layout metadata', () => {
  // Google truncates snippets at roughly 155–160 characters (#521).
  it('keeps the site description short enough to show in full in search results', () => {
    expect(typeof metadata.description).toBe('string')
    expect((metadata.description as string).length).toBeLessThanOrEqual(155)
    expect(metadata.openGraph?.description ?? metadata.description).toBe(metadata.description)
  })
})
