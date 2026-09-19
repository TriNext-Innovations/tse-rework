# TSE Online — Commercial Findings

Analysis of the legacy WooCommerce store's actual sales data, and what it means
for the new platform's priorities. This is the commercial companion to the
technical migration docs.

- **Source:** WooCommerce → Analytics → Revenue / Products, `tse.co.za` admin
- **Period:** 1 Jan 2025 – 6 Sep 2026 (~20 months)
- **Pulled:** 2026-09-06

---

## 1. Headline numbers

| Metric | Value |
|---|---|
| Net sales (20 months) | **R132,470** |
| Orders | **76** (~3.8 per month) |
| Items sold | 296 (**3.9 per order**) |
| Average order value | **R1,743** |
| Products that ever sold | **84 of 555 (15%)** — 471 never sold |
| Top 25 products | R92,700 = **70% of all revenue** |

## 2. The trend is the problem

| Period | Net sales |
|---|---|
| Jan–Sep 2025 | R73,485 |
| Oct–Dec 2025 (implied) | R28,630 |
| **2025 full year** | **R102,115** |
| Jan–Sep 2026 | R30,355 (**−59% YoY**) |
| **2026 annualised** | **~R44,400** |

Online revenue is tracking from ~R102k to ~R44k in a single year. The rebuild is
a **turnaround**, not a refresh — and that raises the stakes on the cutover: the
store cannot afford to lose further ground to a botched migration.

## 3. Revenue concentration

**By brand (top 25):** HP 46% · Canon 38% · Brother 13% · Ricoh 4%
**By format (top 25):** **Laser toner 96%** · Inkjet 4%

**Best sellers:** HP 106A (31u / R10,230) · Canon 737 (20u / R6,000) ·
HP 151A (15u / R13,425 across a *single* order) · Canon 071H (14u / R8,680) ·
the Canon 054 set · Brother TN 279 / TN 2355 series.

---

## 4. What this changes

### 4.1 The customer is a business, not a consumer
R1,743 AOV, ~4 items per order, and single orders of 15 units. These are offices,
resellers and repeat trade buyers — not once-off consumers.

**Implication:** prioritise quantity/bulk pricing, a quote request path for larger
baskets, PO / invoice flow, saved business accounts, and one-click reorder. A pure
consumer checkout under-serves the buyer who actually generates the revenue.

### 4.2 Focus beats breadth — 85% of the catalogue is dead weight
471 of 555 SKUs sold nothing in 20 months. Roughly **97% of revenue is
HP + Canon + Brother laser toner**.

**Implication:** give those brands' printer pages, category pages and product pages
the full content and schema treatment first. Keep long-tail SKUs published for search
discovery, but spend no merchandising effort on them.

### 4.3 Retention is the cheapest revenue available
Cartridges are a **consumable with a predictable replacement cycle**, there is a base
of past buyers, and transactional email is already wired up — yet there is no reorder
marketing of any kind.

**Implication:** a post-purchase review request plus a reorder reminder timed to the
cartridge's expected life needs **no traffic growth at all**, and is the fastest
available lever against the decline.

### 4.4 High AOV makes traffic unusually valuable
At R1,743 per order, **+10 orders/month ≈ +R17k/month ≈ +R200k/year**. That payback
is what justifies the printer-page content build and local SEO work.

---

## 5. Priority order this implies

1. **Zero-loss migration** — done: 832/832 legacy URLs mapped and drift-tested (`PROD-DEPLOY.md` §7a).
2. **Reorder + review email flows** — fastest revenue, requires no traffic growth.
3. **B2B features** — bulk pricing, quote requests, PO/invoice, reorder accounts.
4. **Content depth on HP / Canon / Brother laser** — printer pages (real `<h1>`, unique copy, FAQ schema), category and product pages.
5. **On-site reviews** — currently zero; pure upside for search CTR and trust.
6. **Local SEO** — Google Business Profile plus JHB/Pretoria same-day delivery pages.

## 6. Open commercial questions

| Question | Data we have | Tracked as |
|---|---|---|
| Samsung / Lexmark inkjet — still stocked? | Inkjet is 4% of revenue; neither brand appears in the top 25 in any format. Current redirects point these legacy URLs at each brand's laser page. | `CLIENT-PENDING.md` #12 |
| Primary domain — `tse.co.za` or `tse-cartridges.co.za`? | `tse.co.za` holds the brand recognition, a 1997 registration and the existing link equity. One-shot SEO decision; must be settled before cutover. | `CLIENT-PENDING.md` #13 |

> **Caveat on completeness:** the per-product figures above come from the top 25 rows
> (70% of revenue). The remaining 59 sold products were not itemised. Filter the Products
> report for "Samsung" and "Lexmark" to close out the #12 question definitively.
