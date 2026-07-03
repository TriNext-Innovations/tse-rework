'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/contexts/CartContext'

export default function CartPageClient() {
  const { items, count, updateQty, removeItem } = useCart()

  const subtotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.qty, 0)
  const vatContent = Math.round(subtotal * 15 / 115)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-28 pb-16">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>

      <div className="mb-8 flex items-center gap-2 text-xs text-[#6B6B66]">
        <Link href="/" className="hover:text-[#111827] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#111827]">Cart</span>
      </div>

      <h1 className="font-display font-light text-4xl sm:text-5xl mb-10">
        Your Cart
        {count > 0 && <span className="text-2xl text-[#6B6B66] ml-3">({count} {count === 1 ? 'item' : 'items'})</span>}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-24 max-w-md mx-auto">
          <div className="font-display text-6xl mb-4 opacity-15">∅</div>
          <h2 className="font-display font-light text-2xl mb-2">Your cart is empty</h2>
          <p className="text-sm text-[#6B6B66] mb-8">
            Find compatible cartridges for your printer and add them here.
          </p>
          <Link
            href="/compatibility"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#111827] text-white text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors"
          >
            Find cartridges for my printer
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Line items */}
          <div className="lg:col-span-2">
            <ul className="divide-y divide-black/8">
              {items.map((item) => {
                const lineTotal = (item.price ?? 0) * item.qty
                return (
                  <li key={item.id} className="flex items-start gap-5 py-6 first:pt-0">
                    <div className="w-16 h-20 rounded-[10px] bg-gradient-to-br from-[#0A0A0A] to-[#2A2A2A] flex-shrink-0 relative overflow-hidden">
                      {item.thumbnail ? (
                        <Image src={item.thumbnail} alt={item.title} width={64} height={80} className="w-full h-full object-contain p-1.5" />
                      ) : (
                        <>
                          <div className="absolute top-0 left-0 right-0 h-2 bg-white/20" />
                          <span className="absolute bottom-2 left-2 font-display text-white text-[9px]">TSE</span>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-base leading-tight">{item.title}</h3>
                      <p className="text-xs text-[#6B6B66] mt-1">SKU {item.sku}</p>
                      <p className="text-xs text-[#6B6B66]">
                        {item.price ? `R${item.price} each` : 'Price on application'}
                      </p>

                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-black/15 rounded-full overflow-hidden">
                          <button
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            className="w-8 h-8 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors"
                            aria-label="Decrease quantity"
                          >−</button>
                          <span className="w-8 text-center text-sm font-medium tabular-nums">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="w-8 h-8 flex items-center justify-center text-[#111827] hover:bg-black/5 transition-colors"
                            aria-label="Increase quantity"
                          >+</button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-[#9ca3af] hover:text-[#ef4444] transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="font-display text-xl text-right flex-shrink-0">
                      {item.price ? `R${lineTotal.toFixed(0)}` : '—'}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-6 pt-6 border-t border-black/8">
              <Link href="/products" className="text-sm text-[#6B6B66] hover:text-[#111827] transition-colors">
                ← Continue shopping
              </Link>
            </div>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[20px] p-6 sticky top-24">
              <h2 className="font-display font-light text-xl mb-6">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6B6B66]">Subtotal ({count} {count === 1 ? 'item' : 'items'})</span>
                  <span>R{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-[#6B6B66]">
                  <span>VAT (incl.)</span>
                  <span>R{vatContent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B66]">Delivery</span>
                  <span>Calculated at checkout</span>
                </div>
                <p className="text-[10px] text-[#9ca3af]">Collection from our Kya Sands warehouse is free</p>
              </div>

              <div className="border-t border-black/8 mt-4 pt-4 flex justify-between items-baseline">
                <span className="font-medium">Total</span>
                <span className="font-display text-2xl">R{subtotal.toFixed(0)}</span>
              </div>

              <Link
                href="/checkout"
                className="mt-6 w-full block text-center bg-[#111827] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#41e0f5] hover:text-[#111827] transition-colors duration-300"
              >
                Proceed to Checkout
              </Link>

              <div className="mt-4 space-y-2">
                {[
                  '✓ Guaranteed to work or money back',
                  '🚚 Next-day delivery JHB & PTA',
                  '🔒 Secure checkout',
                ].map((t) => (
                  <p key={t} className="text-[11px] text-[#6B6B66] flex items-center gap-1.5">{t}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
