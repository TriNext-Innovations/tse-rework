# Attribute Audit — TSE WooCommerce Catalogue

**Date:** 2026-05-15
**Source:** `migration/raw/products.json` (560 products)

---

## Summary

WooCommerce has **no formal product attributes configured**. All product characteristics are encoded in product names and category names instead. The transform script (`migration/transform-products.js`) introduced the first formal attribute — `Colour` — on the 80 grouped variable products.

---

## Attributes in use

### 1. Colour
- **Where encoded:** Product name suffix (e.g. "Generic Brother LC-472 XL **Yellow**")
- **Products affected:** 421 products have a colour suffix; 80 grouped into variable products with 300 total variants; 121 remain as simple products with a single colour
- **Naming consistency:** ✅ All colour words are consistently title-cased — no "black" vs "Black" issues found

| Colour value | Notes |
|---|---|
| Black | Standard |
| Cyan | Standard |
| Magenta | Standard |
| Yellow | Standard |
| Colour / 3-Colour | Tri-colour inkjet cartridges |
| Light | Appears on its own — likely "Light Cyan" or "Light Magenta" with the second word missing |

> **Action:** Investigate any products ending in just "Light" — the second word may have been dropped from the name.

---

### 2. Cartridge type (Inkjet vs Laser)
- **Where encoded:** Category name (e.g. "Generic Brother **Inkjet** Cartridges")
- **Coverage:** 536/560 products classifiable from category

| Type | Count |
|---|---|
| Inkjet | 178 |
| Laserjet | 358 |
| Unclassified (Pantum, Xerox) | 24 |

**Pantum (18 products):** Category is "Generic Pantum Cartridges" with no Inkjet/Laser distinction. All Pantum model prefixes (CTL, TL, DL, PC) are laser/toner — safe to classify as Laser.

**Xerox (5 products):** Category is "Generic Xerox Cartridges". Xerox produces only laser in this range — safe to classify as Laser.

> **Action:** Add Inkjet/Laser as a formal attribute during Medusa seed. Pantum and Xerox should default to Laser.

---

### 3. OEM vs Compatible
- **Where encoded:** Category name prefix "Generic" (e.g. "**Generic** Brother Inkjet Cartridges")
- **Coverage:** 100% — all 560 products are generic/compatible
- **Naming consistency:** ✅ "Generic" prefix is consistent across all categories except Xerox and Pantum (which use "Generic Xerox/Pantum Cartridges")

---

### 4. Page yield
- **Where encoded:** `short_description` HTML (e.g. "Page Yield: 2300 pages @ 5% Coverage")
- **Coverage:** 388/560 products (69%) — 172 products have no page yield documented
- **Not a structured attribute** — free text in HTML, not queryable

> **Action:** Parse page yield from `short_description` during seed and store as a structured product metadata field.

---

## Products with no formal attributes

All 260 simple products have zero formal WooCommerce attributes. This is expected — attributes were never configured in WooCommerce.

---

## Anomalies to resolve

| Product | Issue | Recommendation |
|---|---|---|
| `HP - 123 Toets` | No category, no price, SKU `HP-123TOETS`. "Toets" is Afrikaans for "key" — likely a test/dummy product | **Delete before seed** |
| Any product ending in just "Light" | Colour suffix may be incomplete (should be "Light Cyan" or "Light Magenta") | Manually verify names before seed |

---

## Attribute plan for Medusa seed

| Attribute | Source | Type |
|---|---|---|
| Colour | Product name suffix (already extracted) | Product option → variant |
| Cartridge type | Category name (Inkjet/Laser) | Product tag or metadata |
| Compatible (OEM vs Generic) | All products — hardcode `generic: true` | Product metadata |
| Page yield | Parse from `short_description` | Product metadata |
