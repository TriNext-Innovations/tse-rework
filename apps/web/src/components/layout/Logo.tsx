import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type LogoVariant =
  | 'color'      // full colour — for light backgrounds
  | 'dark-bg'    // full colour on a dark pill — for dark/coloured nav backgrounds
  | 'mono-white' // white silhouette — for solid dark backgrounds where the pill looks heavy
  | 'mono-dark'  // dark silhouette — for light backgrounds where you want a single colour mark

interface LogoProps {
  variant?: LogoVariant
  /** Width in px — height scales at the logo's natural 2:1 aspect ratio */
  width?: number
  /** Wraps in a <Link href="/"> when true (default) */
  linked?: boolean
  className?: string
}

const variantStyles: Record<LogoVariant, string> = {
  'color':      '',
  'dark-bg':    'bg-white rounded-lg px-2 py-1',
  'mono-white': '[filter:brightness(0)_invert(1)]',
  'mono-dark':  '[filter:brightness(0)]',
}

export function Logo({
  variant = 'color',
  width = 120,
  linked = true,
  className,
}: LogoProps) {
  const height = Math.round(width / 2)

  const img = (
    <span className={cn('inline-flex shrink-0', variantStyles[variant], className)}>
      <Image
        src="/brand/logo.png"
        alt="TSE Online — Laserjet & Inkjet Cartridges"
        width={width}
        height={height}
        priority
        className="object-contain"
      />
    </span>
  )

  if (!linked) return img

  return (
    <Link href="/" aria-label="TSE Online home">
      {img}
    </Link>
  )
}
