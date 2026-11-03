'use client'

import { useAddToCart, addStatusMessage } from '@/lib/add-to-cart'
import { bubbleImage } from '@/lib/motion'
import { AddToCartIcon, AddStatusAnnouncer } from '@/components/motion'

type Props = {
  id: string
  title: string
  sku: string
  price: number | null
  variantId?: string
  thumbnail?: string
}

export function AddToCartButton({ id, title, sku, price, variantId, thumbnail }: Props) {
  const { status, add } = useAddToCart()

  return (
    <button
      aria-label={`Add ${title} to cart`}
      data-status={status}
      onClick={(e) => {
        // The button sits inside the card's link: stop the click reaching Link's
        // handler AND the browser's own link-following, or adding would also
        // leave the listing (#498).
        e.stopPropagation()
        e.preventDefault()
        // Once the add succeeds a bubble with the card's picture rises from this
        // button to the cart in the navbar.
        const card = e.currentTarget.closest('[data-product-card]')
        // Mirror the PDP: encode the variant in the cart id so the checkout can
        // reconstruct a Medusa line item. Falls back to product id for search
        // results that carry no variant (resolved by SKU at checkout).
        void add(
          {
            id: variantId ? `${id}-${variantId}` : id,
            title,
            sku,
            price,
            variantId,
            thumbnail,
          },
          { from: e.currentTarget, image: bubbleImage(card, thumbnail) },
        )
      }}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--paper)] group-hover:bg-[#41e0f5] group-hover:text-[var(--on-accent)] data-[status=added]:bg-[#dfe344] data-[status=added]:text-[var(--ink)] active:scale-90 transition-[background-color,color,transform] duration-200 cursor-pointer"
    >
      <AddToCartIcon />
      <AddStatusAnnouncer message={addStatusMessage(status, title)} />
    </button>
  )
}
