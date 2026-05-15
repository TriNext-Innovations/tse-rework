# Image Audit — TSE WooCommerce Catalogue

**Date:** 2026-05-15
**Source:** `migration/raw/products.json` (560 products)

---

## Summary

| Metric | Value |
|---|---|
| Total unique image URLs | 309 |
| Successfully downloaded | 309 (0 failures) |
| Saved to | `migration/images/` |
| Products with no image | 4 |
| Products using placeholder only | 18 |
| Images below 800px threshold | 11 |

---

## Images below 800px threshold

All flagged images are old catalogue entries. Newer products (2024–2025 uploads) are all 2000px originals — well above threshold.

| Image | Max width | Product |
|---|---|---|
| `Tse.jpg` | 500px | Shared placeholder (18 products) |
| `CF226X.jpg` | 600px | HP CF226X |
| `TN2000-2025-2035.png` | 508px | Generic Brother TN-2025 |
| `NO.35.jpg` | 400px | Lexmark Nr.35 Colour |
| `34.jpg` | 400px | Lexmark Nr. 34 Black |
| `37.jpg` | 400px | Lexmark Nr.37 XL Colour |
| `36-1.jpg` | 400px | Lexmark Nr.36 XL Black |
| `26.jpg` | 400px | Lexmark Nr.26 Colour |
| `16.jpg` | 400px | Lexmark Nr.16 Black |
| `15-1.jpg` | 400px | Lexmark Nr.15 Colour |
| `14-1.jpg` | 400px | Lexmark Nr. 14 Black |

> **Action:** Replace these 11 images with higher-resolution versions before launch. The Lexmark inkjet range appears to be old stock — confirm whether these products will be included in the new catalogue.

---

## Products with no image

| Product | Note |
|---|---|
| HP 230A Yellow | No image assigned in WooCommerce |
| HP 230A Magenta | No image assigned in WooCommerce |
| HP 230A Cyan | No image assigned in WooCommerce |
| HP - 123 Toets | Test product — delete before seed |

> **Action:** Add images for the HP 230A colour range before seed.

---

## Products using placeholder only (Tse.jpg — 500px)

These 18 products share a single generic placeholder image. The placeholder is also below the 800px threshold.

Includes: Generic Brother LC-472 XL (all colours), HP 230A (all colours), HP 305 XL (Black + Colour), Ricoh SP C430 Black, and others.

> **Action:** Source proper product images for all 18 products. The HP 230A and HP 305 XL ranges are high-volume — prioritise those.

---

## All URLs publicly accessible

✅ All 309 image URLs returned HTTP 200. No broken links.
