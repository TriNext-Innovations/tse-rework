import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type LogoVariant =
  | 'auto'       // follows the active theme — light logo on light, dark logo on dark (default)
  | 'color'      // force the light-background logo, regardless of theme
  | 'dark-bg'    // force the dark-background logo — for fixed dark panels (.panel-dark)
  | 'mono-white' // white silhouette — fallback where colour is unwanted
  | 'mono-dark'  // dark silhouette — fallback where colour is unwanted

interface LogoProps {
  variant?: LogoVariant
  /** Width in px — height scales at the logo's natural aspect ratio */
  width?: number
  /** Wraps in a <Link href="/"> when true (default) */
  linked?: boolean
  className?: string
}

const LIGHT_SRC = '/brand/logo-v2.svg'
const DARK_SRC = '/brand/logo-v2-dark.svg'
const ALT = 'TSE Online — Laserjet & Inkjet Cartridges'

// Artwork viewBox is 235x127 (~1.85:1)
const ASPECT = 235 / 127

const variantSrc: Record<Exclude<LogoVariant, 'auto'>, string> = {
  'color':      LIGHT_SRC,
  'dark-bg':    DARK_SRC,
  'mono-white': LIGHT_SRC,
  'mono-dark':  LIGHT_SRC,
}

const variantStyles: Record<LogoVariant, string> = {
  'auto':       '',
  'color':      '',
  'dark-bg':    '',
  'mono-white': '[filter:brightness(0)_invert(1)]',
  'mono-dark':  '[filter:brightness(0)]',
}

export function Logo({
  variant = 'auto',
  width = 120,
  linked = true,
  className,
}: LogoProps) {
  const height = Math.round(width / ASPECT)

  const shared = {
    width,
    height,
    priority: true,
    alt: '',
    'aria-hidden': true,
  } as const

  const img = (
    <span
      role="img"
      aria-label={ALT}
      className={cn('inline-flex shrink-0', variantStyles[variant], className)}
    >
      {variant === 'auto' ? (
        <>
          <Image
            src={LIGHT_SRC}
            {...shared}
            className="object-contain [[data-theme=dark]_&]:hidden"
          />
          <Image
            src={DARK_SRC}
            {...shared}
            className="hidden object-contain [[data-theme=dark]_&]:inline-block"
          />
        </>
      ) : (
        <Image src={variantSrc[variant]} {...shared} className="object-contain" />
      )}
    </span>
  )

  if (!linked) return img

  return (
    <Link href="/" aria-label="TSE Online home">
      {img}
    </Link>
  )
}
