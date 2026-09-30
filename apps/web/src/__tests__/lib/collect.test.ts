import { describe, it, expect } from 'vitest'
import { isCollectOption, sortCollectLast, isOutsideCollectionProvince } from '@/lib/collect'

const collect = { name: 'Collect from Kya Sands Warehouse' }
const eco = { name: 'The Courier Guy — Economy (3–4 business days)' }
const pudo = { name: 'Pudo Locker Delivery' }

describe('isCollectOption', () => {
  it('recognises the collect option by name', () => {
    expect(isCollectOption(collect)).toBe(true)
  })

  it('does not treat courier or Pudo options as collect', () => {
    expect(isCollectOption(eco)).toBe(false)
    expect(isCollectOption(pudo)).toBe(false)
  })

  it('is false for no selection', () => {
    expect(isCollectOption(null)).toBe(false)
  })
})

describe('sortCollectLast', () => {
  it('moves collect to the end and keeps the rest in order', () => {
    expect(sortCollectLast([collect, eco, pudo])).toEqual([eco, pudo, collect])
  })
})

describe('isOutsideCollectionProvince', () => {
  it('flags provinces other than Gauteng', () => {
    expect(isOutsideCollectionProvince('KwaZulu-Natal')).toBe(true)
    expect(isOutsideCollectionProvince('Gauteng')).toBe(false)
    expect(isOutsideCollectionProvince('')).toBe(false)
  })
})
