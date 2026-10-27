"""Publishing: the next due slot to Facebook and Instagram, at most once.

Duplicate safety, in layers:
1. `publications` has UNIQUE (creative_id, platform): a second row cannot exist.
2. The slot row is locked FOR UPDATE SKIP LOCKED, plus a global advisory
   lock, so two overlapping n8n executions cannot both publish.
3. A publication is marked `in_progress` and committed *before* the Meta call.
   If the process dies mid-call the row is left `in_progress`/`unknown`, and the
   next run reconciles against Meta (recent posts / the IG container status)
   instead of posting again.
"""

from __future__ import annotations

import re
from datetime import timedelta

import httpx
from psycopg.types.json import Jsonb

from .factcheck import unverified_recently, verify
from .meta import GraphClient, MetaError
from .catalogue import CatalogueError, Product
from .llm import LLMError
from .pipeline import Ctx, render_creative, vision_review
from .render import RenderError
from .qc import QCResult, check_asset, stale_facts

STALE_IN_PROGRESS = timedelta(minutes=10)
SLOT_LEASE = timedelta(minutes=10)
RETRYABLE_PREFIX = "[retryable]"
RATE_LIMIT_CODES = {4, 17, 32, 341, 613, 80001, 80002}  # Meta refused before acting


def graph_client(ctx: Ctx) -> GraphClient | None:
    e = ctx.env
    if not (e.meta_page_id and e.meta_page_token):
        return None
    return GraphClient(base_url=e.meta_graph_base, version=e.meta_graph_version, page_id=e.meta_page_id,
                       ig_user_id=e.meta_ig_user_id, token=e.meta_page_token)


def effective_mode(ctx: Ctx, settings: dict) -> tuple[str, str | None]:
    """Returns (mode, reason). Live publishing needs three keys: the database
    mode, the deployment flag, and Meta credentials."""
    mode = settings["mode"]
    if mode == "dry_run":
        return "dry_run", None
    if not ctx.env.live_publishing_enabled:
        return "dry_run", f"mode={mode} but LIVE_PUBLISHING_ENABLED is off"
    if graph_client(ctx) is None:
        return "dry_run", f"mode={mode} but Meta credentials are missing"
    return mode, None


