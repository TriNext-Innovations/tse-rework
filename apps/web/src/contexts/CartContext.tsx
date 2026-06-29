'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CartLottie } from '@/components/CartLottie'
import {
  type MedusaCart,
  createEmptyCart,
  getCart,
  addLineItem,
  updateLineItem,
  removeLineItem,
} from '@/lib/checkout-cart'

// A line of the cart as the UI consumes it. `id` is the Medusa LINE-ITEM id
// (used to update/remove), and `price` is in rand (Medusa stores cents). Derived
// from the Medusa cart — never persisted; only the cart_id lives in the browser.
export type CartItem = {
  id: string
  title: string
  sku: string
  price: number | null
  qty: number
  thumbnail?: string
  variantId?: string
}

// What callers pass to addItem. PDP/listing adds carry the variant; search adds
// carry the product id + SKU (the cart client resolves the variant).
export type AddToCartInput = {
  id: string
  title: string
  sku: string
  price: number | null
  thumbnail?: string
  variantId?: string
}

type CartContextType = {
  items: CartItem[]
  count: number
  cartId: string | null
  pending: boolean
  addItem: (item: AddToCartInput, quantity?: number) => void
  removeItem: (lineId: string) => void
  updateQty: (lineId: string, qty: number) => void
  clearCart: () => void
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

const CART_ID_KEY = 'tse_cart_id'

function toItems(cart: MedusaCart | null): CartItem[] {
  return (cart?.items ?? []).map((l) => ({
    id: l.id,
    title: l.product_title ?? l.title ?? '',
    sku: l.variant_sku ?? '',
    price: typeof l.unit_price === 'number' ? l.unit_price / 100 : null,
    qty: l.quantity,
    thumbnail: l.thumbnail ?? undefined,
    variantId: l.variant_id,
  }))
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<MedusaCart | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [pending, setPending] = useState(false)
  // cartId lives in a ref too so concurrent adds don't each create a new cart.
  const cartIdRef = useRef<string | null>(null)
  // In-flight cart creation, shared by concurrent first-adds so they don't each
  // POST a new cart.
  const creatingRef = useRef<Promise<MedusaCart> | null>(null)

  const setCartId = useCallback((id: string | null) => {
    cartIdRef.current = id
    try {
      if (id) localStorage.setItem(CART_ID_KEY, id)
      else localStorage.removeItem(CART_ID_KEY)
    } catch {}
  }, [])

  const ensureCartId = useCallback(async (): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current
    if (!creatingRef.current) creatingRef.current = createEmptyCart()
    const created = await creatingRef.current
    setCartId(created.id)
    setCart((prev) => prev ?? created)
    return created.id
  }, [setCartId])

  // Hydrate the cart from the persisted cart_id. If it's gone or completed,
  // getCart returns null and we drop the stale id so the next add recreates one.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(CART_ID_KEY)
    } catch {}
    if (!saved) return
    cartIdRef.current = saved
    getCart(saved).then((c) => {
      if (c) setCart(c)
      else setCartId(null)
    })
  }, [setCartId])

  const items = useMemo(() => toItems(cart), [cart])
  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const total = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)

  // Lazily create the Medusa cart, add the variant, and open the drawer. The
  // returned cart (server-computed prices/totals) becomes the new state.
  const addItem = useCallback(
    async (item: AddToCartInput, quantity = 1) => {
      setPending(true)
      try {
        const id = await ensureCartId()
        const updated = await addLineItem(
          id,
          { id: item.id, title: item.title, sku: item.sku, variantId: item.variantId },
          quantity,
        )
        setCart(updated)
        setIsOpen(true)
      } catch (err) {
        console.error('[cart] add failed:', err)
      } finally {
        setPending(false)
      }
    },
    [ensureCartId],
  )

  const removeItem = useCallback(async (lineId: string) => {
    const id = cartIdRef.current
    if (!id) return
    try {
      setCart(await removeLineItem(id, lineId))
    } catch (err) {
      console.error('[cart] remove failed:', err)
    }
  }, [])

  const updateQty = useCallback(async (lineId: string, qty: number) => {
    const id = cartIdRef.current
    if (!id) return
    try {
      setCart(qty <= 0 ? await removeLineItem(id, lineId) : await updateLineItem(id, lineId, qty))
    } catch (err) {
      console.error('[cart] update failed:', err)
    }
  }, [])

  // Drop the local cart reference (e.g. after redirecting to PayFast). The
  // Medusa cart itself is completed server-side on payment, not deleted here.
  const clearCart = useCallback(() => {
    setCart(null)
    setCartId(null)
  }, [setCartId])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        cartId: cart?.id ?? null,
        pending,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}

      {/* Cart Drawer */}
      <div
        className={`fixed inset-0 z-[60] overflow-hidden transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isOpen}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
        <div
          className={`absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#F5F4F0] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
            <div>
              <h2 className="font-light text-2xl tracking-tight" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
                Cart
              </h2>
              <p className="text-xs text-[#6B6B66] mt-0.5">
                {count} {count === 1 ? 'item' : 'items'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
                <CartLottie />
                <div>
                  <p className="text-lg font-light" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
                    Your cart is empty
                  </p>
                  <p className="text-sm text-[#6B6B66] mt-1">Add some cartridges to get started</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium underline underline-offset-4 cursor-pointer"
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-4 py-4 border-b border-black/8 last:border-0">
                    <div className="w-12 h-16 rounded-[6px] bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] flex-shrink-0 relative overflow-hidden">
                      {item.thumbnail ? (
                        <Image src={item.thumbnail} alt={item.title} width={48} height={64} className="w-full h-full object-contain p-1" />
                      ) : (
                        <>
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/20" />
                          <div className="absolute bottom-2 left-2 text-white text-[8px] font-light" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>TSE</div>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{item.title}</p>
                      <p className="text-[10px] text-[#6B6B66] mt-0.5">SKU {item.sku}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-black/15 rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors text-sm"
                            aria-label="Decrease quantity"
                          >−</button>
                          <span className="w-6 text-center text-xs font-medium tabular-nums">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors text-sm"
                            aria-label="Increase quantity"
                          >+</button>
                        </div>
                        <p className="text-base font-light" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
                          {item.price ? `R${(item.price * item.qty).toFixed(0)}` : 'POA'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors flex-shrink-0 text-[#6B6B66] cursor-pointer mt-0.5"
                      aria-label="Remove item"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-6 py-5 border-t border-black/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B6B66]">Subtotal</span>
                <span className="text-xl font-light" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
                  R{total.toFixed(0)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="w-full block text-center bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors duration-300 cursor-pointer"
              >
                Checkout — R{total.toFixed(0)}
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="w-full block text-center text-sm text-[#6B6B66] hover:text-[#111827] transition-colors"
              >
                View Cart
              </Link>
              <p className="text-[10px] text-center text-[#6B6B66]">COD available · JHB &amp; PTA next day</p>
            </div>
          )}
        </div>
      </div>
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
