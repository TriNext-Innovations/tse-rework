import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useState } from 'react'

// Pinned how-to for the client's product data entry. Collapsed state persists
// per browser so it stays out of the way once the flow is familiar.
const STORAGE_KEY = 'tse-product-guide-collapsed'

const steps: Array<{ title: string; detail: string }> = [
  {
    title: 'Create the product',
    detail: 'Products → Create. Title = cartridge family, e.g. “HP 123 Ink Cartridge”.',
  },
  {
    title: 'Turn on variants',
    detail: 'Toggle “Yes, this is a product with variants”.',
  },
  {
    title: 'Add options by typing',
    detail:
      'In Product options, type the option name (e.g. Colour or Yield) and click the Create “…” entry that appears — the dropdown only lists names already used in the store.',
  },
  {
    title: 'Add the values',
    detail: 'In Values, type each value (Black, XL, …) and press Enter after each one.',
  },
  {
    title: 'Tick only real combinations',
    detail:
      'The variant grid shows every combination — only tick the ones that actually exist (e.g. skip Tri-colour/XL if there is no such cartridge).',
  },
  {
    title: 'SKU = the real cartridge code',
    detail:
      'Fill the SKU per variant with the manufacturer code, e.g. HP123-BK, HP123XL-BK. SKUs are not generated automatically, and search uses them.',
  },
  {
    title: 'Set prices and stock, then Publish',
    detail: 'Each variant has its own price and inventory. The storefront picks everything up automatically.',
  },
]

const ProductQuickGuideWidget = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? '0' : '1')
      } catch {
        // localStorage unavailable — collapse state just won't persist
      }
      return !c
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-gray-900">
          Adding a cartridge with variants — quick guide
        </span>
        <span className="text-xs text-gray-400">{collapsed ? 'Show' : 'Hide'}</span>
      </button>

      {!collapsed && (
        <ol className="px-4 pb-4 space-y-2">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <div className="text-xs font-medium text-gray-800">{step.title}</div>
                <div className="text-xs text-gray-500">{step.detail}</div>
              </div>
            </li>
          ))}
          <li className="flex gap-2 pt-1 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              Existing product? Open it and add the option in its Options section — current
              variants stay and get the new option&apos;s default value. Only add Yield to
              cartridges that come in more than one capacity.
            </span>
          </li>
        </ol>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.list.before',
})

export default ProductQuickGuideWidget
