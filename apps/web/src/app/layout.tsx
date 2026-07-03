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

export const metadata: Metadata = {
  title: {
    default: 'TSE Online — Printer Cartridges South Africa',
    template: '%s | TSE Online',
  },
  description:
    "South Africa's printer cartridge specialist since 1987. Quality generic compatibles for HP, Canon, Epson, Brother, Samsung and more — next day delivery to JHB & PTA.",
  metadataBase: new URL('https://tse-cartridges.co.za'),
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
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
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
