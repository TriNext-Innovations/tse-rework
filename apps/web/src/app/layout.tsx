import type { Metadata } from 'next'
import { Inter, Bebas_Neue, DM_Serif_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas-neue' })
const dmSerif = DM_Serif_Display({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-dm-serif' })
const dmSans = DM_Sans({ weight: ['300', '400', '500', '600'], subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata: Metadata = {
  title: {
    default: 'TSE Online — Printer Cartridges South Africa',
    template: '%s | TSE Online',
  },
  description:
    "South Africa's trusted supplier of printer cartridges. OEM & compatible options for HP, Canon, Epson, Samsung, Brother, Lexmark and Xerox.",
  metadataBase: new URL('https://tseonline.co.za'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${bebasNeue.variable} ${dmSerif.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  )
}
