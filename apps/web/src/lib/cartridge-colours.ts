/**
 * Cartridge colours for a collapsed compatibility card.
 *
 * The compatibility lookup collapses a cartridge's colour variants into one
 * card (#451). Without this the card showed whichever variant came first,
 * "SKU HP-177-K" with a black image, and a shopper after yellow had no sign
 * it was one click away.
 *
 * The variant's own title ("Cyan", "Tri-Colour") is the first source; the SKU
 * suffix (HP-177-K → Black) is the fallback for results that carry no titles.
 */
export type CartridgeColour = {
  name: string
  hex: string
  /** CSS background for a swatch that is not one flat colour (tri-colour). */
  background?: string
  /** True when one cartridge holds several inks, so it is not "a colour". */
  multi?: boolean
}

const BLACK: CartridgeColour = { name: 'Black', hex: '#0A0A0A' }
const PHOTO_BLACK: CartridgeColour = { name: 'Photo Black', hex: '#2A2A2A' }
const CYAN: CartridgeColour = { name: 'Cyan', hex: '#00AEEF' }
const MAGENTA: CartridgeColour = { name: 'Magenta', hex: '#EC008C' }
const YELLOW: CartridgeColour = { name: 'Yellow', hex: '#FFE600' }
const LIGHT_CYAN: CartridgeColour = { name: 'Light Cyan', hex: '#7FD6F7' }
const LIGHT_MAGENTA: CartridgeColour = { name: 'Light Magenta', hex: '#F27FC5' }
const TRI_COLOUR: CartridgeColour = {
  name: 'Tri-colour',
  hex: '#EC008C',
  background: 'conic-gradient(#00AEEF 0 33%, #EC008C 0 66%, #FFE600 0)',
  multi: true,
}

const BY_SUFFIX: Record<string, CartridgeColour> = {
  K: BLACK,
  BK: BLACK,
  PK: PHOTO_BLACK,
  C: CYAN,
  M: MAGENTA,
  Y: YELLOW,
  LC: LIGHT_CYAN,
  LM: LIGHT_MAGENTA,
  // HP-121XL3-CLR, HP-305XL-CLR: the colour cartridge of a black + colour pair.
  CLR: TRI_COLOUR,
}

const BY_NAME: Record<string, CartridgeColour> = {
  'black': BLACK,
  'photo black': PHOTO_BLACK,
  'cyan': CYAN,
  'magenta': MAGENTA,
  'yellow': YELLOW,
  'light cyan': LIGHT_CYAN,
  'cyan light': LIGHT_CYAN,
  'light magenta': LIGHT_MAGENTA,
  'magenta light': LIGHT_MAGENTA,
  'tri-colour': TRI_COLOUR,
  'tri-color': TRI_COLOUR,
  'tricolour': TRI_COLOUR,
  '3-colour': TRI_COLOUR,
  'colour': TRI_COLOUR,
  'color': TRI_COLOUR,
}

export function colourOfSku(sku: string): CartridgeColour | null {
  const m = sku.trim().toUpperCase().match(/-([A-Z]{1,3})$/)
  return m?.[1] ? BY_SUFFIX[m[1]] ?? null : null
}

/** A variant title read as a colour: "Cyan" → Cyan. Null for "Standard yield". */
export function colourOfName(name: string | null | undefined): CartridgeColour | null {
  if (!name) return null
  return BY_NAME[name.trim().toLowerCase().replace(/\s+/g, ' ')] ?? null
}

export type VariantRef = { sku: string; title?: string | null }

/**
 * The colours a multi-variant card stands for, in the given order and without
 * repeats. Null when any variant has no recognisable colour: a card must not
 * claim "3 colours" when it really holds three different things.
 */
export function coloursOfVariants(variants: VariantRef[]): CartridgeColour[] | null {
  const out: CartridgeColour[] = []
  for (const v of variants) {
    const c = colourOfName(v.title) ?? colourOfSku(v.sku)
    if (!c) return null
    if (!out.some((o) => o.name === c.name)) out.push(c)
  }
  return out
}

/** `coloursOfVariants` for callers that only have SKUs. */
export function coloursOfSkus(skus: string[]): CartridgeColour[] | null {
  return coloursOfVariants(skus.map((sku) => ({ sku })))
}
