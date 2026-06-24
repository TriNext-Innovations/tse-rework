/**
 * Canonical model name rules per brand.
 *
 * buildSearchName(brand, model) produces a normalized string stored in
 * printer_model.search_name.  It strips all non-alphanumeric chars from
 * brand + canonicalized-model so that ILIKE '%token%' works regardless of
 * spacing, punctuation, or whether the user typed the product-line prefix.
 *
 * Examples:
 *   Canon  "MX 494"        → search_name "canonpixmamx494"
 *   Canon  "LBP7100"       → search_name "canonisensyslbp7100"
 *   HP     "M233"          → search_name "hplaserjetm233"
 *   HP     "P1102"         → search_name "hplaserjetp1102"
 *   HP     "Enterprise M507" → search_name "hpenterprisem507"  (no double-prefix)
 */

export function canonicalize(brand: string, model: string): string {
  const b = brand.toLowerCase().trim()
  const m = model.trim()

  if (b === "canon") {
    // Inkjet PIXMA: MX, MG, TS, TR bare model numbers
    if (/^(MX|MG|TS|TR)\s*\d/i.test(m) && !/pixma/i.test(m)) return `PIXMA ${m}`
    // PIXMA G inkjet series
    if (/^G\d/i.test(m) && !/pixma/i.test(m) && !/maxify/i.test(m)) return `PIXMA ${m}`
    // MAXIFY GX series
    if (/^GX\d/i.test(m) && !/maxify/i.test(m)) return `MAXIFY ${m}`
    // i-SENSYS laser: MF and LBP prefixes
    if (/^(MF|LBP)\d/i.test(m) && !/sensys/i.test(m) && !/image/i.test(m)) return `i-SENSYS ${m}`
    // imageRUNNER: iR prefix
    if (/^iR\d/i.test(m) && !/imagerunner/i.test(m)) return `imageRUNNER ${m}`
  }

  if (b === "hp") {
    // LaserJet P-series (P1102, P3015 …)
    if (/^P\d/i.test(m) && !/laserjet/i.test(m)) return `LaserJet ${m}`
    // LaserJet M-series bare numbers (M127, M233 …) but NOT "Pro …", "Enterprise …", "Color …"
    if (
      /^M\d{3}/i.test(m) &&
      !/laserjet/i.test(m) &&
      !/pro/i.test(m) &&
      !/enterprise/i.test(m) &&
      !/color/i.test(m) &&
      !/colour/i.test(m)
    ) {
      return `LaserJet ${m}`
    }
  }

  if (b === "kyocera") {
    // ECOSYS M/P series bare numbers
    if (/^(M|P)\d/i.test(m) && !/ecosys/i.test(m) && !/taskalfa/i.test(m)) return `ECOSYS ${m}`
  }

  return m
}

/** Lowercase brand + canonical model, non-alphanumeric stripped → stored as search_name. */
export function buildSearchName(brand: string, model: string): string {
  const canonical = canonicalize(brand, model)
  return (brand + canonical).toLowerCase().replace(/[^a-z0-9]/g, "")
}
