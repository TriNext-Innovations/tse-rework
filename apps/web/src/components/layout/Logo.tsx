import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  /** Rendered width in px — height scales proportionally (logo is ~2:1 wide) */
  width?: number
  /** If true, wraps the logo in a link to / */
  linked?: boolean
  className?: string
}

export function Logo({ width = 120, linked = true, className }: LogoProps) {
  const height = Math.round(width / 2)

  const img = (
    <Image
      src="/brand/logo.png"
      alt="TSE Online — Laserjet & Inkjet Cartridges"
      width={width}
      height={height}
      priority
      className={cn('object-contain', className)}
    />
  )

  if (!linked) return img

  return (
    <Link href="/" aria-label="TSE Online home">
      {img}
    </Link>
  )
}
