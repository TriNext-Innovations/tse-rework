import type { Metadata } from 'next'
import { Navbar } from '@/components/layout'
import { SITE_URL, organizationRef } from '@/lib/structured-data'
import TrackClient from './TrackClient'

// Self-service parcel tracking (#330). Customers could previously only learn a
// shipment's status from the one email sent when the waybill was created, so
// anything after that ("where is it now?") became a phone call.
//
// Deliberately not behind a login: most orders are guest checkouts, and asking
// someone to make an account to find their parcel is how you get another phone
// call. Order number + the email the order was placed with is the credential.

export const metadata: Metadata = {
  title: 'Track My Parcel — TSE Online',
  description:
    'Track your TSE Online order. Enter your order number and email address to see where your printer cartridges are.',
  alternates: { canonical: `${SITE_URL}/track` },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Track My Parcel',
  url: `${SITE_URL}/track`,
  about: organizationRef,
}

export default function TrackPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="px-4 sm:px-8 lg:px-12 pt-32 sm:pt-36 pb-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-3">Track my parcel</h1>
          <p className="text-[var(--ink)]/70 mb-10 text-sm sm:text-base">
            Enter your order number and the email address you ordered with.
          </p>
          <TrackClient />
        </div>
      </main>
    </div>
  )
}
