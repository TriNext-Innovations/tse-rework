# Operations

## Switches — what stops publishing

Live posting needs **all three**; any one off means nothing reaches Meta.

| Switch | Where | Default | Effect when off |
|--------|-------|---------|-----------------|
| `LIVE_PUBLISHING_ENABLED` | `.env` on the box (redeploy to change) | `false` | every publish is a dry run, logged as such |
| `mode` | settings table | `dry_run` | `dry_run`: never calls Meta writes · `review`: publishes only creatives a human approved · `autonomous`: publishes anything that passed QC |
| `publishing_paused` | settings table | `false` | publisher does nothing at all; set automatically after `consecutive_failure_pause` live failures in a row |

```sh
docker exec tse-agency python -m agency pause           # emergency stop, immediate
docker exec tse-agency python -m agency resume
docker exec tse-agency python -m agency mode review     # dry_run | review | autonomous
docker exec tse-agency python -m agency health
```

Or `POST /v1/settings {"key": "publishing_paused", "value": true}` with the bearer token.

### Going live, in order

1. **Dry run** (default): let the pipeline fill a week. Review output at
   `https://n8n.tse-cartridges.co.za/agency/review` (user `review`). Tune prompts / facts.
2. **Review period:** set `LIVE_PUBLISHING_ENABLED=true`, redeploy, `mode review`.
   Only creatives approved on the review page publish; unapproved slots are skipped
   and alerted.
3. **Autonomous:** after a clean review period, `mode autonomous`. QC alone gates.

Before step 2: pause or retire the old `TSE — Caption Queue` / `Evergreen Fill` /
`Publish Approved Drafts` workflows, or the Page gets two streams.

## Day to day

- Discord gets: new campaigns, approvals, every publication result, alerts (each once),
  a 07:00 digest of queue depth, spend and mode.
- `/agency/review` shows the next 14 days with images, captions, QC score and
  publication links.
- `python -m agency memory "luxury"` searches every concept ever written, chosen or not.
- `python -m agency facts-verify` re-checks every fact against www.tse.co.za. The
  Planning workflow does this daily; a fact whose evidence disappears from the site is
  marked stale and any creative citing it is held at preflight.

**Changing what the agency may say:** edit `brand/verified_facts.json` (add the source
URL and the exact evidence text), bump `PROMPT_VERSION` in `agency/prompts/__init__.py`,
rebuild. Offers and discounts are deliberately impossible until a fact for them exists.

## Settings

| Key | Default | Notes |
|-----|---------|-------|
| `publish_times` | `["08:00","20:00"]` | SAST. The publishing workflow polls every 15 min, so no n8n change needed |
| `platforms` | `["facebook","instagram"]` | drop `instagram` while IG publishing is blocked |
| `queue_days` | 7 | target depth of approved work |
| `visual_budget_monthly_usd` | 20 | hard stop for fal.ai, per SAST calendar month |
| `visual_budget_per_post_usd` | 0.35 | caps regeneration spend on one ad |
| `llm_budget_monthly_usd` | 40 | hard stop for Claude; reported separately |
| `max_concept_rounds` / `max_production_attempts` | 2 / 3 | then the assignment fails and alerts |
| `max_publish_attempts` / `publish_retry_window_hours` | 3 / 6 | per platform |
| `qc_min_vision_score` | 7 | out of 10 |
| `image_model` | `fal-ai/flux-2-pro` | fallback if the art director names an unknown model |
| `video_enabled` | false | reserved; video is not built (see DECISIONS) |

## Costs (estimates — measure after the first live week)

| Item | Unit price (checked 27 Oct 2026) | Monthly at 60 ads |
|------|------|------|
| FLUX.2 [pro], 1088×1360 | $0.045/image | ~$3–8 (1–3 attempts per ad) |
| Nano Banana 2 at 2K (art director's choice for complex scenes) | $0.12/image | adds ~$0.08 per ad that uses it |
| Claude Opus 5.5 ($4 / $20 per M tokens) | ~$0.35–0.55 per ad across 4–6 calls | ~$25–35 |
| Box | existing tse-n8n (1 GB) | $0, or ~+$6 to go to 2 GB |

Visual spend is reserved *before* each fal call and enforced under a lock, so the $20
cap cannot be overrun by concurrent jobs. fal does not report per-request cost, so the
ledger books the published price; reconcile monthly against the fal dashboard.
Claude cost is computed from returned token usage.

## Deploy (tse-n8n box) — not yet done

The box (`139.84.228.41`, 1 GB RAM, n8n 2.37.9 in `/opt/n8n`) is TriNext-owned.

1. Copy this directory to `/opt/tse-agency`, create `.env` from `.env.example` (`chmod 600`).
2. Confirm n8n's network name: `docker network ls` (compose expects `n8n_default`).
3. `docker compose up -d --build`; `curl -s 127.0.0.1:8090/healthz`.
4. nginx, inside the `n8n.tse-cartridges.co.za` server block:
   ```nginx
   location /agency/media/  { proxy_pass http://127.0.0.1:8090/media/; }
   location = /agency/review { proxy_pass http://127.0.0.1:8090/review; proxy_set_header Host $host; }
   location /agency/review/ { proxy_pass http://127.0.0.1:8090/review/; proxy_set_header Host $host; }
   ```
   `Host` must be forwarded: review POSTs are refused unless their Origin matches it
   (CSRF guard — browsers resend Basic credentials cross-site). The `/v1` API stays internal (n8n reaches it over the docker network).
   `nginx -t && systemctl reload nginx`. Verify a media URL from outside the box.
5. n8n: create credential **TSE Agency API** (Header Auth, name `Authorization`, value
   `Bearer <AGENCY_API_TOKEN>`); in each workflow file replace
   `REPLACE_AGENCY_CREDENTIAL_ID` with its id, then import:
   `docker exec n8n n8n import:workflow --separate --input=/tmp/agency-wf`.
   Import first `0-alert` (the others name it as error workflow). Activate, restart n8n,
   verify against the database flag (see `automation/n8n/README.md` gotchas).
6. Watch one dry-run week before any switch is flipped.

Memory: n8n uses ~450 MB; the compose limits the agency to 192 MB (Postgres) + 256 MB
(service). That fits, tightly. If the box swaps, resize to 2 GB before going live.

## Running the tests

```sh
docker run -d --name agency-test-pg -e POSTGRES_USER=agency -e POSTGRES_PASSWORD=agency \
  -e POSTGRES_DB=agency -p 127.0.0.1:55432:5432 postgres:16-alpine
.venv/bin/python -m pytest -q
```

## Recovery

- Every stage commits its state; an n8n execution that dies is resumed by the next tick.
  Leases expire after 20 minutes. `POST /v1/recover` (hourly) releases them.
- A generation job that was submitted is never resubmitted: the next tick polls the
  stored fal request.
- A publication interrupted mid-call is marked `unknown` and reconciled against the
  Page's / account's recent posts (and, for Instagram, the container status) before any
  retry. If Meta can't be asked, it stays `unknown` and alerts rather than risk a duplicate.
- Restore: the Postgres volume (`data/postgres`) and `data/media` are the whole state.
  Include both in the box's Vultr backup.
