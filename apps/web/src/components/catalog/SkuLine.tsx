import { coloursOfVariants, type VariantRef } from '@/lib/cartridge-colours'

/**
 * The line under a cartridge card's title. One SKU shows the SKU. A card that
 * collapses several colour variants shows their swatches instead of one
 * variant's SKU, which read as if that colour were the only one (#451).
 *
 * `variants` (with titles, from the compatibility endpoint) wins over `skus`;
 * `skus` alone still works by reading the colour off the SKU suffix.
 */
export function SkuLine({
  sku,
  skus,
  variants,
  className = '',
}: {
  sku: string
  skus?: string[]
  variants?: VariantRef[]
  className?: string
}) {
  const all: VariantRef[] =
    variants && variants.length > 0
      ? variants
      : (skus && skus.length > 0 ? skus : [sku]).map((s) => ({ sku: s }))
  if (all.length === 1) return <div className={className}>SKU {all[0]!.sku}</div>

  const colours = coloursOfVariants(all)
  if (!colours || colours.length < 2) return <div className={className}>{all.length} options</div>

  const names = colours.map((c) => c.name).join(', ')
  // "2 colours" for Black + Tri-colour would undercount the inks; count the
  // cartridges instead whenever one of them holds several colours.
  const noun = colours.some((c) => c.multi) ? 'cartridges' : 'colours'
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="flex -space-x-0.5" aria-hidden="true">
        {colours.map((c) => (
          <span
            key={c.name}
            data-swatch={c.name}
            className="w-2.5 h-2.5 rounded-full ring-1 ring-[var(--surface)]"
            style={{ background: c.background ?? c.hex }}
          />
        ))}
      </span>
      <span title={names}>
        {colours.length} {noun}<span className="sr-only">: {names}</span>
      </span>
    </div>
  )
}
