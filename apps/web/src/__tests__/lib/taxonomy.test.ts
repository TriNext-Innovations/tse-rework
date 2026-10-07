import { describe, it, expect } from 'vitest'
import { TYPE_CATEGORIES, TYPE_PARENT, cartridgeTypeLabel, isBrandCategory } from '@/lib/taxonomy'

describe('taxonomy', () => {
  it('sells three types: inkjet cartridges, laser toner and refill ink', () => {
    expect(TYPE_CATEGORIES.map((t) => t.key)).toEqual(['inkjet', 'laser', 'ink'])
    expect(TYPE_PARENT.ink).toBe('Ink')
    expect(cartridgeTypeLabel('ink')).toBe('Ink')
  })

  it('never lists the top-level "Ink" category as a brand', () => {
    expect(isBrandCategory({ name: 'Ink', parent_category: null })).toBe(false)
    expect(isBrandCategory({ name: 'Ink' })).toBe(false)
  })

  it('still lists a brand under a type', () => {
    expect(isBrandCategory({ name: 'Epson', parent_category: { name: 'Ink' } })).toBe(true)
  })
})
