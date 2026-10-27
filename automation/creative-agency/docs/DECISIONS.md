# Decisions and assumptions

## n8n schedules; a small service decides

The brief asks for n8n as the orchestrator. It is: every schedule, trigger,
retry policy and notification is an n8n workflow. But duplicate-proof
publishing, budget reservation under a lock, lease-based recovery and
asset rendering are not things n8n Code nodes do reliably or testably — and
the existing TSE workflows show the cost (a stray field killed the caption
pipeline for four days in September). So the logic lives in one Python service
with 97 tests, and n8n calls it.

Trade-off: one more container on the box. Alternative considered: everything in
n8n with Postgres nodes — rejected for the locking and rendering alone.

## Seven logical workflows, five actual

Development, production and QC are one 20-minute loop (`/v1/cycle`) rather than
three workflows, because they are one queue: finishing work (QC) is always
preferred to starting it. Splitting them would mean three schedules racing over
the same rows for no gain.

## The creative standard is enforced in layers, not by one self-review

1. Copywriter writes four concepts per round in different territories.
2. A separate creative-director call — different instructions, no stake in the
   concepts — scores seven criteria and must reach 7+ on originality, insight and
   relevance. It can send the whole round back with direction.
3. Deterministic copy QC: claims against the fact sheet, banned phrases, length,
   hashtags, emoji, SA spelling, headline similarity to 120 days of history.
4. After rendering: file/spec/safe-area/contrast checks on the actual JPEG.
5. A vision review of the actual pixels by a third call: stray text, logo damage,
   packaging, artefacts, taste. Its verdict routes the work back to the right stage.
6. Optional human review mode before autonomy.

The model-based reviewers use the same model family as the writer; that is a known
limit. The deterministic gates do not depend on any model's judgment.

## Facts are data with provenance, re-verified live

`brand/verified_facts.json` holds every claim with its source URL and the exact
words that prove it. Copy must cite fact ids; QC maps claim triggers (rand amounts,
percentages, "overnight", "warranty", "since 1987"…) to required facts and fails
closed on anything unmapped. The site's own statistics that lack substantiation
("↓60% cost per page", "meets or exceeds OEM yield") are marked `restricted` — the
737 yield is already disputed (tse-rework #519). Prices are not usable at all yet:
they change, and no product-level comparison exists.

## Never generate the logo, packaging, or a specific product

The image model makes a word-free plate. The renderer sets Fraunces/Inter type and
composites the official logo rasterised from the storefront SVGs. TSE ships in
unbranded supplier boxes and its catalogue photos are supplier stock, so generated
packaging would depict something that does not ship. A cartridge may appear only as
an unbranded prop. Real product photography is the single biggest upgrade available
(see the asset-ingestion note below).

## Product spotlights are type-led and priced from the live store

Chosen by Ryno, 27 Oct 2026: every 4th–5th post (random interval) promotes one real
product, so the feed says "we sell cartridges", not "we like printers". The product
name and price are the hero, set in type from store data — never written by a model
and never shown as a generated cartridge (it would not be what ships). Prices live
only in the image, never in captions, so a price change can be re-rendered at publish
time instead of going out stale. Slots and products are chosen by code (seeded per
week, so a retried plan picks the same), not by the strategist.

## Models

- Claude Opus 5.5 for every stage (configurable per stage via env). Effort `high` for
  strategist/copywriter/director, `medium` for the rest. Structured outputs via
  `messages.parse` with server-side refusal fallback.
- fal.ai FLUX.2 [pro] ($0.045 at 1088×1360) by default — strongest photographic
  still-life per dollar; Nano Banana 2 at 2K ($0.12) when the art director judges
  a scene complex. Adding a model is one entry in `config.IMAGE_MODELS`.

## Video: not built

The brief says to favour static and use video only where it strengthens an idea.
Image-to-video on fal costs $0.35–0.70 per 5-second clip — a third of the monthly
visual budget for one post — and Instagram Reels publishing has its own container
flow that cannot be tested until Instagram publishing works at all (below). The
schema carries a `format` column and a `video_enabled` setting so it can be added
without migration. Recommendation: revisit after a month of static performance data.

## Storage

Final JPEGs are served by the service from a persistent volume, behind the box's
nginx, at content-hashed URLs (Meta fetches by URL). Plates stay private. An R2
backend would slot behind `Storage` if disk or bandwidth becomes a concern; at
~200 KB per ad it won't for years.

## Assumptions to confirm

- Organic Page posts, not paid ads. "Advertisements" here are creative executions
  published to the feed. Boosting/paid placement needs the Marketing API and an ad
  account — not built.
- The `TSE Social` Meta app's token has `pages_manage_posts` and, for Instagram,
  `instagram_content_publish`. Earlier finding (Sep 2026): the app is in Development
  mode and Instagram publishing is gated on Meta Business Verification; Facebook posts
  may not be visible to the public until the app is Live. Not re-tested here.
- Captions link to the homepage with UTM parameters; GA4 on tse.co.za attributes
  sessions. No sale is inferred from a click.

## Asset-ingestion requirement (open)

To run product-specific ads honestly the agency needs real photographs of real stock
(mid-grey ground, three-quarter angle, consistent framing). Until then, product-pillar
assignments are written as type-led or conceptual executions.
