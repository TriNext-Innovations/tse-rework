import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'

type CompatModel = { brand: string; model: string }

// Medusa v2 detail widgets receive the entity directly as `data`
// (DetailWidgetProps<AdminProduct> = { data: AdminProduct }), so the SKU is on
// data.variants — NOT data.product.variants.
type ProductData = {
  id: string
  title: string
  variants?: Array<{ sku?: string | null }>
}

const ProductCompatibilityWidget = ({ data }: { data: ProductData }) => {
  const initialSku = data?.variants?.[0]?.sku ?? null
  const [sku, setSku] = useState<string | null>(initialSku)
  // Whether we've determined the SKU (from the payload or a fallback fetch).
  const [skuResolved, setSkuResolved] = useState<boolean>(initialSku != null)
  const [models, setModels] = useState<CompatModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fallback: if variants weren't included in the injected payload, fetch the
  // product's first-variant SKU directly.
  useEffect(() => {
    if (skuResolved || !data?.id) return
    fetch(`/admin/products/${data.id}?fields=id,variants.sku`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const resolved = (d as { product?: { variants?: Array<{ sku?: string | null }> } })
          ?.product?.variants?.[0]?.sku
        setSku(resolved ?? null)
      })
      .catch(() => {})
      .finally(() => setSkuResolved(true))
  }, [data?.id, skuResolved])

  useEffect(() => {
    if (!sku) return
    setLoading(true)
    setError('')
    fetch(`/admin/compatibility?sku=${encodeURIComponent(sku)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => setModels((d as { models?: CompatModel[] }).models ?? []))
      .catch(() => setError('Failed to load compatibility data'))
      .finally(() => setLoading(false))
  }, [sku])

  const grouped = models.reduce<Record<string, string[]>>((acc, m) => {
    const list = acc[m.brand] ?? (acc[m.brand] = [])
    list.push(m.model)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Compatible printers</h3>
        {sku && (
          <span className="text-xs text-gray-400 font-mono">SKU: {sku}</span>
        )}
      </div>

      {!skuResolved && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {skuResolved && !sku && (
        <p className="text-xs text-gray-400">No SKU on the first variant — add a SKU to see compatibility data.</p>
      )}

      {sku && loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {sku && error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {sku && !loading && !error && models.length === 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">No compatibility data for this SKU.</p>
          <p className="text-xs text-gray-300">
            Add entries via the compatibility CSV import script:<br />
            <code className="text-gray-400">pnpm --filter @tse/backend seed:compat</code>
          </p>
        </div>
      )}

      {models.length > 0 && (
        <div className="space-y-3">
          {Object.entries(grouped).map(([brand, modelList]) => (
            <div key={brand}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{brand}</div>
              <div className="flex flex-wrap gap-1">
                {modelList.map((m) => (
                  <span
                    key={m}
                    className="inline-block text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-300 pt-1 border-t border-gray-100">
            {models.length} compatible model{models.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.side.before',
})

export default ProductCompatibilityWidget
