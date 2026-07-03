'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/contexts/CartContext'
import { cartridgeTypeLabel } from '@/lib/taxonomy'
import { htmlToParagraphs } from '@/lib/html-text'

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
  if (!v) return { background: '#9ca3af' }
  return v.startsWith('linear') ? { background: v } : { background: v }
}

type Props = {
  product: Product
  related: Product[]
  brandCategory: Category | null
  typeCategory: Category | null
}

export default function ProductDetail({ product, related, brandCategory, typeCategory }: Props) {
  const { addItem } = useCart()

  const images = product.images ?? []
  const variants = product.variants ?? []

  const [activeImage, setActiveImage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '')

  const variant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]
  const sku = variant?.sku ?? '—'
  const priceZar = variant?.calculated_price?.calculated_amount
    ? Math.round(variant.calculated_price.calculated_amount)
    : null

  // Single colour-like option (Black/Cyan/Magenta/Yellow) — render as swatches
  const colourOption = product.options?.find((o) => /colou?r/i.test(o.title))
  const hasMultipleVariants = variants.length > 1

  const handleAddToCart = useCallback(() => {
    if (!variant) return
    addItem(
      {
        id: `${product.id}-${variant.id}`,
        title: product.title,
        sku,
        price: priceZar,
        thumbnail: images[0]?.url,
        variantId: variant.id,
      },
      qty,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }, [variant, qty, product, sku, priceZar, images, addItem])

  const cartridgeType = cartridgeTypeLabel(product.metadata?.cartridge_type) ?? 'Laser'

  return (
    <>
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
        .thumb-active { outline: 2px solid #111827; outline-offset: 2px; }
        .lightbox-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* Lightbox */}
      {lightboxOpen && images[activeImage] && (
        <div
          className="lightbox-backdrop"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image lightbox"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
            aria-label="Close lightbox"
          >
            ×
          </button>
          <Image
            src={images[activeImage].url}
            alt={product.title}
            width={800}
            height={800}
            className="max-h-[85vh] max-w-[85vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-28 pb-16">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-[#6B6B66]">
          <Link href="/" className="hover:text-[#111827] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#111827] transition-colors">
            {typeCategory?.name ?? 'Products'}
          </Link>
          {brandCategory && (
            <>
              <span>/</span>
              <Link
                href={`/products?category=${brandCategory.id}`}
                className="hover:text-[#111827] transition-colors"
              >
                {brandCategory.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-[#111827] truncate max-w-[180px]">{product.title}</span>
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
                    onClick={() => setActiveImage(i)}
                    className={`w-14 h-14 rounded-[8px] bg-white overflow-hidden border border-black/10 ${i === activeImage ? 'thumb-active' : ''}`}
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

            {/* Main image */}
            <div
              className="flex-1 bg-white rounded-[20px] flex items-center justify-center p-8 cursor-zoom-in min-h-[360px] sm:min-h-[440px]"
              onClick={() => images.length > 0 && setLightboxOpen(true)}
            >
              {images[activeImage] ? (
                <Image
                  src={images[activeImage].url}
                  alt={product.title}
                  width={400}
                  height={400}
                  className="max-h-[340px] w-auto object-contain"
                  priority
                />
              ) : (
                <div className="w-32 h-48 rounded-[10px] bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.45)] flex flex-col justify-end p-4">
                  <span className="font-display text-white text-sm">TSE</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Product info ── */}
          <div className="flex flex-col">
            {/* Generic badge */}
            <div className="inline-flex items-center gap-1.5 self-start mb-4 px-3 py-1 rounded-full bg-[#dfe344]/20 border border-[#dfe344]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dfe344]" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#111827]">
                Quality Generic Replacement
              </span>
            </div>

            <h1 className="font-display font-light text-3xl sm:text-4xl tracking-tight leading-tight mb-2">
              {product.title}
            </h1>

            <div className="flex items-center gap-3 mb-4 text-sm text-[#6B6B66]">
              <span>SKU: <span className="font-mono text-[#111827]">{sku}</span></span>
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
                  R{priceZar.toLocaleString('en-ZA')}
                  <span className="text-base text-[#6B6B66] ml-2 font-sans font-normal">incl. VAT</span>
                </div>
              ) : (
                <div className="text-[#6B6B66] text-lg">Price on application</div>
              )}
            </div>

            {/* Short description — legacy Woo descriptions arrive as raw HTML */}
            {product.description && (
              <div className="text-sm text-[#4B4B46] leading-relaxed mb-6 max-w-md space-y-3">
                {htmlToParagraphs(product.description).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}

            {/* Variant selector */}
            {hasMultipleVariants && (
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-[#6B6B66]">
                    {colourOption?.title ?? 'Variant'}
                  </span>
                  <span className="text-sm text-[#111827] font-medium">{variant?.title ?? ''}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const label = v.title ?? v.sku ?? ''
                    const isSelected = v.id === variant?.id
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-xs transition-colors ${
                          isSelected
                            ? 'border-[#111827] bg-[#111827] text-white'
                            : 'border-black/15 text-[#374151] hover:border-black/40'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
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
              <div className="flex items-center border border-black/15 rounded-full overflow-hidden">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!variant}
                className={`flex-1 h-10 rounded-full font-medium text-sm transition-all duration-200 ${
                  added
                    ? 'bg-[#dfe344] text-[#111827]'
                    : 'bg-[#111827] text-white hover:bg-[#41e0f5] hover:text-[#111827]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {added ? '✓ Added to cart' : 'Add to cart'}
              </button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '✓', label: 'Guaranteed to work or your money back' },
                { icon: '🚚', label: 'Nationwide courier — next-day JHB/PTA' },
                { icon: '⚡', label: 'Same-day dispatch on orders before noon' },
                { icon: '🔒', label: 'Secure checkout with PayFast' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-start gap-2 text-xs text-[#4B4B46]">
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
                    className="group relative bg-white rounded-[16px] p-4 overflow-hidden hover:-translate-y-1 transition-transform duration-300"
                  >
                    <div className="relative h-28 flex items-end justify-center mb-3">
                      {relatedImage ? (
                        <Image
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
                    </div>

                    <h3 className="font-display text-sm leading-tight tracking-tight line-clamp-2 mb-1">{p.title}</h3>
                    <div className="text-[10px] text-[#9ca3af] mb-3">SKU {relatedSku}</div>
                    <div className="font-display text-base">
                      {relatedPrice ? `R${relatedPrice}` : <span className="text-[#9ca3af] text-sm">POA</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
