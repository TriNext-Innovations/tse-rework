'use client'

import { useCart } from '@/contexts/CartContext'

type Props = {
  id: string
  title: string
  sku: string
  price: number | null
  variantId?: string
  thumbnail?: string
}

export function AddToCartButton({ id, title, sku, price, variantId, thumbnail }: Props) {
  const { addItem } = useCart()

  return (
    <button
      aria-label={`Add ${title} to cart`}
      onClick={(e) => {
        e.stopPropagation()
        // Mirror the PDP: encode the variant in the cart id so the checkout can
        // reconstruct a Medusa line item. Falls back to product id for search
        // results that carry no variant (resolved by SKU at checkout).
        addItem({
          id: variantId ? `${id}-${variantId}` : id,
          title,
          sku,
          price,
          variantId,
          thumbnail,
        })
      }}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111827] text-white group-hover:bg-[#41e0f5] group-hover:text-[#111827] transition-colors duration-200 cursor-pointer"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