def publish_due(ctx: Ctx, graph: GraphClient | None = None) -> dict:
    settings = ctx.db.settings()
    if settings["publishing_paused"]:
        ctx.log("publish", "warn", "publishing is paused; nothing sent")
        return {"status": "paused"}
    mode, reason = effective_mode(ctx, settings)
    if reason:
        ctx.log("publish", "warn", reason)
    window = timedelta(hours=float(settings["publish_retry_window_hours"]))
    now = ctx.now()

    with ctx.db.tx() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('agency-publisher'))")
        # Slots whose window has passed without a creative are recorded as missed.
        missed = conn.execute(
            """UPDATE schedule SET status = CASE WHEN status = 'partial' THEN 'partial' ELSE 'skipped' END,
                      updated_at = now()
               WHERE status IN ('open', 'filled', 'publishing') AND slot_at < %s
               RETURNING slot_at, creative_id, status""", (now - window,)).fetchall()
        for m in missed:
            why = "no approved creative" if m["creative_id"] is None else (
                f"creative {m['creative_id']} was never published (unapproved in review mode, or failing)")
            ctx.log("publish", "alert", f"slot {m['slot_at']} lapsed: {why}", conn=conn)
        slot = conn.execute(
            """SELECT s.*, c.human_approval FROM schedule s JOIN creatives c ON c.id = s.creative_id
               WHERE s.status IN ('filled', 'publishing', 'partial') AND s.slot_at <= %s AND s.slot_at > %s
                 AND c.status = 'approved'
                 AND NOT (s.status IN ('publishing', 'filled', 'partial') AND s.updated_at > %s)  -- lease / retry backoff
               ORDER BY s.slot_at LIMIT 1 FOR UPDATE OF s SKIP LOCKED""",
            (now, now - window, now - SLOT_LEASE)).fetchone()
        if not slot:
            return {"status": "nothing_due", "skipped_slots": len(missed)}
        if slot["human_approval"] == "rejected":  # a reviewer's veto holds in every mode
            conn.execute("UPDATE schedule SET status = 'skipped', updated_at = now() WHERE slot_at = %s",
                         (slot["slot_at"],))
            ctx.log("publish", "warn", f"creative {slot['creative_id']} rejected by reviewer; slot skipped", conn=conn)
            return {"status": "rejected_by_reviewer", "creative_id": slot["creative_id"]}
        if mode == "review" and slot["human_approval"] != "approved":
            ctx.log("publish", "warn", f"creative {slot['creative_id']} awaits human approval (review mode)", conn=conn)
            return {"status": "awaiting_approval", "creative_id": slot["creative_id"]}
        conn.execute("UPDATE schedule SET status = 'publishing', updated_at = %s WHERE slot_at = %s",
                     (now, slot["slot_at"]))

    creative = ctx.db.one("SELECT * FROM creatives WHERE id = %s", (slot["creative_id"],))
    problems = refresh_spotlight(ctx, creative)
    creative = ctx.db.one("SELECT * FROM creatives WHERE id = %s", (slot["creative_id"],))
    if not problems:
        problems = preflight(ctx, creative)
    if problems and all(p.startswith(RETRYABLE_PREFIX) for p in problems):
        # The asset host blinked (nginx reload, network): keep the slot and its
        # lease; the next run inside the retry window tries again.
        ctx.db.execute("UPDATE schedule SET status = 'filled' WHERE slot_at = %s", (slot["slot_at"],))
        ctx.log("publish", "warn", f"creative {creative['id']} preflight will retry: {problems}")
        return {"status": "preflight_retry", "creative_id": creative["id"], "problems": problems}
    if problems:
        ctx.db.execute("UPDATE schedule SET status = 'failed', updated_at = now() WHERE slot_at = %s", (slot["slot_at"],))
        ctx.log("publish", "alert", f"creative {creative['id']} failed pre-publish checks; not published",
                {"problems": problems})
        return {"status": "preflight_failed", "creative_id": creative["id"], "problems": problems}

    if mode != "dry_run" and graph is None:
        graph = graph_client(ctx)
    results = {}
    for platform in settings["platforms"]:
        results[platform] = _publish_one(ctx, creative, platform, slot["slot_at"], mode, graph,
                                         int(settings["max_publish_attempts"]))

    done = [p for p, r in results.items() if r in ("published", "dry_run")]
    final = "done" if len(done) == len(results) else ("partial" if done else "publishing")
    open_rows = ctx.db.one(
        "SELECT count(*) AS n FROM publications WHERE creative_id = %s AND status IN ('pending', 'unknown', 'in_progress')",
        (creative["id"],))["n"]
    if final != "done" and open_rows == 0:
        final = "partial" if done else "failed"
    # A slot left 'publishing' keeps this run's lease timestamp: retries wait SLOT_LEASE.
    ctx.db.execute("UPDATE schedule SET status = %s, updated_at = %s WHERE slot_at = %s",
                   (final, ctx.now(), slot["slot_at"]))
    if final in ("partial", "failed"):
        ctx.log("publish", "alert", f"slot {slot['slot_at']} ended {final}: {results}", {"creative_id": creative["id"]})
    _maybe_pause(ctx, settings)
    return {"status": final, "creative_id": creative["id"], "mode": mode, "platforms": results}


