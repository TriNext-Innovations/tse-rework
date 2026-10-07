import { describe, it, expect } from 'vitest'
import { safeNextPath, withNext } from '@/lib/next-path'

describe('safeNextPath', () => {
  it('keeps an internal path, hash included', () => {
    expect(safeNextPath('/b2b#apply', '/account/orders')).toBe('/b2b#apply')
    expect(safeNextPath('/checkout', '/account/orders')).toBe('/checkout')
  })

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '', null, undefined])(
    'falls back for %s',
    (raw) => {
      expect(safeNextPath(raw, '/account/orders')).toBe('/account/orders')
    },
  )
})

describe('withNext', () => {
  it('carries the destination, encoded', () => {
    expect(withNext('/account/login', '/b2b#apply')).toBe('/account/login?next=%2Fb2b%23apply')
  })

  it('leaves the link alone when there is nowhere to return to', () => {
    expect(withNext('/account/login', null)).toBe('/account/login')
  })
})
