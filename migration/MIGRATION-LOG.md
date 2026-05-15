# TSE Migration Log

Tracks the progress of data extraction from WooCommerce (`tse.co.za`) into
the new Medusa-based stack. Update this file after every phase.

---

## Phase 0 — WooCommerce Audit (Issue #1.2)

**Date:** 2026-05-14
**Owner:** TriNext Innovations
**Status:** Complete — blockers identified

### Export result

| Metric | Value |
|---|---|
| Total products exported | 560 |
| Exported to | `migration/raw/products.json` |
| Products missing SKU | **560 (100%)** |
| Variable products (with variations) | TBC — check `products.json` |
| Export endpoint | `POST /api/wc/products/export` |

### Critical blocker — All 560 products have no SKU

Every product returned `sku: ""` from the WooCommerce API.

**Impact on Medusa import:**
- Medusa `ProductVariant` requires a SKU for inventory tracking
- Without SKUs, the seed script cannot create inventory items
- The compatibility finder (Phase 2) maps printer models → SKU — no SKU means no compatibility data

**Resolution options (pick one before Phase 1 seed):**

| Option | Effort | Risk |
|---|---|---|
| A. Add SKUs in WooCommerce admin, re-export | High — 560 manual entries | Low |
| B. Auto-generate SKUs from product name + ID during seed (e.g. `HP-678-BLK-42`) | Low | Medium — generated SKUs may not match supplier codes |
| C. Import supplier SKU list as a CSV, match by product name | Medium | Low — most accurate |

**Recommendation:** Option C. Request the supplier SKU master list, match by
product name during the seed script, and fall back to Option B for any
unmatched products. Flag unmatched products in `migration/raw/sku-gaps.json`.

---

## Phase 1 — Medusa Seed (Pending)

**Status:** Not started — blocked by SKU resolution above

**Planned inputs:**
- `migration/raw/products.json` — raw WooCommerce export
- `migration/raw/sku-map.csv` — supplier SKU master (TBC)

**Planned outputs:**
- Products + variants in Medusa (`ProductModuleService`)
- Categories in Medusa (`ProductCategoryService`)
- Inventory items (`InventoryModuleService`)
- `migration/raw/seed-report.json` — what was created, what was skipped

**Seed script:** `apps/backend/src/scripts/seed-products.ts`
**Run command:** `npx medusa exec src/scripts/seed-products.ts`

---

## Phase 2 — Variations & Compatibility (Pending)

**Status:** Not started

- Export product variations per variable product
- Build `migration/raw/compatibility.csv` (printer model → SKU mapping)
- Seed `modules/compatibility/` in Medusa backend