def refresh_spotlight(ctx: Ctx, creative: dict) -> list[str]:
    """A spotlight shows a price in the image. Re-read it from the store now;
    if it changed, re-render the ad with the current price (same plate, same
    layout — type only) so nothing is ever posted with a stale price."""
    a = ctx.db.one("SELECT * FROM assignments WHERE id = %s", (creative["assignment_id"],))
    if not a or not a["product"]:
        return []
    stored = a["product"]
    if ctx.catalogue is None:
        return ["spotlight price cannot be checked: the store is not configured"]
    try:
        live = ctx.catalogue.get(stored["handle"])
    except CatalogueError as exc:
        return [f"{RETRYABLE_PREFIX} store unreachable, price unchecked: {exc}"]
    if live is None:
        return [f"product {stored['title']!r} is no longer in the store"]
    if live.title != stored["title"]:
        # Captions name the product; a rename needs new copy, not a re-render.
        return [f"product renamed in the store ({stored['title']!r} → {live.title!r}); creative needs new copy"]
    if round(live.price_zar * 100) == round(float(stored["price_zar"]) * 100):
        return []
    updated = {**stored, **live.as_dict(), "fetched_at": ctx.now().isoformat()}
    concept = ctx.db.one("SELECT * FROM concepts WHERE id = %s", (creative["concept_id"],))
    try:
        r = render_creative(ctx.storage.read(creative["raw_asset"]), {**a, "product": updated}, concept,
                            creative["art_brief"], creative["layout"])
    except RenderError as exc:
        return [f"re-render at the new price failed: {exc}"]
    qc = QCResult()
    check_asset(r.jpeg, None, r.meta(), qc)
    if not qc.passed:
        return [f"re-render at the new price failed QC: {[f.detail for f in qc.findings]}"]
    # The new image is a new ad: it gets its own vision review before anything else.
    candidate = {**creative, "final_asset": None}
    try:
        passed, _ = vision_review(ctx, {**a, "product": updated}, candidate, concept, r.jpeg, ctx.db.settings())
    except LLMError as exc:
        return [f"{RETRYABLE_PREFIX} vision QC unavailable for the re-priced ad: {exc}"]
    if not passed:
        return ["re-priced ad failed vision QC"]
    key, digest = ctx.storage.put(f"final/a{a['id']}-c{creative['id']}", r.jpeg, "jpg")
    with ctx.db.tx() as conn:
        conn.execute("UPDATE assignments SET product = %s WHERE id = %s", (Jsonb(updated), a["id"]))
        conn.execute("""UPDATE creatives SET final_asset = %s, final_sha256 = %s,
                            art_brief = art_brief || %s, updated_at = now() WHERE id = %s""",
                     (key, digest, Jsonb({"render": r.meta()}), creative["id"]))
        conn.execute("INSERT INTO qc_reviews (creative_id, kind, passed, findings) VALUES (%s, 'deterministic', true, %s)",
                     (creative["id"], Jsonb([{"check": "spotlight.price_refresh",
                                              "detail": f"{stored['price_zar']} -> {live.price_zar}"}])))
    old_label = Product(**{k: stored[k] for k in Product.__dataclass_fields__}).price_label
    ctx.log("publish", "warn", f"{live.title}: store price changed {old_label} → {live.price_label}; "
            f"creative {creative['id']} re-rendered and re-checked before publishing")
    if creative["human_approval"] == "approved" and ctx.db.setting("mode") == "review":
        # A reviewer approved the old image, not this one.
        ctx.db.execute("UPDATE creatives SET human_approval = NULL WHERE id = %s", (creative["id"],))
        ctx.log("publish", "alert", f"creative {creative['id']} re-priced; needs re-approval on /review")
        return [f"{RETRYABLE_PREFIX} re-priced ad awaits re-approval"]
    return []


def preflight(ctx: Ctx, creative: dict) -> list[str]:
    problems = []
    if not creative["final_asset"] or not ctx.storage.exists(creative["final_asset"]):
        return ["final asset missing from storage"]
    qc = QCResult()
    check_asset(ctx.storage.read(creative["final_asset"]), creative["final_sha256"],
                creative["art_brief"].get("render", {}), qc)
    problems += [f.detail for f in qc.findings]
    passed = ctx.db.query("SELECT kind FROM qc_reviews WHERE creative_id = %s AND passed", (creative["id"],))
    if {"deterministic", "vision"} - {r["kind"] for r in passed}:
        problems.append("creative lacks a passing deterministic and vision review")
    concept = ctx.db.one("SELECT claims FROM concepts WHERE id = %s", (creative["concept_id"],))
    cited = list(concept["claims"] or [])
    if cited:
        if unverified_recently(ctx.db, cited):
            verify(ctx.db, only=cited, fetch=ctx.fetch_page)
        bad = (set(cited) & stale_facts(ctx.db)) | unverified_recently(ctx.db, cited)
        if bad:
            problems.append(f"cited facts not verified on the live site in the last 24h: {sorted(bad)}")
    url = ctx.storage.url(creative["final_asset"])
    try:
        resp = httpx.head(url, timeout=20, follow_redirects=True)
        if resp.status_code != 200 or "image/jpeg" not in resp.headers.get("content-type", ""):
            problems.append(f"{RETRYABLE_PREFIX} public asset URL not serving a JPEG: {resp.status_code} {resp.headers.get('content-type')}")
    except httpx.HTTPError as exc:
        problems.append(f"{RETRYABLE_PREFIX} public asset URL unreachable: {exc}")
    return problems


