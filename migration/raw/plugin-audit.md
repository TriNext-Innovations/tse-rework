# WooCommerce Plugin Audit — Issue #1.8

**Date:** 2026-05-15  
**Source:** Live site inspection of tse.co.za page source

---

## Plugins with impact on migration

These plugins add custom data, checkout behaviour, or integrations that need a
replacement decision before Milestone 1.

| Plugin | Version | What it does | Migration decision |
|---|---|---|---|
| **WT Smart Coupons for WooCommerce** | 2.3.0 | BOGO deals, giveaway products, advanced coupon rules | **Replicate in Medusa** — Medusa has a Promotions module; implement BOGO as promotion rules |
| **Mailchimp for WooCommerce** | 6.1 | Email capture at checkout, customer segmentation, pixel tracking | **Replace** — use Resend (already planned) for transactional email; rebuild list sync via Medusa subscriber webhook if needed |
| **All in One SEO** | 4.9.6.2 | Product meta titles, descriptions, sitemaps | **Replace** — Next.js 15 `generateMetadata()` + `sitemap.ts` covers this natively; no plugin needed |
| **AJAX Search for WooCommerce** | 1.33.0 | Live product search | **Replace** — implement with Medusa's product search API + a search input component; no external plugin needed |

---

## Analytics & tracking — drop or reconfigure

These plugins add no custom product data. All can be replaced with standard
Next.js integrations or simply removed.

| Plugin | Version | Decision |
|---|---|---|
| Google Analytics for WordPress (MonsterInsights) | 10.1.3 | **Drop** — add `@next/third-parties` GA4 in layout.tsx |
| Burst Statistics | — | **Drop** — client to decide if they want self-hosted analytics |
| WooCommerce Google Analytics Integration | — | **Drop** — GA4 e-commerce events implemented manually in Next.js |
| Google Site Kit | 1.178.0 | **Drop** — Search Console verified via DNS; consent mode via CookieYes or similar |

---

## Communication & forms — drop

| Plugin | Decision |
|---|---|
| WP WhatsApp Chat | **Drop** — re-add as a client-side widget script in layout.tsx if client wants to keep it |
| Ninja Forms | **Drop** — any contact/quote forms rebuilt with React Hook Form |

---

## SEO & tracking identifiers found

- Google Tag Manager IDs: `G-4SL7N97ZD1`, `G-WV63938Q9J`
- Facebook domain verification token: `ri8d551m3ty9cy4dtcj11gnlzq5mxs`
- Google reCAPTCHA v3 active on site

These need to be re-added to the new site via Next.js `<Script>` tags or
`@next/third-parties`. Confirm with client which IDs are still active before
porting.

---

## No custom product fields found

None of the plugins store custom product data that isn't already in the WooCommerce
product export. The only product-adjacent plugins are:

- **WT Smart Coupons** — promotion rules (no additional product fields; rules are
  stored in coupon post meta, not product meta)
- **AIOSEO** — SEO meta per product (already in `short_description`; nothing extra
  to migrate)

No additional data extraction is required beyond what Phase 0 already captured.

---

## WordPress / theme versions

| Component | Version |
|---|---|
| WordPress | 6.9.4 |
| WooCommerce | 10.7.0 |
| Divi Theme | 4.27.6 |

Divi is page-builder only — no impact on migration.
