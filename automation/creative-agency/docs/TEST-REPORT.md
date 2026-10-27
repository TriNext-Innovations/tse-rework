# Test report — 27 October 2026

78 automated tests pass (`pytest -q`: 34 pipeline, 32 unit, 12 HTTP). Plus an
integration run of the n8n workflows inside a real n8n 2.37.9.

**Nothing here has published to Meta, called fal.ai, or called the Claude API.**
Production readiness is not claimed.

## Against the brief's acceptance tests

| # | Test | Result | How |
|---|------|--------|-----|
| 1 | Generate an original campaign concept | ✅ mechanics · ⏳ quality | Mock strategist; plan validation (14 slots, pillar mix, fact ids), retry on invalid plan, idempotent re-plan. **Real creative quality is untested until a live Claude run.** |
| 2 | Review candidates, select the strongest | ✅ mock | Director rejects a round → revision with direction → selects; repetition against memory rejects reused headlines |
| 3 | Artwork through the generation pipeline | ✅ mock HTTP | Real `FalClient` against a fake fal queue server: auth header, submit/status/result/download, 4:5 size, "no text" enforced in prompt |
| 4 | Apply branding and headline | ✅ local | Real renderer, real logo and fonts, 4 layouts × 2 tones; contrast ≥ 4.5 enforced by adaptive scrim, incl. on noise |
| 5 | Validate the finished image | ✅ mock vision | Deterministic checks (JPEG, 1080×1350, RGB, <8 MB, checksum, safe area, contrast); vision rejection → bounded regeneration → alert; claims guard blocks invented offers, prices, %, OEM wording |
| 6 | Save post with captions and schedule | ✅ | Captions per platform, UTM link per creative, schedule slot filled, both QC kinds recorded |
| 7 | Publishing in dry-run mode | ✅ mock Graph | Credentials present, mode dry_run → zero Graph calls, would-post recorded |
| 8 | Duplicate execution → no duplicate | ✅ mock Graph | 4 concurrent + 1 later run → exactly 1 FB post and 1 IG post. **This test caught a real race (3 posts) in the first build; fixed with a compare-and-set + slot lease.** |
| 9 | Failed generation / publishing handled | ✅ mock | fal transient vs permanent failures, reservation released; FB ok + IG fail → `partial`, alert, FB not re-posted; transient FB error retried in window; consecutive failures auto-pause |
| 10 | Budgets enforced | ✅ | Monthly visual hard stop, per-post cap, Claude monthly stop |
| 11 | Recovery after interruption | ✅ mock | Socket dropped after FB created the post → `unknown` → reconciled from the Page's posts, not re-posted; dead worker's lease expires and the submitted fal job is collected without resubmitting; stuck publications flagged and alerted once |
| 12 | Actual Meta publication with valid credentials | ❌ not run | Needs credentials, permissions and explicit authorisation. Gate verified: `mode=autonomous` without `LIVE_PUBLISHING_ENABLED` stays dry-run |

Also tested: review mode needs a human approval; pause stops everything; preflight
blocks a tampered asset and a fact whose evidence vanished from the site; fact
checker keeps the last verdict on network failure; settings validation; API auth
(no/bad token → 401, review page → 401 without password, media path traversal → 404).

## Independent review (hive review, Claude Sonnet 5.5, read-only)

First pass **blocked** on two findings, both fixed and covered by tests:
1. Meta Page token sent as a URL query parameter would land in httpx INFO logs →
   now an `Authorization` header; httpx/httpcore logs at WARNING; a test asserts no URL
   contains the token.
2. Review form had no CSRF guard (Basic auth is resent cross-site) → POSTs must carry
   an Origin/Referer matching Host; tests cover cross-site, missing-origin and same-site.

Also fixed: IG retry of a pending row whose container was already published is now
reconciled (test added); bad ids/decisions on `/review` return 400; the API no longer
lets callers choose the reviewer name.

Second pass **blocked** on three more, all fixed with tests:
- A transient failure reaching the public asset URL failed the slot for good → now
  retried within the window, behind a 10-minute backoff.
- A non-ASCII `Authorization` header crashed the handler → bytes comparison, 401.
- Unauthenticated `/healthz` echoed database connection errors → bare 503, detail logged.
Also: Facebook reconciliation now matches the creative's unique tracking link (survives
Meta's text normalisation) across the last 50 posts; dead dry-run→live code removed.
Third pass **blocked** on two, fixed with tests: `/media/final/../plates/…` sent with
raw dot-segments could serve private plates (now judged on the resolved path; tested over
a raw socket because HTTP clients normalise `..`); the reconcile marker `c1` matched
`c12` (now boundary-matched). Negative Content-Length clamped.

Fourth pass **blocked** on two, fixed with tests: a Graph 5xx on a write was retried as
if nothing had posted (now `unknown` → reconciled first; only rate-limit refusals are a
clean retry); a reviewer's rejection was honoured only in review mode (now a veto in every
mode). Non-object JSON bodies return 400.

Fifth pass: **done** (not blocked). Its non-blocking findings were also fixed: slots that
lapse with an unpublished creative now alert; partial slots share the retry backoff;
review-page fields escaped; constant-time username compare. Not done: rate limiting on
`/v1` and `/review` (the API is not exposed publicly; `/review` sits behind Basic auth).

**Residual risk, accepted:** if Meta accepts a Facebook post but it is missing from the
Page's last 50 posts when reconciliation runs, the retry could post twice. Instagram has
no such gap (the container records publication).

## n8n integration (real n8n 2.37.9, service in Docker with fakes)

All six workflows import. Executed via `n8n execute`:

| Workflow | Result |
|----------|--------|
| 1 Planning | facts verified, 2 campaigns planned, 2 Discord messages |
| 2 Production loop (×2) | 3 creatives developed → generated → rendered → approved; Discord per approval |
| 5 Publishing | `nothing_due` (no slot due in real time) — publishing path covered by pytest |
| 6 Performance | `no_credentials` / `no_published_posts` handled |
| 7 Monitoring | recover, alerts claim, health digest to Discord |

## Live services touched

| Service | What | Result |
|---------|------|--------|
| www.tse.co.za | fact re-verification (read-only GETs) | all 18 facts' evidence found |
| Claude API | — | not called |
| fal.ai | — | not called |
| Meta Graph | — | not called |

## Still to prove live (in this order)

1. One assignment end to end with real Claude + fal (~$1–2): the real test of creative quality.
2. A week in dry-run on the box, reviewed on `/agency/review`.
3. One Facebook post in review mode; confirm it is publicly visible logged out.
4. Instagram once Business Verification / App Review allow it.
5. Metrics field names against the live Graph version (insight metrics change between versions; failures are non-fatal and logged).
