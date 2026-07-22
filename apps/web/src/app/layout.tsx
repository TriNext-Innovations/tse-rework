import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { CartProvider } from '@/contexts/CartContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { CookieBanner } from '@/components/CookieBanner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
})

const SITE_NAME = 'TSE Online'
const DESCRIPTION =
  "South Africa's printer cartridge specialist since 1987. Quality generic compatibles for HP, Canon, Epson, Brother, Samsung and more — next day delivery to JHB & PTA."

export const metadata: Metadata = {
  title: {
    default: 'TSE Online — Printer Cartridges South Africa',
    template: '%s | TSE Online',
  },
  description: DESCRIPTION,
  metadataBase: new URL('https://tse-cartridges.co.za'),
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_ZA',
    url: 'https://tse-cartridges.co.za',
    title: 'TSE Online — Printer Cartridges South Africa',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TSE Online — Printer Cartridges South Africa',
    description: DESCRIPTION,
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: 'https://tse-cartridges.co.za',
  logo: 'https://tse-cartridges.co.za/brand/logo-v2.svg',
  foundingDate: '1987',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Kya Sands, Johannesburg',
    addressCountry: 'ZA',
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: 'https://tse-cartridges.co.za',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://tse-cartridges.co.za/products?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, fraunces.variable)} suppressHydrationWarning>
      <head>
        {/* Stamp the persisted theme before paint so dark mode doesn't flash light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tse_theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
