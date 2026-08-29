import { describe, it, expect } from 'vitest'
import {
  ORGANIZATION_ID,
  SITE_URL,
  WEBSITE_ID,
  organizationJsonLd,
  organizationRef,
  websiteJsonLd,
  websiteRef,
} from '@/lib/structured-data'
import { siteConfig } from '@/lib/site-config'

describe('the business entity', () => {
  it('has a stable @id other pages can point at', () => {
    expect(ORGANIZATION_ID).toBe('https://tse-cartridges.co.za/#organization')
    expect(organizationJsonLd['@id']).toBe(ORGANIZATION_ID)
    expect(organizationRef).toEqual({ '@id': ORGANIZATION_ID })
  })

  it('is a Store, which is still an Organization for publisher/seller purposes', () => {
    expect(organizationJsonLd['@type']).toBe('Store')
  })

  it('carries the naming trio', () => {
    expect(organizationJsonLd.name).toBe(siteConfig.company.brandName)
    expect(organizationJsonLd.legalName).toBe(siteConfig.company.legalName)
    expect(organizationJsonLd.alternateName).toBe(siteConfig.company.tradingName)
  })

  it('carries the full postal address, not just a locality', () => {
    expect(organizationJsonLd.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.suburb,
      addressRegion: siteConfig.address.region,
      postalCode: siteConfig.address.postalCode,
      addressCountry: 'ZA',
    })
  })

  it('carries reachable contact details and area served', () => {
    expect(organizationJsonLd.telephone).toBe(siteConfig.phone.e164)
    expect(organizationJsonLd.email).toBe(siteConfig.email.sales)
    expect(organizationJsonLd.areaServed).toBe('ZA')
    expect(organizationJsonLd.contactPoint[0]?.telephone).toBe(siteConfig.phone.e164)
    expect(organizationJsonLd.openingHoursSpecification[0]).toMatchObject({
      opens: '08:00',
      closes: '17:00',
    })
  })

  // Guardrails, not style points. This repo has twice shipped published claims it
  // could not honour; a passing typecheck would not have caught either one.
  it('states no fact that is not recorded in the repo', () => {
    // The 1987/1992 founding-date conflict is the client's to settle. Until then
    // this must not drift.
    expect(organizationJsonLd.foundingDate).toBe('1987')
    // No invented coordinates for a real trading address.
    expect(organizationJsonLd).not.toHaveProperty('geo')
    // No sameAs until a working profile URL is confirmed.
    expect(organizationJsonLd).not.toHaveProperty('sameAs')
  })

  it('serialises to JSON without losing anything', () => {
    expect(JSON.parse(JSON.stringify(organizationJsonLd))).toEqual(organizationJsonLd)
  })
})

describe('the website entity', () => {
  it('names the business as its publisher by reference, not by copy', () => {
    expect(websiteJsonLd['@id']).toBe(WEBSITE_ID)
    expect(websiteJsonLd.publisher).toEqual({ '@id': ORGANIZATION_ID })
    expect(websiteRef).toEqual({ '@id': WEBSITE_ID })
  })

  it('keeps the sitewide search action pointed at the product listing', () => {
    expect(websiteJsonLd.potentialAction.target).toBe(`${SITE_URL}/products?q={search_term_string}`)
  })

  it('is a different node from the business', () => {
    expect(websiteJsonLd['@id']).not.toBe(organizationJsonLd['@id'])
  })
})
