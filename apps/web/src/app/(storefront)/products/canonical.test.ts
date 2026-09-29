import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.tse.co.za')

// #492: the listing's canonical decides which of its many URLs Google indexes.
describe('/products canonical', () => {
  async function canonical(params: Record<string, string>) {
    const { generateMetadata } = await import('./page')
    const meta = await generateMetadata({ searchParams: Promise.resolve(params) })
    return meta.alternates?.canonical
  }

  it('is self-referencing for the plain listing and page 1', async () => {
    expect(await canonical({})).toBe('https://www.tse.co.za/products')
    expect(await canonical({ page: '1' })).toBe('https://www.tse.co.za/products')
  })

  it('keeps unfiltered pagination indexable', async () => {
    expect(await canonical({ page: '3' })).toBe('https://www.tse.co.za/products?page=3')
  })

  it('folds every filtered, sorted or searched view into the plain listing', async () => {
    for (const params of [
      { brand: 'hp' },
      { category: 'toner' },
      { type: 'laser' },
      { sort: 'price_asc' },
      { q: '85a' },
      { brand: 'hp', page: '2' },
    ]) {
      expect(await canonical(params)).toBe('https://www.tse.co.za/products')
    }
  })

  it('treats a junk page number as page 1', async () => {
    expect(await canonical({ page: 'abc' })).toBe('https://www.tse.co.za/products')
    expect(await canonical({ page: '-4' })).toBe('https://www.tse.co.za/products')
  })
})
