import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('joins multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar')
  })

  it('handles nested arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('merges responsive Tailwind prefixes correctly', () => {
    expect(cn('text-sm', 'sm:text-base', 'lg:text-lg')).toBe('text-sm sm:text-base lg:text-lg')
  })

  it('handles conditional class objects via arrays', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
    expect(cn('base', !isActive && 'active')).toBe('base')
  })
})
