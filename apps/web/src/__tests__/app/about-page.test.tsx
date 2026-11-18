import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/layout', () => ({ Navbar: () => null }))
vi.mock('@sentry/nextjs', () => ({ withSentryConfig: (c: unknown) => c }))

import AboutPage, { metadata } from '@/app/(storefront)/about/page'
import { Footer } from '@/components/layout/Footer'
import { PremisesPhoto, PREMISES_PHOTO } from '@/components/about/PremisesPhoto'
import { siteConfig } from '@/lib/site-config'
import { ORGANIZATION_ID, organizationJsonLd } from '@/lib/structured-data'

function jsonLd(container: HTMLElement) {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
    JSON.parse(s.textContent ?? '{}'),
  )
}

describe('/about (#478)', () => {
  it('covers how long TSE has traded, the premises, and what generics are', () => {
    render(<AboutPage />)
    const text = document.body.textContent ?? ''

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(siteConfig.company.foundedYear)
    expect(text).toContain(siteConfig.address.street)
    expect(text).toContain(siteConfig.address.postalCode)
    for (const h of siteConfig.openingHours) expect(text).toContain(h.display)

    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(h2s).toEqual(expect.arrayContaining([expect.stringMatching(/generic/i), expect.stringMatching(/compromise/i)]))
    // The compliance line the terms page carries: brand names identify printers only.
    expect(text).toMatch(/not made by the printer manufacturer/)
  })

  it('points at the sitewide business entity instead of defining a second one', () => {
    const { container } = render(<AboutPage />)
    const nodes = jsonLd(container)

    expect(nodes).toHaveLength(1)
    expect(nodes[0]['@type']).toBe('AboutPage')
    expect(nodes[0].mainEntity).toEqual({ '@id': ORGANIZATION_ID })
    // No competing Organization/Store/LocalBusiness node with its own address.
    expect(JSON.stringify(nodes)).not.toMatch(/"(Organization|Store|LocalBusiness)"|PostalAddress/)
    // The entity it points at carries the address shown on the page.
    expect(organizationJsonLd['@id']).toBe(ORGANIZATION_ID)
    expect(organizationJsonLd.address.streetAddress).toBe(siteConfig.address.street)
    expect(organizationJsonLd.foundingDate).toBe(siteConfig.company.foundedYear)
  })

  it('ships no imagery until a real premises photo exists', () => {
    const { container } = render(<AboutPage />)
    expect(PREMISES_PHOTO).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders the premises slot once a photo is supplied', () => {
    render(<PremisesPhoto photo={{ src: '/about/premises.jpg', alt: 'The TSE counter', width: 1200, height: 800 }} />)
    expect(screen.getByTestId('premises-photo')).toBeTruthy()
    expect(screen.getByAltText('The TSE counter')).toBeTruthy()
  })

  it('has a canonical, OpenGraph tags and a snippet short enough to show in full', () => {
    expect(metadata.alternates?.canonical).toMatch(/\/about$/)
    const og = metadata.openGraph as { url?: string; title?: string; siteName?: string }
    expect(og.url).toMatch(/\/about$/)
    expect(og.title).toMatch(/About/)
    expect(og.siteName).toBe(siteConfig.company.brandName)
    // Overriding openGraph/twitter drops the inherited share image unless it is restated.
    const ogImages = (metadata.openGraph as { images?: Array<{ url: string }> }).images
    expect(ogImages?.[0]?.url).toBe('/opengraph-image')
    const tw = metadata.twitter as { card?: string; images?: string[] }
    expect(tw.card).toBe('summary_large_image')
    expect(tw.images?.[0]).toBe('/opengraph-image')
    expect((metadata.description as string).length).toBeLessThanOrEqual(155)
  })

  it('is linked from the footer, which renders on the homepage', () => {
    render(<Footer />)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/about')
  })

  it('takes over /about-us and /about-us/ with a 301', async () => {
    // nginx answers first on www.tse.co.za and normalises the trailing slash.
    const conf = readFileSync(
      join(import.meta.dirname, '../../../../../infrastructure/nginx/conf.d/00-legacy-redirects.conf'),
      'utf8',
    )
    expect(conf).toMatch(/^\s{4}\/about-us\s+\/about;$/m)
    expect(conf).toMatch(/~\^\(\?<stripped>\.\+\)\/\$/)

    // The generator's MANUAL table must carry it too, or a regeneration drops it.
    const script = readFileSync(join(import.meta.dirname, '../../../../../scripts/build-legacy-redirects.ts'), 'utf8')
    expect(script).toMatch(/'\/about-us': '\/about'/)

    // Backstop for requests that reach Next directly.
    const { default: config } = await import('../../../next.config')
    const rules = await config.redirects!()
    expect(rules).toContainEqual(expect.objectContaining({ source: '/about-us', destination: '/about', statusCode: 301 }))
  })
})
