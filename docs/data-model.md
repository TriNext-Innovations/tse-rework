# Compatibility Data Model

**Issue:** #2.6  
**Status:** Designed — pending client validation of compat-map-draft.csv before migration

---

## Problem

WooCommerce held no structured printer-to-cartridge mapping. Compatibility existed only as free text in `short_description` (e.g. `Compatible Models: MF735cx/MF832Cdw`). The extraction script (`migration/extract-compatibility.js`) parsed this into `migration/raw/compat-map-draft.json`, covering 249 of 340 products (73.2%). The remaining 91 products have no compatibility data and require client input.

---

## Schema

Three tables extend the Medusa product graph. All are Medusa custom tables registered as entities in `apps/backend/src/models/`.

### `printer_brand`

Canonical list of printer manufacturers.

```sql
CREATE TABLE printer_brand (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,  -- e.g. "HP", "Canon"
  slug        VARCHAR(100) NOT NULL UNIQUE,  -- e.g. "hp", "canon"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Seed data: 12 brands extracted from product categories (HP, Canon, Brother, Samsung, Pantum, Kyocera, Ricoh, Xerox, Konica Minolta, Lexmark, Epson, OKI).

---

### `printer_model`

One row per printer model. Linked to its manufacturer brand.

```sql
CREATE TABLE printer_model (
  id          SERIAL PRIMARY KEY,
  brand_id    INTEGER NOT NULL REFERENCES printer_brand(id) ON DELETE RESTRICT,
  name        VARCHAR(200) NOT NULL,          -- e.g. "LaserJet Pro M404n"
  slug        VARCHAR(200) NOT NULL,          -- e.g. "laserjet-pro-m404n"
  aliases     TEXT[],                         -- alternate strings seen in descriptions
  validated   BOOLEAN NOT NULL DEFAULT false, -- true after client sign-off
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (brand_id, slug)
);

CREATE INDEX idx_printer_model_brand ON printer_model(brand_id);
CREATE INDEX idx_printer_model_name  ON printer_model USING gin(to_tsvector('english', name));
```

`validated = false` on import. TSE fills gaps and flips flag during #2.4 review.

---

### `cartridge_compatibility`

Bridge table between `printer_model` and Medusa products. `brand_id` is carried
directly here — **not derived through `printer_model`** — to avoid a fan trap.

Without `brand_id` on this table, a query for "all HP-compatible cartridges" must
traverse `printer_brand → printer_model → cartridge_compatibility`, chaining two
1:N hops. Any aggregation (COUNT, GROUP BY) on that path double-counts products
that appear under more than one HP model. Carrying `brand_id` directly collapses
the fan: both brand and model are independent FKs on the same row.

```sql
CREATE TABLE cartridge_compatibility (
  id               SERIAL PRIMARY KEY,
  product_id       VARCHAR(255) NOT NULL,    -- Medusa product.id (e.g. "prod_01JXXXXX")
  brand_id         INTEGER NOT NULL REFERENCES printer_brand(id) ON DELETE RESTRICT,
  printer_model_id INTEGER NOT NULL REFERENCES printer_model(id) ON DELETE CASCADE,
  source           VARCHAR(50) NOT NULL DEFAULT 'parsed',
                   -- 'parsed'   = extracted from description text
                   -- 'client'   = provided by TSE directly
                   -- 'verified' = TSE confirmed a parsed entry
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (product_id, printer_model_id),
  -- brand_id must agree with printer_model.brand_id — enforce at app layer on insert
  CONSTRAINT fk_compat_brand_model CHECK (brand_id IS NOT NULL)
);

CREATE INDEX idx_compat_product       ON cartridge_compatibility(product_id);
CREATE INDEX idx_compat_brand         ON cartridge_compatibility(brand_id);
CREATE INDEX idx_compat_printer_model ON cartridge_compatibility(printer_model_id);
CREATE INDEX idx_compat_brand_product ON cartridge_compatibility(brand_id, product_id);
```

> **Note:** `brand_id` is intentionally denormalised. It is always set to
> `printer_model.brand_id` on insert and must never differ. This is a deliberate
> trade-off: one redundant column prevents a structural fan trap on every
> brand-level query.

---

## Entity Relationships

```
printer_brand ──< printer_model
printer_brand ──< cartridge_compatibility >── medusa_product
printer_model ──< cartridge_compatibility
```

`cartridge_compatibility` is the bridge table. It holds direct FKs to both
`printer_brand` and `printer_model` so either dimension can be queried without
traversing the other.

---

## Query: Find cartridges for a specific printer model

```sql
SELECT p.id, p.title, p.handle
FROM   product p
JOIN   cartridge_compatibility cc ON cc.product_id = p.id
WHERE  cc.printer_model_id = (
  SELECT pm.id FROM printer_model pm
  JOIN   printer_brand pb ON pb.id = pm.brand_id
  WHERE  pb.slug = 'hp' AND pm.slug = 'laserjet-pro-m404n'
)
ORDER  BY p.title;
```

## Query: Find all cartridges for a brand (no fan trap)

```sql
-- Correct: brand_id is a direct FK — no model hop, no double-counting
SELECT DISTINCT p.id, p.title, p.handle
FROM   product p
JOIN   cartridge_compatibility cc ON cc.product_id = p.id
JOIN   printer_brand pb           ON pb.id = cc.brand_id
WHERE  pb.slug = 'hp'
ORDER  BY p.title;
```

For the storefront wizard (`/find-your-cartridge`), both queries run server-side
via a Medusa custom API route: `GET /store/compatibility?brand=hp&model=laserjet-pro-m404n`.

---

## Query: Find all printer models for a brand (for the brand → model select step)

```sql
SELECT pm.id, pm.name, pm.slug
FROM   printer_model pm
JOIN   printer_brand pb ON pb.id = pm.brand_id
WHERE  pb.slug = 'hp'
  AND  pm.validated = true
ORDER  BY pm.name;
```

---

## Migration sequence

1. **#2.2 done** — `printer-brands.json` seeded from categories (12 brands)
2. **#2.3 done** — `printer-models.json` extracted from descriptions (512 models)
3. **#2.4** — Send `compat-map-draft.csv` to TSE → fill gaps + validate parsed entries
4. **#2.5** — Document gaps (91 products with no data)
5. **#2.6 (this doc)** — Schema designed
6. **Phase 2** — Write Medusa migration files; seed from validated CSV

---

## Files

| File | Purpose |
|---|---|
| `migration/raw/printer-brands.json` | 12 brands extracted from product categories |
| `migration/raw/printer-models.json` | 512 unique models grouped by brand |
| `migration/raw/compat-map-draft.json` | SKU → models mapping, 249 products (73.2%) |
| `migration/extract-compatibility.js` | Extraction script |

---

## Gap summary (for #2.5)

| Metric | Count |
|---|---|
| Total products | 340 |
| Products with compat data | 249 (73.2%) |
| Products missing compat data | 91 (26.8%) |
| Unique printer models extracted | 512 |
| Brands represented | 12 |

The 91 products with no compat data will be flagged in `compat-map-draft.csv` with an empty models column for TSE to fill in.
