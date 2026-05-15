# Compatibility Data Audit — Issue #2.1

**Date:** 2026-05-15

## Verdict: No structured compatibility data exists

| Source checked | Finding |
|---|---|
| Product attributes | Empty on all 560 products |
| Product tags | Empty on all 560 products |
| Custom meta fields | Only Facebook Pixel fields (`fb_product_item_id`, `fb_visibility`) — no compatibility data |
| Product descriptions | **Compatibility data exists here as free text only** |

---

## What exists: free text in `short_description`

411 of 560 products contain a line like:

```
Compatible Models: MF735cx/MF832Cdw/LBP722Cdw
Compatible Printers: Eco Tank L6160/6190/4260
```

515 unique printer model strings were extracted from these descriptions.
Extraction is imperfect — some strings are concatenated (e.g. `LBP1538 Image Runner C1533` is two models run together).

The remaining 149 products have no compatibility information at all.

---

## Impact on Phase 2

The compatibility finder (`/find-your-cartridge`) requires a clean, structured mapping of:
```
printer_model → [cartridge_sku, ...]
```

This **cannot be reliably built from the description text alone** because:
- Models are inconsistently delimited (`/`, `,`, space, newline)
- Some model strings are concatenated without separators
- 149 products have no data at all
- No canonical printer model database to validate against

---

## Resolution options

| Option | Effort | Accuracy |
|---|---|---|
| A. Parse descriptions + manual cleanup | Medium | ~80% — gaps remain for 149 products |
| B. Client supplies printer-model → SKU spreadsheet | Low (for us) | 100% if complete |
| C. Parse descriptions as a starting point, send to client for gap-fill | Medium | 100% after client review |

**Recommendation: Option C.** Run the parser to extract what we can, export to a CSV, send to TSE to fill in the gaps and validate. This gives them something concrete to react to rather than a blank sheet.

---

## Next steps (issues #2.2–#2.6)

- **#2.2** Extract printer brand list from description text ← can do from products.json
- **#2.3** Extract printer model list from description text ← can do from products.json  
- **#2.4** Map cartridge SKUs to printer models ← needs client validation
- **#2.5** Document gaps ← will fall out of the parser output
- **#2.6** Define compatibility data model ← unblocked, can design now
