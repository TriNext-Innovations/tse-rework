import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportNoResults, MIN_REPORTABLE_QUERY } from '@/lib/product-search'

const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('reportNoResults', () => {
  it('posts the trimmed query so admin gets a missing-product alert', () => {
    reportNoResults('  canonmx494  ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/store\/search\/no-results$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ query: 'canonmx494' })
  })

  it('stays silent below the reportable length — the backend rejects those anyway', () => {
    reportNoResults('hp')
    reportNoResults(' a ')
    reportNoResults('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports at exactly the minimum length', () => {
    reportNoResults('x'.repeat(MIN_REPORTABLE_QUERY))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('swallows a failed report — a dead alert endpoint must not break search', async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new Error('network down')))
    expect(() => reportNoResults('canonmx494')).not.toThrow()
    await Promise.resolve()
  })
})
