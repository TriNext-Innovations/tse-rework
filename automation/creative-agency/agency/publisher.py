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
from .pipeline import Ctx
from .qc import QCResult, check_asset, stale_facts

STALE_IN_PROGRESS = timedelta(minutes=10)
SLOT_LEASE = timedelta(minutes=10)
RETRYABLE_PREFIX = "[retryable]"


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
            """UPDATE schedule SET status = 'skipped', updated_at = now()
               WHERE status = 'open' AND slot_at < %s RETURNING slot_at""", (now - window,)).fetchall()
        for m in missed:
            ctx.log("publish", "alert", f"slot {m['slot_at']} passed with no approved creative", conn=conn)
        slot = conn.execute(
            """SELECT s.*, c.human_approval FROM schedule s JOIN creatives c ON c.id = s.creative_id
               WHERE s.status IN ('filled', 'publishing', 'partial') AND s.slot_at <= %s AND s.slot_at > %s
                 AND c.status = 'approved'
                 AND NOT (s.status IN ('publishing', 'filled') AND s.updated_at > %s)  -- lease / retry backoff
               ORDER BY s.slot_at LIMIT 1 FOR UPDATE OF s SKIP LOCKED""",
            (now, now - window, now - SLOT_LEASE)).fetchone()
        if not slot:
            return {"status": "nothing_due", "skipped_slots": len(missed)}
        if mode == "review" and slot["human_approval"] != "approved":
            if slot["human_approval"] == "rejected":
                conn.execute("UPDATE schedule SET status = 'skipped', updated_at = now() WHERE slot_at = %s",
                             (slot["slot_at"],))
                ctx.log("publish", "warn", f"creative {slot['creative_id']} rejected by reviewer; slot skipped", conn=conn)
                return {"status": "rejected_by_reviewer", "creative_id": slot["creative_id"]}
            ctx.log("publish", "warn", f"creative {slot['creative_id']} awaits human approval (review mode)", conn=conn)
            return {"status": "awaiting_approval", "creative_id": slot["creative_id"]}
        conn.execute("UPDATE schedule SET status = 'publishing', updated_at = %s WHERE slot_at = %s",
                     (now, slot["slot_at"]))

    creative = ctx.db.one("SELECT * FROM creatives WHERE id = %s", (slot["creative_id"],))
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
    ctx.db.execute("UPDATE schedule SET status = %s WHERE slot_at = %s", (final, slot["slot_at"]))
    if final in ("partial", "failed"):
        ctx.log("publish", "alert", f"slot {slot['slot_at']} ended {final}: {results}", {"creative_id": creative["id"]})
    _maybe_pause(ctx, settings)
    return {"status": final, "creative_id": creative["id"], "mode": mode, "platforms": results}


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
        transport = "transport error" in str(exc)
        status = "unknown" if transport else ("pending" if exc.retryable else "failed")
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
