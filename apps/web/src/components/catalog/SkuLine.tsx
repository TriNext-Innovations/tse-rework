import { coloursOfSkus } from '@/lib/cartridge-colours'

/**
 * The line under a cartridge card's title. One SKU shows the SKU. A card that
 * collapses several colour variants shows their swatches instead of one
 * variant's SKU, which read as if that colour were the only one (#451).
 */
export function SkuLine({ sku, skus, className = '' }: { sku: string; skus?: string[]; className?: string }) {
  const all = skus && skus.length > 0 ? skus : [sku]
  if (all.length === 1) return <div className={className}>SKU {all[0]}</div>

  const colours = coloursOfSkus(all)
  if (!colours || colours.length < 2) return <div className={className}>{all.length} options</div>

  const names = colours.map((c) => c.name).join(', ')
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="flex -space-x-0.5" aria-hidden="true">
        {colours.map((c) => (
          <span
            key={c.name}
            className="w-2.5 h-2.5 rounded-full ring-1 ring-[var(--surface)]"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </span>
      <span title={names}>
        {colours.length} colours<span className="sr-only">: {names}</span>
      </span>
    </div>
  )
}
