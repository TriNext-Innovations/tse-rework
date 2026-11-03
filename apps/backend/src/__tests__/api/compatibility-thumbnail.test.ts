import { describe, it, expect } from 'vitest'
import { ownThumbnail } from '../../api/store/compatibility/route'

describe('ownThumbnail', () => {
  it('accepts the R2 custom domain product images actually serve from', () => {
    const url = 'https://images.tse-cartridges.co.za/products/hp-177.jpg'
    expect(ownThumbnail(url)).toBe(url)
  })

  it('still accepts the hosts that predate the custom domain', () => {
    const r2 = 'https://pub-abc123.r2.dev/hp-177.jpg'
    const supabase = 'https://xyz.supabase.co/storage/v1/object/public/hp-177.jpg'
    expect(ownThumbnail(r2)).toBe(r2)
    expect(ownThumbnail(supabase)).toBe(supabase)
  })

  it('rejects the WordPress URLs the WooCommerce import left behind', () => {
    expect(ownThumbnail('https://tse.co.za/wp-content/uploads/hp-177.jpg')).toBeNull()
    expect(ownThumbnail('https://www.tse.co.za/wp-content/uploads/hp-177.jpg')).toBeNull()
  })

  it('matches named hosts exactly, not by suffix', () => {
    // A suffix test would wrongly accept this.
    expect(ownThumbnail('https://evilimages.tse-cartridges.co.za/x.jpg')).toBeNull()
  })

  it('is case-insensitive about the host', () => {
    const url = 'https://IMAGES.TSE-CARTRIDGES.CO.ZA/products/hp-177.jpg'
    expect(ownThumbnail(url)).toBe(url)
  })

  it('returns null for empty and malformed input rather than throwing', () => {
    expect(ownThumbnail(null)).toBeNull()
    expect(ownThumbnail(undefined)).toBeNull()
    expect(ownThumbnail('')).toBeNull()
    expect(ownThumbnail('not-a-url')).toBeNull()
  })
})
