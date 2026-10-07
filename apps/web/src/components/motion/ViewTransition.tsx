import * as React from 'react'

// React's <ViewTransition>. The App Router runs on React canary, which ships it
// (Next 16 needs no config). The stable `react` package that Vitest resolves
// does not, so there it falls back to rendering the children unchanged.
//
// Class names passed to enter/exit/share/update are the ones styled in
// app/motion.css (::view-transition-*(.<class>)).

type TransitionClass = string | { [transitionType: string]: string; default: string }

export type ViewTransitionProps = {
  children: React.ReactNode
  name?: string
  enter?: TransitionClass
  exit?: TransitionClass
  update?: TransitionClass
  share?: TransitionClass
  default?: TransitionClass
}

function Passthrough({ children }: ViewTransitionProps) {
  return <>{children}</>
}

export const ViewTransition: React.ComponentType<ViewTransitionProps> =
  (React as unknown as { ViewTransition?: React.ComponentType<ViewTransitionProps> }).ViewTransition ?? Passthrough

/** The view-transition name that pairs a product's grid image with its product-page image. */
export function productImageName(productId: string): string {
  return `product-image-${productId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/**
 * A product image that morphs between the grid and the product page. Wrap the
 * <Image> (or its fallback) on both sides with the same product id.
 */
export function ProductMorph({ productId, children }: { productId: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={productImageName(productId)} share="product-morph" default="none">
      {children}
    </ViewTransition>
  )
}

const PAGE_TYPES = { 'nav-forward': 'page-forward', 'nav-back': 'page-back', default: 'none' }

/**
 * Page content that rises in when the shopper goes deeper (a product) and
 * settles back when they return. Navigations carry the type through
 * <Link transitionTypes> / router.push(…, { transitionTypes }); anything
 * untyped (browser back, refreshes) swaps without a slide.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={PAGE_TYPES} exit={PAGE_TYPES} default="none">
      {children}
    </ViewTransition>
  )
}

/** Transition types for links into a product page, and for links back out of one. */
export const NAV_FORWARD = ['nav-forward']
export const NAV_BACK = ['nav-back']