def _caption(creative: dict, platform: str) -> str:
    return creative["caption_facebook"] if platform == "facebook" else creative["caption_instagram"]


def _publish_one(ctx: Ctx, creative: dict, platform: str, slot_at, mode: str, graph: GraphClient | None,
                 max_attempts: int) -> str:
    image_url = ctx.storage.url(creative["final_asset"])
    caption = _caption(creative, platform)
    pub_mode = "dry_run" if mode == "dry_run" else "live"
    with ctx.db.tx() as conn:
        conn.execute(
            """INSERT INTO publications (creative_id, platform, slot_at, mode, request)
               VALUES (%s, %s, %s, %s, %s) ON CONFLICT (creative_id, platform) DO NOTHING""",
            (creative["id"], platform, slot_at, pub_mode, Jsonb({"image_url": image_url, "caption": caption})))
        pub = conn.execute("SELECT * FROM publications WHERE creative_id = %s AND platform = %s FOR UPDATE",
                           (creative["id"], platform)).fetchone()
        if pub["status"] in ("published", "dry_run"):
            return pub["status"]
        if pub["status"] == "failed":
            return "failed"
        # A dry run completes its slot, so a creative is never re-published live
        # after one; the early return above covers that row.
        if pub_mode == "dry_run":
            conn.execute(
                """UPDATE publications SET status = 'dry_run', attempts = attempts + 1, run_id = %s, started_at = %s,
                       response = %s, updated_at = now() WHERE id = %s""",
                (ctx.run_id, ctx.now(), Jsonb({"would_post": {"platform": platform, "image_url": image_url, "caption": caption}}),
                 pub["id"]))
            ctx.log("publish", "info", f"DRY RUN {platform}: creative {creative['id']}", {"image_url": image_url}, conn=conn)
            return "dry_run"

    assert graph is not None
    # Anything previously started but not confirmed is reconciled, never blindly retried.
    if pub["status"] in ("in_progress", "unknown") or pub["container_id"]:
        started = pub["started_at"]
        if pub["status"] == "in_progress" and started and ctx.now() - started < STALE_IN_PROGRESS:
            return "in_progress"  # another run may still be inside the call
        try:
            found = _reconcile(ctx, graph, pub, caption)
        except MetaError:
            return "unknown"
        if found:
            return "published"
    if pub["attempts"] >= max_attempts:
        ctx.db.execute("UPDATE publications SET status = 'failed', updated_at = now() WHERE id = %s", (pub["id"],))
        return "failed"

    # Compare-and-set: only one run can move a publication into in_progress.
    with ctx.db.tx() as conn:
        won = conn.execute(
            """UPDATE publications SET status = 'in_progress', attempts = attempts + 1, run_id = %s, started_at = %s,
                   error = NULL, updated_at = now()
               WHERE id = %s AND status = %s AND attempts = %s RETURNING id""",
            (ctx.run_id, ctx.now(), pub["id"], pub["status"], pub["attempts"])).fetchone()
    if not won:
        return "in_progress"
    try:
        if platform == "facebook":
            body = graph.facebook_photo(image_url, caption)
            external = body.get("post_id") or body.get("id")
            permalink = _safe(lambda: graph.facebook_post(external).get("permalink_url"))
            _mark_published(ctx, pub["id"], external, permalink, body)
        else:
            container = pub["container_id"]
            status = graph.instagram_container_status(container) if container else None
            if status in (None, "ERROR", "EXPIRED"):
                container = graph.instagram_container(image_url, caption)
                ctx.db.execute("UPDATE publications SET container_id = %s WHERE id = %s", (container, pub["id"]))
            status = graph.wait_for_container(container)
            if status != "FINISHED":
                raise MetaError(f"instagram container {container} ended {status}", retryable=status == "IN_PROGRESS")
            media_id = graph.instagram_publish(container)
            permalink = _safe(lambda: graph.instagram_media(media_id).get("permalink"))
            _mark_published(ctx, pub["id"], media_id, permalink, {"container_id": container, "id": media_id})
        ctx.log("publish", "info", f"published {platform}: creative {creative['id']}", {"publication_id": pub["id"]})
        return "published"
    except MetaError as exc:
        # A write that may have landed (no reply, 5xx, unknown error) is 'unknown' and is
        # reconciled before any retry; only a rate-limit refusal is a clean 'pending'.
        maybe_created = "transport error" in str(exc) or (exc.retryable and exc.code not in RATE_LIMIT_CODES)
        status = "unknown" if maybe_created else ("pending" if exc.retryable else "failed")
        ctx.db.execute("UPDATE publications SET status = %s, error = %s, response = %s, updated_at = now() WHERE id = %s",
                       (status, str(exc)[:2000], Jsonb(exc.payload), pub["id"]))
        level = "alert" if (exc.auth or status == "failed") else "error"
        ctx.log("publish", level, f"{platform} publish failed for creative {creative['id']}: {exc}",
                {"publication_id": pub["id"], "status": status, "auth": exc.auth})
        return status


