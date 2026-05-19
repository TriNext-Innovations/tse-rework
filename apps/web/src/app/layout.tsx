import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { CartProvider } from '@/contexts/CartContext'

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

export const metadata: Metadata = {
  title: {
    default: 'TSE Online — Printer Cartridges South Africa',
    template: '%s | TSE Online',
  },
  description:
    "South Africa's trusted supplier of printer cartridges. OEM & compatible options for HP, Canon, Epson, Samsung, Brother, Lexmark and Xerox.",
  metadataBase: new URL('https://tse-cartridges.co.za'),
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, fraunces.variable)}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
