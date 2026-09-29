// Single source of truth for the cartridge type taxonomy on the storefront.
//
// Medusa models products under a Type → Brand category tree, e.g.
// "Laser Cartridges" → "HP". The top-level *type* categories below are the
// only hardcoded link between the UI and that tree; brands are always read from
// /store/product-categories at runtime. Products also carry a
// `metadata.cartridge_type` of 'inkjet' | 'laser' | 'ink'.
//
// "Ink" is refill ink in bottles for tank printers (EcoTank, MegaTank and the
// like). Its products may sit directly in the "Ink" category rather than under
// a brand, so the listing includes the type category itself (products/page).
//
// TODO(claus): derive TYPE_CATEGORY_NAMES from a marker on the Medusa category
// (e.g. metadata.is_type === true) so admins can rename/add type categories
// without a frontend deploy. Until then this module keeps the mapping in ONE
// place instead of re-encoded across products/page, Navbar, FilterPanel, etc.

export type CartridgeType = 'inkjet' | 'laser' | 'ink'

export const TYPE_CATEGORIES: ReadonlyArray<{
  key: CartridgeType
  label: string
  parent: string
}> = [
  { key: 'inkjet', label: 'Inkjet', parent: 'Inkjet Cartridges' },
  { key: 'laser', label: 'Laser', parent: 'Laser Cartridges' },
  { key: 'ink', label: 'Ink', parent: 'Ink' },
]

// Parent category names that represent the "type" level (not a brand). Used to
// skip type categories when listing brands.
export const TYPE_CATEGORY_NAMES = new Set<string>(TYPE_CATEGORIES.map((t) => t.parent))

// Filter key → parent category name, e.g. 'laser' → 'Laser Cartridges'.
export const TYPE_PARENT: Record<string, string> = Object.fromEntries(
  TYPE_CATEGORIES.map((t) => [t.key, t.parent]),
)

// Human label for a product's `metadata.cartridge_type` (or a filter key).
// Accepts `unknown` because product metadata is loosely typed. Returns null
// when the value isn't a known type.
export function cartridgeTypeLabel(value: unknown): string | null {
  return TYPE_CATEGORIES.find((t) => t.key === value)?.label ?? null
}

/**
 * Is this category a brand (as opposed to a type category, or a stray)?
 *
 * A brand always sits *under* a type category. Name-matching alone is not
 * enough: before "Ink" was a type, the live catalogue's top-level "Ink"
 * category (which has no brand children) was being listed as a brand in the
 * nav and the filter panel.
 *
 * `parent_category` is only consulted when it was actually requested. Some
 * callers fetch the tree with `include_descendants_tree` and no parent fields,
 * where the key is absent; there we fall back to the name check rather than
 * silently classifying every brand as a stray.
 */
export function isBrandCategory(c: {
  name: string
  parent_category?: { name?: string } | null
}): boolean {
  if (TYPE_CATEGORY_NAMES.has(c.name)) return false
  if (c.parent_category !== undefined) return Boolean(c.parent_category?.name)
  return true
}
