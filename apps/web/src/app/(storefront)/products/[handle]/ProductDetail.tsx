'use client'

import { useState, useCallback, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cartridgeTypeLabel } from '@/lib/taxonomy'
import { htmlToParagraphs } from '@/lib/html-text'
import { useAddToCart, addStatusMessage } from '@/lib/add-to-cart'
import { bubbleImage, prefersReducedMotion } from '@/lib/motion'
import {
  AddStatusAnnouncer,
  AddToCartLabel,
  NAV_BACK,
  NAV_FORWARD,
  PageTransition,
  ProductImage,
  ProductMorph,
  RollingNumber,
} from '@/components/motion'

type Category = { id: string; name: string; handle: string }
type ProductImage = { url: string }
type Variant = {
  id: string
  title?: string
  sku?: string
  calculated_price?: { calculated_amount?: number }
  options?: Array<{ value: string; option?: { title?: string } }>
}
type Product = {
  id: string
  title: string
  description?: string
  handle: string
  images?: ProductImage[]
  variants?: Variant[]
  options?: Array<{ id: string; title: string; values?: Array<{ value: string }> }>
  metadata?: Record<string, unknown>
}

// Visual swatch colour for known cartridge colours; falls back to neutral grey
const SWATCH: Record<string, string> = {
  black:   '#111827',
  cyan:    '#00b8d4',
  magenta: '#d81b60',
  yellow:  '#fbc02d',
  colour:  'linear-gradient(135deg,#00b8d4 0%,#d81b60 50%,#fbc02d 100%)',
  color:   'linear-gradient(135deg,#00b8d4 0%,#d81b60 50%,#fbc02d 100%)',
}
const swatchStyle = (label: string): React.CSSProperties => {
  const v = SWATCH[label.toLowerCase()]
  if (!v) return { background: 'var(--muted-2)' }
  return v.startsWith('linear') ? { background: v } : { background: v }
}

type Props = {
  product: Product
  related: Product[]
  brandCategory: Category | null
  typeCategory: Category | null
}

// Where the lightbox image starts from and returns to: the main image's box.
function flipFrom(from: DOMRect, to: DOMRect): string {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const s = Math.min(from.width / to.width, from.height / to.height)
  return `translate(${dx}px, ${dy}px) scale(${s})`
}

