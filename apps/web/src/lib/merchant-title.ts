// Google Shopping title and product_type construction for the Merchant feed.
//
// Why this exists: the catalogue's own product titles are model numbers
// ("Brother TN 277"), which is how the trade refers to them but not how
// shoppers search. Audited 2026-08-19 against production: 523 items, average
// title length 18.5 of the ~70 characters Google renders, and **0 of 523**
// contained "toner", "ink" or "cartridge". Someone searching "brother tn277
// toner" saw a title without the word "toner" in it.
//
// Kept apart from the feed route so the rules are unit-testable without
// standing up a Medusa fetch.

export type CartridgeTypeMeta = 'inkjet' | 'laser' | null

// Google renders roughly 70 characters before truncating. Everything below is
// ordered most-searched-first so a clamp drops the least valuable part.
const MAX_TITLE_LENGTH = 70

const COMPATIBLE_SUFFIX = ' — Compatible'

// Products whose own title already names the part. Drum units are laser
// consumables but are NOT toner cartridges, and asserting otherwise is exactly
// the kind of title/product mismatch Google penalises. Five such products in
// the catalogue as of 2026-08-19.
const SELF_DESCRIBING = /\b(drum|imaging unit|maintenance kit|fuser|waste)\b/i

// The two products carrying no `metadata.cartridge_type` (Samsung SCX4521UNI,
// Canon T13) still get the single most valuable search word. "Cartridge" is
// true of the entire catalogue — the feed already declares one Google category
// for all of it — where "Toner" or "Ink" would be a guess.
const TYPE_NOUN: Record<'inkjet' | 'laser', string> = {
  laser: 'Toner Cartridge',
  inkjet: 'Ink Cartridge',
}
const FALLBACK_NOUN = 'Cartridge'

const PRODUCT_TYPE_LEAF: Record<'inkjet' | 'laser', string> = {
  laser: 'Laser Toner',
  inkjet: 'Inkjet Ink',
}

export type MerchantTitleInput = {
  /** The Medusa product title, e.g. "Brother TN 277". Already brand-prefixed. */
  productTitle: string
  /** Variant name, or null for Medusa's "Default Title" placeholder. */
  variantName: string | null
  /** `metadata.cartridge_type` on the product. */
  cartridgeType: CartridgeTypeMeta
  /** `metadata.compatible` — true for every stocked product today. */
  compatible: boolean
}

function containsWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)
}

/**
 * The type noun to append, or null when the title already carries one.
 *
 * A product called "HP 120A Drum Unit" must not become "HP 120A Drum Unit
 * Toner Cartridge" — it is neither toner nor a cartridge.
 */
export function typeNounFor(productTitle: string, cartridgeType: CartridgeTypeMeta): string | null {
  if (SELF_DESCRIBING.test(productTitle)) return null
  const noun = cartridgeType ? TYPE_NOUN[cartridgeType] : FALLBACK_NOUN
  // Don't repeat a word the title already has ("... Ink Cartridge" would become
  // "... Ink Cartridge Ink Cartridge" if the catalogue is ever cleaned up).
  if (containsWord(productTitle, 'cartridge')) return null
  return noun
}

/**
 * Our own product taxonomy for `g:product_type`. Free text that Google uses as
 * a classification hint — unlike `google_product_category` it has no
 * controlled vocabulary, so there is no mismatch risk in being specific.
 */
export function buildProductType(
  productTitle: string,
  cartridgeType: CartridgeTypeMeta,
  brand: string,
): string {
  const leaf = SELF_DESCRIBING.test(productTitle)
    ? 'Drum Units & Parts'
    : cartridgeType
      ? PRODUCT_TYPE_LEAF[cartridgeType]
      : 'Printer Cartridges'
  return `Printer Consumables > ${leaf} > ${brand}`
}

/**
 * Build the Shopping title.
 *
 * Shape: `<product> <variant> <type noun> — Compatible`, e.g.
 * `Brother TN 277 Magenta Toner Cartridge — Compatible` (50 chars).
 *
 * Clamped to 70 characters by dropping the "— Compatible" suffix first, then
 * truncating on a word boundary. The model number and the type noun are the
 * parts that earn the click, so they survive.
 */
export function buildMerchantTitle({
  productTitle,
  variantName,
  cartridgeType,
  compatible,
}: MerchantTitleInput): string {
  const base = productTitle.trim()

  // Skip a variant name the product title already states — "Canon T13" has a
  // sole variant literally called "T13".
  const variant =
    variantName && !containsWord(base, variantName.trim()) ? variantName.trim() : null

  const noun = typeNounFor(base, cartridgeType)

  // "Generic Brother LC-472 XL" already says it isn't an OEM part; appending
  // "— Compatible" is noise in a field where every character is rationed.
  const wantsCompatible = compatible && !/^generic\b/i.test(base)

  const core = [base, variant, noun].filter(Boolean).join(' ')

  const full = wantsCompatible ? `${core}${COMPATIBLE_SUFFIX}` : core
  if (full.length <= MAX_TITLE_LENGTH) return full
  if (core.length <= MAX_TITLE_LENGTH) return core

  // Over budget even without the suffix. Nothing in the live catalogue reaches
  // here (the longest built title is 60 characters), but a future import
  // could. Shrink the *product title* rather than the tail: a shopper searching
  // "toner" needs the noun far more than the last word of a long model
  // designation, so the noun and the colour are what must survive.
  const tail = [variant, noun].filter(Boolean).join(' ')
  const budget = MAX_TITLE_LENGTH - (tail ? tail.length + 1 : 0)
  const trimmedBase = budget > 0 ? truncateOnWord(base, budget) : ''
  const rebuilt = [trimmedBase, tail].filter(Boolean).join(' ')

  // A pathological tail (no room for even one word of the model) leaves us
  // better off with the plain truncated core than with a title that is all
  // noun and no product.
  return rebuilt && trimmedBase ? rebuilt : truncateOnWord(core, MAX_TITLE_LENGTH)
}

function truncateOnWord(input: string, limit: number): string {
  if (input.length <= limit) return input
  const cut = input.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}
