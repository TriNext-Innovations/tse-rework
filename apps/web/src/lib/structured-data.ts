// Structured data (JSON-LD) for the storefront.
//
// One business entity, defined once, referenced everywhere by `@id`.
//
// Before this module the root layout emitted a thin `Organization` (name, url,
// logo, foundingDate, and a locality-only address) while the contact page
// emitted a separate, fuller `Store` (street address, region, postal code,
// telephone, hours). Two unlinked nodes describing the same business, with
// different @types and disagreeing address detail, leaves a crawler to guess
// which one is authoritative. Now the full entity is emitted once in the root
// layout and every other page points at ORGANIZATION_ID instead of restating it.
//
// Every value below is traceable to something already recorded in the repo —
// site-config.ts, or copy already rendered on the contact page. Do not add
// hours, phone numbers, addresses, coordinates or social profiles here that the
// business has not actually confirmed; a published claim we cannot honour is
// worse than a missing field.

import { siteConfig } from './site-config'

export const SITE_URL = 'https://tse-cartridges.co.za'

/** Stable node id for the business. Reference this — never redefine the entity. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`

/** Stable node id for the site itself. */
export const WEBSITE_ID = `${SITE_URL}/#website`

/**
 * A pointer to the business entity, for `publisher`, `seller`, `mainEntity` and
 * friends. Emitting only the `@id` is what keeps the graph to a single node.
 */
export const organizationRef = { '@id': ORGANIZATION_ID } as const

/** A pointer to the WebSite entity, for `isPartOf`. */
export const websiteRef = { '@id': WEBSITE_ID } as const

/**
 * The business. Emitted once, sitewide, from the root layout.
 *
 * `Store` rather than `Organization`: TSE trades over a physical counter in Kya
 * Sands with published hours, which is what `Store` describes. `Store` is a
 * subtype of `LocalBusiness`, which is a subtype of `Organization`, so this one
 * node still satisfies every `publisher` and `seller` reference aimed at it.
 *
 * Deliberately absent, and why:
 *
 *  - `geo` — no coordinates for this address exist anywhere in the repo, and
 *    guessing latitude/longitude for a real trading address would be worse than
 *    omitting it. TODO(claus): add GeoCoordinates once the client confirms the
 *    pin, ideally from their Google Business Profile.
 *  - `sameAs` — the only social profile TSE links anywhere is
 *    facebook.com/technicalsystemscartridges, from the legacy tse.co.za footer.
 *    That URL no longer resolves to a live page (it returns Facebook's generic
 *    logged-out shell, identical to a page that does not exist, rather than the
 *    page name a live profile returns). Pointing `sameAs` at a dead profile is
 *    an entity-resolution signal that actively misleads, so it is left out.
 *    TODO(claus): reinstate once the client confirms a working profile URL.
 */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  '@id': ORGANIZATION_ID,
  name: siteConfig.company.brandName,
  legalName: siteConfig.company.legalName,
  alternateName: siteConfig.company.tradingName,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/logo-v2.svg`,
  image: `${SITE_URL}/brand/logo-v2.svg`,
  // NOTE: this site has said 1987 since launch; the legacy tse.co.za copy says
  // 1992. Unresolved — left as-is rather than silently picking a side. The
  // client has to settle it.
  foundingDate: '1987',
  telephone: siteConfig.phone.e164,
  email: siteConfig.email.sales,
  address: {
    '@type': 'PostalAddress',
    streetAddress: siteConfig.address.street,
    addressLocality: siteConfig.address.suburb,
    addressRegion: siteConfig.address.region,
    postalCode: siteConfig.address.postalCode,
    addressCountry: siteConfig.address.countryCode,
  },
  areaServed: siteConfig.address.countryCode,
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [...siteConfig.openingHours.days],
      opens: siteConfig.openingHours.opens,
      closes: siteConfig.openingHours.closes,
    },
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: siteConfig.phone.e164,
      email: siteConfig.email.sales,
      areaServed: siteConfig.address.countryCode,
      availableLanguage: ['en'],
    },
  ],
}

/** The site. Emitted once, sitewide, alongside the business entity. */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: siteConfig.company.brandName,
  url: SITE_URL,
  publisher: organizationRef,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/products?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
}
