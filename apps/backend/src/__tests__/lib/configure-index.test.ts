import { describe, it, expect, vi } from 'vitest'
import { configureIndex, SEARCH_INDEX } from '../../lib/search'

function fakeClient() {
  const index = {
    updateSearchableAttributes: vi.fn().mockResolvedValue(undefined),
    updateFilterableAttributes: vi.fn().mockResolvedValue(undefined),
    updateSortableAttributes: vi.fn().mockResolvedValue(undefined),
    updateRankingRules: vi.fn().mockResolvedValue(undefined),
    updateTypoTolerance: vi.fn().mockResolvedValue(undefined),
  }
  return { client: { index: vi.fn(() => index) } as any, index }
}

describe('configureIndex', () => {
  it('configures the products index', async () => {
    const { client } = fakeClient()
    await configureIndex(client)
    expect(client.index).toHaveBeenCalledWith(SEARCH_INDEX)
  })

  it('makes search_joins searchable, below the human-readable fields', async () => {
    const { client, index } = fakeClient()
    await configureIndex(client)

    const attrs = index.updateSearchableAttributes.mock.calls[0]![0] as string[]
    expect(attrs).toContain('search_joins')
    // Ranked after title and sku so exact matches still win `attribute`.
    expect(attrs.indexOf('search_joins')).toBeGreaterThan(attrs.indexOf('title'))
    expect(attrs.indexOf('search_joins')).toBeGreaterThan(attrs.indexOf('sku'))
  })

  it('disables typo tolerance on sku — W1106B must not find W1106A', async () => {
    const { client, index } = fakeClient()
    await configureIndex(client)

    const typo = index.updateTypoTolerance.mock.calls[0]![0] as any
    expect(typo.enabled).toBe(true)
    expect(typo.disableOnAttributes).toContain('sku')
  })

  it('never disables typo tolerance on search_joins', async () => {
    // Regression guard. Adding search_joins here reads like tightening the
    // identifier policy, but Meilisearch stops matching the attribute
    // altogether — "canonmx494" silently returns zero results and the
    // separator fix is undone with no test failing anywhere else.
    const { client, index } = fakeClient()
    await configureIndex(client)

    const typo = index.updateTypoTolerance.mock.calls[0]![0] as any
    expect(typo.disableOnAttributes).not.toContain('search_joins')
  })

  it('pins the typo word-size thresholds rather than inheriting defaults', async () => {
    const { client, index } = fakeClient()
    await configureIndex(client)

    const typo = index.updateTypoTolerance.mock.calls[0]![0] as any
    expect(typo.minWordSizeForTypos).toEqual({ oneTypo: 5, twoTypos: 9 })
  })
})
