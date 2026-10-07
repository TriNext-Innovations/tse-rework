/**
 * Cartridge colours read off the SKU suffix (HP-177-K → Black).
 *
 * The compatibility lookup collapses a cartridge's colour variants into one
 * card (#451). Without this the card showed whichever variant came first,
 * "SKU HP-177-K" with a black image, and a shopper after yellow had no sign
 * it was one click away.
 */
export type CartridgeColour = { name: string; hex: string }

const BY_SUFFIX: Record<string, CartridgeColour> = {
  K:  { name: 'Black',         hex: '#0A0A0A' },
  BK: { name: 'Black',         hex: '#0A0A0A' },
  PK: { name: 'Photo Black',   hex: '#2A2A2A' },
  C:  { name: 'Cyan',          hex: '#00AEEF' },
  M:  { name: 'Magenta',       hex: '#EC008C' },
  Y:  { name: 'Yellow',        hex: '#FFE600' },
  LC: { name: 'Light Cyan',    hex: '#7FD6F7' },
  LM: { name: 'Light Magenta', hex: '#F27FC5' },
}

export function colourOfSku(sku: string): CartridgeColour | null {
  const m = sku.trim().toUpperCase().match(/-([A-Z]{1,2})$/)
  return m?.[1] ? BY_SUFFIX[m[1]] ?? null : null
}

/**
 * The colours a multi-variant card stands for, in SKU order and without
 * repeats. Null when any SKU has no recognisable colour: a card must not
 * claim "3 colours" when it really holds three different things.
 */
export function coloursOfSkus(skus: string[]): CartridgeColour[] | null {
  const out: CartridgeColour[] = []
  for (const sku of skus) {
    const c = colourOfSku(sku)
    if (!c) return null
    if (!out.some((o) => o.name === c.name)) out.push(c)
  }
  return out
}
