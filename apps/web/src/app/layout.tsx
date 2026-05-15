import type { Metadata } from 'next'
import { Inter, Fraunces, Geist } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ weight: ['300', '400', '500', '600', '700', '900'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-fraunces' })

export const metadata: Metadata = {
  title: {
    default: 'TSE Online — Printer Cartridges South Africa',
    template: '%s | TSE Online',
  },
  description:
    "South Africa's trusted supplier of printer cartridges. OEM & compatible options for HP, Canon, Epson, Samsung, Brother, Lexmark and Xerox.",
  metadataBase: new URL('https://tse.co.za'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.className} ${fraunces.variable}`}>{children}</body>
    </html>
  )
}
