import { describe, it, expect } from 'vitest'
import { SITE_URL, SITE_HOST, siteUrl } from '@/lib/site-url'

// These guard the two ways this module can silently poison every canonical on
// the site: inheriting the localhost dev value into a production build, or
// double-slashing when a path is joined onto the origin.
describe('site origin', () => {
  it('is an absolute https origin with no trailing slash', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/)
  })

  it('falls back to the real apex rather than the localhost dev value', () => {
    // .env.example ships NEXT_PUBLIC_SITE_URL=http://localhost:3000; inheriting
    // that in a build would stamp localhost into every canonical and JSON-LD id.
    expect(SITE_URL).not.toContain('localhost')
    expect(SITE_URL.startsWith('https://')).toBe(true)
  })

  it('derives the bare host for prose that names the site', () => {
    expect(SITE_HOST).toBe(new URL(SITE_URL).host)
    expect(SITE_HOST).not.toContain('/')
  })

  it('joins paths without doubling or dropping the slash', () => {
    expect(siteUrl('/products')).toBe(`${SITE_URL}/products`)
    expect(siteUrl('products')).toBe(`${SITE_URL}/products`)
  })
})