export default function ProductDetail({ product, related, brandCategory, typeCategory }: Props) {
  const { status: addStatus, add } = useAddToCart()

  const images = product.images ?? []
  const variants = product.variants ?? []

  const [activeImage, setActiveImage] = useState(0)
  // Set once a thumbnail has been picked: only then does the main image
  // cross-fade, so it doesn't fade in on arrival (or fight the grid morph).
  const [gallerySwapped, setGallerySwapped] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxPoster, setLightboxPoster] = useState('')
  const [qty, setQty] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '')
  const mainImageRef = useRef<HTMLDivElement>(null)
  const lightboxRef = useRef<HTMLDivElement>(null)
  const lightboxFrameRef = useRef<HTMLDivElement>(null)
  const variantGroupRef = useRef<HTMLDivElement>(null)
  const [variantPill, setVariantPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const variant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]
  const sku = variant?.sku ?? '—'
  const priceZar = variant?.calculated_price?.calculated_amount
    ? Math.round(variant.calculated_price.calculated_amount)
    : null

  // Single colour-like option (Black/Cyan/Magenta/Yellow) — render as swatches
  const colourOption = product.options?.find((o) => /colou?r/i.test(o.title))
  const hasMultipleVariants = variants.length > 1

  // The button reports the real outcome (lib/add-to-cart): "Adding…" while the
  // cart call runs, then the tick draws and a bubble carrying the product's
  // picture rises from the button to the cart in the navbar.
  const handleAddToCart = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!variant) return
      void add(
        {
          id: `${product.id}-${variant.id}`,
          title: product.title,
          sku,
          price: priceZar,
          thumbnail: images[0]?.url,
          variantId: variant.id,
        },
        { quantity: qty, from: e.currentTarget, image: bubbleImage(mainImageRef.current, images[0]?.url) },
      )
    },
    [variant, qty, product, sku, priceZar, images, add],
  )

  // The selected variant sits on a single ink pill that slides to whichever
  // option is picked, rather than one button going dark as another goes light.
  useLayoutEffect(() => {
    const group = variantGroupRef.current
    if (!group) return
    const measure = () => {
      const btn = group.querySelector<HTMLElement>('[aria-pressed="true"]')
      setVariantPill(btn ? { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight } : null)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(group)
    return () => ro.disconnect()
  }, [variant?.id])

  // Lightbox: the enlarged image grows out of the main image and shrinks back
  // into it on close, so it reads as the same picture brought closer.
  useLayoutEffect(() => {
    if (!lightboxOpen) return
    const frame = lightboxFrameRef.current
    const source = mainImageRef.current?.querySelector('img') ?? mainImageRef.current
    if (!frame || !source || prefersReducedMotion() || typeof frame.animate !== 'function') return
    frame.animate(
      [{ transform: flipFrom(source.getBoundingClientRect(), frame.getBoundingClientRect()) }, { transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    )
    lightboxRef.current?.animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,0.9)' }], {
      duration: 320,
      easing: 'ease-out',
    })
  }, [lightboxOpen])

  const openLightbox = useCallback(() => {
    if (images.length === 0) return
    setLightboxPoster(mainImageRef.current?.querySelector('img')?.currentSrc ?? '')
    setLightboxOpen(true)
  }, [images.length])

  const closeLightbox = useCallback(() => {
    const frame = lightboxFrameRef.current
    const source = mainImageRef.current?.querySelector('img') ?? mainImageRef.current
    if (!frame || !source || prefersReducedMotion() || typeof frame.animate !== 'function') {
      setLightboxOpen(false)
      return
    }
    const shrink = frame.animate(
      [{ transform: 'none' }, { transform: flipFrom(source.getBoundingClientRect(), frame.getBoundingClientRect()) }],
      { duration: 300, easing: 'cubic-bezier(.55, 0, .45, 1)', fill: 'forwards' },
    )
    lightboxRef.current?.animate([{ backgroundColor: 'rgba(0,0,0,0.9)' }, { backgroundColor: 'rgba(0,0,0,0)' }], {
      duration: 300,
      fill: 'forwards',
    })
    shrink.finished.then(() => setLightboxOpen(false), () => setLightboxOpen(false))
  }, [])

  const cartridgeType = cartridgeTypeLabel(product.metadata?.cartridge_type) ?? 'Laser'

  return (
    <>
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .thumb-active { outline: 2px solid var(--ink); outline-offset: 2px; }
        .lightbox-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* Lightbox */}
      {lightboxOpen && images[activeImage] && (
        <div
          ref={lightboxRef}
          className="lightbox-backdrop"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Product image lightbox"
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
            aria-label="Close lightbox"
          >
            ×
          </button>
          {/* The frame starts painted with the main image the browser already
              has, so the zoom never shows an empty box while the larger file loads. */}
          <div
            ref={lightboxFrameRef}
            className="bg-center bg-no-repeat bg-contain"
            style={lightboxPoster ? { backgroundImage: `url("${lightboxPoster}")` } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[activeImage].url}
              alt={product.title}
              width={800}
              height={800}
              className="max-h-[85vh] max-w-[85vw] object-contain"
            />
          </div>
        </div>
      )}

      <PageTransition>
      <div data-page-content className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-32 pb-16">
        {/* Breadcrumb — links back up the hierarchy carry nav-back */}
        <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Link href="/" transitionTypes={NAV_BACK} className="hover:text-[var(--ink)] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/products" transitionTypes={NAV_BACK} className="hover:text-[var(--ink)] transition-colors">
            {typeCategory?.name ?? 'Products'}
          </Link>
          {brandCategory && (
            <>
              <span>/</span>
              <Link
                href={`/products?category=${brandCategory.id}`}
                transitionTypes={NAV_BACK}
                className="hover:text-[var(--ink)] transition-colors"
              >
                {brandCategory.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[var(--ink)] truncate max-w-[180px]">{product.title}</span>
        </nav>

        {/* Main PDP grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* ── Image gallery ── */}
          <div className="flex gap-4">
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                {images.slice(0, 6).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveImage(i)
                      setGallerySwapped(true)
                    }}
                    className={`w-14 h-14 rounded-[8px] bg-[var(--surface)] overflow-hidden border border-[var(--line-3)] ${i === activeImage ? 'thumb-active' : ''}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image
                      src={img.url}
                      alt={`${product.title} view ${i + 1}`}
                      width={56}
                      height={56}
                      className="w-full h-full object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main image — the grid card's image morphs into this one */}
            <div
              ref={mainImageRef}
              className="relative flex-1 bg-[var(--surface)] rounded-[20px] flex items-center justify-center p-8 cursor-zoom-in min-h-[360px] sm:min-h-[440px]"
              onClick={openLightbox}
            >
              <ProductMorph productId={product.id}>
                {images[activeImage] ? (
                  <ProductImage
                    key={activeImage}
                    orbSize={48}
                    src={images[activeImage].url}
                    alt={product.title}
                    width={400}
                    height={400}
                    className={`max-h-[340px] w-auto object-contain ${gallerySwapped ? 'gallery-swap' : ''}`}
                    priority
                  />
                ) : (
                  <div className="w-32 h-48 rounded-[10px] bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.45)] flex flex-col justify-end p-4">
                    <span className="font-display text-white text-sm">TSE</span>
                  </div>
                )}
              </ProductMorph>
            </div>
          </div>

          {/* ── Product info ── */}
          <div className="flex flex-col">
            {/* Generic badge */}
            <div className="inline-flex items-center gap-1.5 self-start mb-4 px-3 py-1 rounded-full bg-[#dfe344]/20 border border-[#dfe344]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dfe344]" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-[var(--ink)]">
                Quality Generic Replacement
              </span>
            </div>

            <h1 className="font-display font-light text-3xl sm:text-4xl tracking-tight leading-tight mb-2">
              {product.title}
            </h1>

            <div className="flex items-center gap-3 mb-4 text-sm text-[var(--muted)]">
              <span>SKU: <span className="font-mono text-[var(--ink)]">{sku}</span></span>
              <span>·</span>
              <span>{cartridgeType}</span>
              {brandCategory && (
                <>
                  <span>·</span>
                  <span>{brandCategory.name}</span>
                </>
              )}
            </div>

            {/* Price */}
            <div className="mb-6">
              {priceZar ? (
                <div className="font-display text-4xl">
                  R<RollingNumber value={priceZar.toLocaleString('en-ZA')} />
                  <span className="text-base text-[var(--muted)] ml-2 font-sans font-normal">incl. VAT</span>
                </div>
              ) : (
                <div className="text-[var(--muted)] text-lg">Price on application</div>
              )}
            </div>

            {/* Short description — legacy Woo descriptions arrive as raw HTML */}
            {product.description && (
              <div className="text-sm text-[var(--ink-3)] leading-relaxed mb-6 max-w-md space-y-3">
                {htmlToParagraphs(product.description).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}

            {/* Variant selector */}
            {hasMultipleVariants && (
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {colourOption?.title ?? 'Variant'}
                  </span>
                  <span className="text-sm text-[var(--ink)] font-medium">{variant?.title ?? ''}</span>
                </div>
                <div ref={variantGroupRef} className="relative flex flex-wrap gap-2">
                  {/* One pill travels to the selection (see useLayoutEffect above). Until
                      it has been measured the selected button paints its own fill. */}
                  {variantPill && (
                    <span
                      aria-hidden
                      className="variant-pill"
                      style={{
                        transform: `translate(${variantPill.x}px, ${variantPill.y}px)`,
                        width: variantPill.w,
                        height: variantPill.h,
                      }}
                    />
                  )}
                  {variants.map((v) => {
                    const label = v.title ?? v.sku ?? ''
                    const isSelected = v.id === variant?.id
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`relative flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-xs transition-colors duration-300 ${
                          isSelected
                            ? `border-[var(--ink)] text-[var(--paper)] ${variantPill ? 'bg-transparent' : 'bg-[var(--ink)]'}`
                            : 'border-[var(--line-4)] text-[var(--ink-2)] hover:border-[var(--line-7)]'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-[var(--line-3)]"
                          style={swatchStyle(label)}
                        />
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Qty + Add to cart */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center border border-[var(--line-4)] rounded-full overflow-hidden">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-[var(--ink)] hover:bg-[var(--hover-1)] transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums"><RollingNumber value={qty} /></span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 flex items-center justify-center text-[var(--ink)] hover:bg-[var(--hover-1)] transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!variant}
                data-status={addStatus}
                className={`atc-wide flex-1 h-10 rounded-full font-medium text-sm transition-colors duration-200 active:scale-[.98] ${
                  addStatus === 'added'
                    ? 'bg-[#dfe344] text-[var(--ink)]'
                    : 'bg-[var(--ink)] text-[var(--paper)] hover:bg-[#41e0f5] hover:text-[var(--on-accent)]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <AddToCartLabel status={addStatus} idle="Add to cart" />
                <AddStatusAnnouncer message={addStatusMessage(addStatus, product.title)} />
              </button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '✓', label: 'Guaranteed to work or your money back' },
                { icon: '🚚', label: 'Nationwide courier — Overnight option to JHB/PTA' },
                { icon: '⚡', label: 'Same-day dispatch on orders before noon' },
                { icon: '🔒', label: 'Secure checkout with PayFast' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-start gap-2 text-xs text-[var(--ink-3)]">
                  <span className="mt-0.5">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display font-light text-2xl sm:text-3xl mb-6">
              More from <span className="font-display-italic">{brandCategory?.name ?? 'this range'}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {related.map((p, i) => {
                const v = p.variants?.[0]
                const relatedSku = v?.sku ?? '—'
                const relatedPrice = v?.calculated_price?.calculated_amount
                  ? Math.round(v.calculated_price.calculated_amount)
                  : null
                const relatedImage = p.images?.[0]?.url

                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.handle}`}
                    transitionTypes={NAV_FORWARD}
                    className="group relative bg-[var(--surface)] rounded-[16px] p-4 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
                  >
                    <div className="relative h-28 flex items-end justify-center mb-3">
                      <ProductMorph productId={p.id}>
                      {relatedImage ? (
                        <ProductImage
                          src={relatedImage}
                          alt={p.title}
                          width={160}
                          height={200}
                          sizes="160px"
                          className="h-28 w-auto object-contain"
                        />
                      ) : (
                        <div
                          className={`w-16 h-24 rounded-[6px] shadow-[0_12px_24px_-12px_rgba(10,10,10,0.35)] relative overflow-hidden ${
                            i % 4 === 0 ? 'bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A]' :
                            i % 4 === 1 ? 'bg-gradient-to-br from-[#41e0f5] to-[#0fb8d4]' :
                            i % 4 === 2 ? 'bg-gradient-to-br from-[#1a1a2e] to-[#3a3a5c]' :
                            'bg-gradient-to-br from-[#2d1a0e] to-[#5a3520]'
                          }`}
                        >
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/25" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                            <span className="font-display text-white text-[9px] leading-none">TSE</span>
                          </div>
                        </div>
                      )}
                      </ProductMorph>
                    </div>

                    <h3 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{p.title}</h3>
                    <div className="text-[10px] text-[var(--muted-2)] mb-3">SKU {relatedSku}</div>
                    <div className="font-display text-base">
                      {relatedPrice ? `R${relatedPrice}` : <span className="text-[var(--muted-2)] text-sm">POA</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
      </PageTransition>
    </>
  )
}