def _mark_published(ctx: Ctx, pub_id: int, external_id: str, permalink: str | None, body: dict) -> None:
    ctx.db.execute(
        """UPDATE publications SET status = 'published', external_id = %s, permalink = %s, response = %s,
               published_at = now(), updated_at = now() WHERE id = %s""",
        (external_id, permalink, Jsonb(body), pub_id))


def _safe(fn):
    try:
        return fn()
    except MetaError:
        return None


def _norm(text: str | None) -> str:
    return " ".join((text or "").split()).lower()


def _reconcile(ctx: Ctx, graph: GraphClient, pub: dict, caption: str) -> bool:
    """Did an earlier, unconfirmed attempt actually publish?"""
    try:
        if pub["platform"] == "instagram" and pub["container_id"]:
            if graph.instagram_container_status(pub["container_id"]) == "PUBLISHED":
                match = next((m for m in graph.instagram_recent() if (m.get("caption") or "").strip() == caption.strip()), None)
                _mark_published(ctx, pub["id"], match["id"] if match else f"container:{pub['container_id']}",
                                match.get("permalink") if match else None, {"reconciled": True})
                ctx.log("publish", "warn", f"reconciled instagram publication {pub['id']} as already published")
                return True
            return False
        recent = graph.facebook_recent(limit=50) if pub["platform"] == "facebook" else graph.instagram_recent(limit=50)
        key = "message" if pub["platform"] == "facebook" else "caption"
        # The tracking link is unique per creative and survives text normalisation;
        # the boundary stops c1 matching c12.
        marker = re.compile(rf"utm_content=c{pub['creative_id']}(?!\d)")
        match = next((p for p in recent if marker.search(p.get(key) or "")
                      or _norm(p.get(key)) == _norm(caption)), None)
        if match:
            _mark_published(ctx, pub["id"], match["id"], match.get("permalink_url") or match.get("permalink"),
                            {"reconciled": True})
            ctx.log("publish", "warn", f"reconciled {pub['platform']} publication {pub['id']} as already published")
            return True
    except MetaError as exc:
        # Can't tell. Refuse to post again rather than risk a duplicate.
        ctx.db.execute("UPDATE publications SET status = 'unknown', error = %s WHERE id = %s",
                       (f"reconcile failed: {exc}", pub["id"]))
        raise
    return False


def _maybe_pause(ctx: Ctx, settings: dict) -> None:
    n = int(settings["consecutive_failure_pause"])
    rows = ctx.db.query("SELECT status FROM publications WHERE mode = 'live' ORDER BY updated_at DESC LIMIT %s", (n,))
    if len(rows) == n and all(r["status"] == "failed" for r in rows):
        ctx.db.set_setting("publishing_paused", True, by="auto-pause")
        ctx.log("publish", "alert", f"{n} consecutive live publications failed; publishing auto-paused")
