'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CartLottie } from '@/components/CartLottie'

export type CartItem = {
  id: string
  title: string
  sku: string
  price: number | null
  qty: number
}

type CartContextType = {
  items: CartItem[]
  count: number
  addItem: (item: Omit<CartItem, 'qty'>) => void
  removeItem: (id: string) => void
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const total = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...item, qty: 1 }]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return (
    <CartContext.Provider
      value={{ items, count, addItem, removeItem, isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false) }}
    >
      {children}

      {/* Cart Drawer */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isOpen}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
        <div
          className={`absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#F5F4F0] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
            <div>
              <h2 className="font-light text-2xl tracking-tight" style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}>
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
                  <p className="text-lg font-light" style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}>
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
                  <li key={item.id} className="flex items-center gap-4 py-4 border-b border-black/8 last:border-0">
                    <div className="w-12 h-16 rounded-[6px] bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] flex-shrink-0 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/20" />
                      <div
                        className="absolute bottom-2 left-2 text-white text-[8px] font-light"
                        style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
                      >
                        TSE
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{item.title}</p>
                      <p className="text-[10px] text-[#6B6B66] mt-0.5">
                        SKU {item.sku} · Qty {item.qty}
                      </p>
                      <p className="text-base mt-1" style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}>
                        {item.price ? `R${(item.price * item.qty).toFixed(0)}` : 'POA'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors flex-shrink-0 text-[#6B6B66] cursor-pointer"
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
                <span className="text-xl font-light" style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}>
                  R{total.toFixed(0)}
                </span>
              </div>
              <button className="w-full bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors duration-300 cursor-pointer">
                Checkout — R{total.toFixed(0)}
              </button>
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
