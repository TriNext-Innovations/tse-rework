# TSE Migration Log

Tracks the progress of data extraction from WooCommerce (`tse.co.za`) into
the new Medusa-based stack. Update this file after every phase.

---

## Phase 0 — WooCommerce Audit (Issue #1.2)

**Date:** 2026-05-15
**Owner:** TriNext Innovations
**Status:** Complete

### Export result

| Metric | Value |
|---|---|
| Total products exported | 560 |
| Raw export | `migration/raw/products.json` |
| Product types | All `simple` — WooCommerce had no variable products |
| Variations exported | N/A — zero variable products in catalogue |
| SKUs | Present on all 560 products (earlier `missingSkuCount: 560` was an export script bug) |

### Transform — `migration/transform-products.js`

Products were grouped by colour suffix into a variable/variant structure for Medusa.

| Output | Count |
|---|---|
| Variable products (grouped by colour) | 80 |
| Colour variants total | 300 |
| Simple products | 260 |
| **Output total** | **340** |

- Colour words stripped from variable product descriptions (e.g. "No 933XL Yellow" → "No 933XL")
- Printer model names preserved (e.g. "HP Colour LaserJet")
- Transformed output: `migration/raw/products-transformed.json`
- Transform report: `migration/raw/transform-report.json`

---

## Phase 1 — Medusa Seed (Pending)

**Status:** Not started

**Planned inputs:**
- `migration/raw/products-transformed.json` — grouped, cleaned product data

**Planned outputs:**
- Products + variants in Medusa (`ProductModuleService`)
- Categories in Medusa (`ProductCategoryService`)
- Inventory items (`InventoryModuleService`)
- `migration/raw/seed-report.json` — what was created, what was skipped

**Seed script:** `apps/backend/src/scripts/seed-products.ts`
**Run command:** `npx medusa exec src/scripts/seed-products.ts`

---

## Phase 0.5 — Image Audit & Download (Issue #1.5)

**Date:** 2026-05-15
**Status:** Complete

Full report: `migration/raw/image-audit.md` | Images: `migration/images/` (309 files)

| Metric | Value |
|---|---|
| Unique images downloaded | 309 / 309 (0 failures) |
| Below 800px threshold | 11 — Lexmark inkjet range (400px), Tse.jpg placeholder (500px), HP CF226X (600px), Brother TN-2025 (508px) |
| Products with no image | 4 — HP 230A ×3 + HP 123 Toets (delete) |
| Products placeholder only | 18 — need real images before launch |

**Actions before seed:** Replace 11 low-res images; source images for 18 placeholder products (HP 230A + HP 305 XL priority); delete HP 123 Toets.

---

## Phase 0.4 — Category Hierarchy Audit (Issue #1.4)

**Date:** 2026-05-15
**Status:** Complete

Full report: `migration/raw/category-audit.md`

- 18 categories, completely flat — no hierarchy in WooCommerce
- Proposed structure: Type (Inkjet/Laser) → Brand (2 levels)
- Slug inconsistency: 11/17 slugs missing `generic-` prefix — standardise during seed
- Pantum + Xerox missing Inkjet/Laser distinction — both are laser-only
- `HP - 123 Toets` — delete before seed
- `HP 953 XL` Yellow/Magenta/Cyan — strip duplicate Uncategorized assignment

> ✅ **Decision:** Type → Brand confirmed. Printer compatibility search (printer model → SKU) sits alongside the category tree as a separate Phase 2 feature.

---

## Phase 0.3 — Attribute Audit (Issue #1.3)

**Date:** 2026-05-15
**Status:** Complete

Full report: `migration/raw/attribute-audit.md`

| Attribute | Source | Coverage |
|---|---|---|
| Colour | Product name suffix | 421/560 |
| Cartridge type (Inkjet/Laser) | Category name | 536/560 — Pantum + Xerox default to Laser |
| OEM vs Compatible | All generic — hardcode `generic: true` | 100% |
| Page yield | `short_description` HTML | 388/560 (69%) |

**Anomalies:**
- `HP - 123 Toets` — no category, no price; delete before seed
- Products ending in just "Light" — verify name completeness before seed

**Attribute plan for Medusa seed:** Colour → variant option; cartridge type + page yield → product metadata; compatible → hardcode.

---

## Phase 2 — Variations & Compatibility (Pending)

**Status:** Not started

- Build `migration/raw/compatibility.csv` (printer model → SKU mapping)
- Seed `modules/compatibility/` in Medusa backend
