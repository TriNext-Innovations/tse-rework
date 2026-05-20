# Category Hierarchy Audit — TSE WooCommerce Catalogue

**Date:** 2026-05-15
**Source:** `migration/raw/products.json` (560 products, 18 categories)

---

## Current structure

The WooCommerce category tree is **completely flat** — no parent-child relationships exist. All 18 categories sit at the same level.

| Category | Slug | Products |
|---|---|---|
| Generic Brother Inkjet Cartridges | `brother-inkjet-cartridges` | 32 |
| Generic Brother Laserjet Cartridges | `brother-laserjet-cartridges` | 50 |
| Generic Canon Inkjet Cartridges | `canon-inkjet-cartridges` | 33 |
| Generic Canon Laserjet Cartridges | `canon-laserjet-cartridges` | 79 |
| Generic Epson Inkjet Cartridges | `epson-inkjet-cartridges` | 30 |
| Generic HP Inkjet Cartridges | `hp-inkjet-cartridges` | 73 |
| Generic HP Laserjet Cartridges | `hp-laserjet-cartridges` | 134 |
| Generic Konica Minolta Laserjet Cartridges | `generic-konica-minolta-laserjet-cartridges` | 12 |
| Generic Kyocera Laserjet Cartridges | `generic-kyocera-laserjet-cartridges` | 17 |
| Generic Lexmark Inkjet Cartridges | `lexmark-inkjet-cartridges` | 8 |
| Generic Lexmark Laserjet Cartridges | `lexmark-laserjet-cartridges` | 3 |
| Generic OKI Laserjet Cartridges | `generic-oki-laserjet-cartridges` | 1 |
| Generic Pantum Cartridges | `pantum-cartridges` | 18 |
| Generic Ricoh Laserjet Cartridges | `generic-ricoh-laserjet-cartridges` | 23 |
| Generic Samsung Inkjet Cartridges | `samsung-inkjet-cartridges` | 2 |
| Generic Samsung Laserjet Cartridges | `samsung-laserjet-cartridges` | 39 |
| Generic Xerox Cartridges | `xerox-cartridges` | 5 |
| Uncategorized | `uncategorized` | 3 |

---

## Issues found

### 1. No hierarchy
All categories are flat. A two-level tree (Brand → Type) would improve navigation and SEO.

### 2. Slug inconsistency
11 of 17 slugs are missing the `generic-` prefix that their display name has. The 4 newer categories (Konica Minolta, Kyocera, OKI, Ricoh) have the prefix; the older ones do not.

> **Action:** Standardise all slugs to `generic-{brand}-{type}-cartridges` pattern during seed.

### 3. Missing type on Pantum and Xerox
- `Generic Pantum Cartridges` — no Inkjet/Laser in name or slug
- `Generic Xerox Cartridges` — no Inkjet/Laser in name or slug
- Both brands are laser-only in this catalogue

> **Action:** Rename to `Generic Pantum Laserjet Cartridges` and `Generic Xerox Laserjet Cartridges` in Medusa.

### 4. Uncategorized products
- `HP - 123 Toets` — no category at all (confirmed test/dummy product — delete before seed)
- `HP 953 XL Yellow/Magenta/Cyan` — dual-assigned to both `Generic HP Inkjet Cartridges` and `Uncategorized`; remove the Uncategorized assignment

### 5. Low-volume categories
| Category | Count | Note |
|---|---|---|
| Generic OKI Laserjet Cartridges | 1 | Single product — keep for now, may grow |
| Generic Samsung Inkjet Cartridges | 2 | Very thin — consider merging into Generic Samsung Cartridges if no inkjet expansion planned |
| Generic Lexmark Laserjet Cartridges | 3 | Thin but distinct from Inkjet |

---

## Proposed Medusa category tree

```
Inkjet Cartridges
├── Brother
├── Canon
├── Epson
├── HP
├── Lexmark
└── Samsung

Laser Cartridges
├── Brother
├── Canon
├── HP
├── Konica Minolta
├── Kyocera
├── Lexmark
├── OKI
├── Pantum
├── Ricoh
├── Samsung
└── Xerox
```

**Rationale:** Type at the top level because the Inkjet/Laser split is the primary purchase decision (different printer types). Brand as the second level for filtering within a type.

> **Decision:** ✅ **Type → Brand agreed.** Customers know their printer type (inkjet/laser) first, then filter by brand. Note: a printer compatibility search also exists alongside the category tree — users can find cartridges by searching their printer model directly (Phase 2, `modules/compatibility/`).

---

## Summary for seed script

- 17 real categories → restructure into 2 top-level + 13 brand subcategories
- Rename Pantum and Xerox to include "Laserjet"
- Standardise all slugs to `generic-{brand}-{type}-cartridges`
- Remove Uncategorized entirely; fix HP 953 XL triple assignment
- Delete `HP - 123 Toets` before seed
- ✅ Category structure: **Type → Brand** confirmed
