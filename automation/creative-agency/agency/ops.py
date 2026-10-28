"""Operations: health, recovery, alerts, metrics, the weekly report, and
human review actions."""

from __future__ import annotations

from datetime import date, timedelta

from psycopg.types.json import Jsonb

from .budget import month_spend
from .meta import MetaError
from .pipeline import LEASE, Ctx, week_monday
from .publisher import effective_mode, graph_client
from .schemas import PerformanceReport


def queue_status(ctx: Ctx) -> dict:
    settings = ctx.db.settings()
    now = ctx.now()
    horizon = now + timedelta(days=int(settings["queue_days"]))
    slots = ctx.db.query(
        """SELECT s.slot_at, s.status, c.status AS creative_status FROM schedule s
           LEFT JOIN creatives c ON c.id = s.creative_id
           WHERE s.slot_at > %s AND s.slot_at <= %s ORDER BY s.slot_at""", (now, horizon))
    expected = int(settings["queue_days"]) * len(settings["publish_times"])
    ready = sum(1 for s in slots if s["creative_status"] == "approved")
    # Days of consecutive coverage from now: the queue's real depth.
    covered = 0
    for s in slots:
        if s["creative_status"] != "approved":
            break
        covered += 1
    return {"expected_slots": expected, "approved_slots": ready, "consecutive_ready": covered,
            "days_covered": round(covered / max(1, len(settings["publish_times"])), 1)}


def health(ctx: Ctx) -> dict:
    settings = ctx.db.settings()
    mode, reason = effective_mode(ctx, settings)
    with ctx.db.tx() as conn:
        visual = float(month_spend(conn, "visual"))
        llm = float(month_spend(conn, "llm"))
    q = queue_status(ctx)
    pipeline = {r["status"]: r["n"] for r in ctx.db.query(
        "SELECT status, count(*) AS n FROM assignments WHERE slot_at > now() GROUP BY status")}
    errors_24h = ctx.db.one(
        "SELECT count(*) AS n FROM events WHERE level IN ('error', 'alert') AND created_at > now() - interval '24 hours'")["n"]
    problems = []
    if q["days_covered"] < 2:
        problems.append(f"queue covers only {q['days_covered']} days (target {settings['queue_days']})")
    if visual >= float(settings["visual_budget_monthly_usd"]) * 0.9:
        problems.append(f"visual budget {visual:.2f}/{settings['visual_budget_monthly_usd']} USD")
    if llm >= float(settings["llm_budget_monthly_usd"]) * 0.9:
        problems.append(f"Claude budget {llm:.2f}/{settings['llm_budget_monthly_usd']} USD")
    if pipeline.get("failed"):
        problems.append(f"{pipeline['failed']} upcoming assignments failed")
    if settings["publishing_paused"]:
        problems.append("publishing is paused")
    return {
        "ok": not problems, "problems": problems,
        "mode": settings["mode"], "effective_mode": mode, "mode_note": reason,
        "paused": settings["publishing_paused"], "platforms": settings["platforms"],
        "queue": q, "pipeline": pipeline, "errors_24h": errors_24h,
        "spend_month_usd": {"visual": round(visual, 3), "visual_limit": settings["visual_budget_monthly_usd"],
                            "claude": round(llm, 3), "claude_limit": settings["llm_budget_monthly_usd"]},
    }


def recover(ctx: Ctx) -> dict:
    """Release expired leases and surface work stuck in transient states."""
    with ctx.db.tx() as conn:
        leases = conn.execute(
            "UPDATE assignments SET locked_by = NULL, locked_at = NULL WHERE locked_at < %s RETURNING id",
            (ctx.now() - LEASE,)).fetchall()
        stuck_pubs = conn.execute(
            """UPDATE publications SET status = 'unknown', updated_at = now()
               WHERE status = 'in_progress' AND started_at < %s RETURNING id""",
            (ctx.now() - timedelta(minutes=10),)).fetchall()
        expired = conn.execute(
            """UPDATE assignments SET status = 'cancelled', updated_at = now()
               WHERE slot_at < %s AND status NOT IN ('approved', 'failed', 'cancelled') RETURNING id""",
            (ctx.now(),)).fetchall()
    if stuck_pubs:
        ctx.log("recover", "alert", f"{len(stuck_pubs)} publications interrupted mid-call; will reconcile with Meta",
                {"ids": [r["id"] for r in stuck_pubs]})
    return {"released_leases": len(leases), "unknown_publications": len(stuck_pubs),
            "cancelled_past_assignments": len(expired)}


def claim_alerts(ctx: Ctx, limit: int = 20, urgent_only: bool = False) -> list[dict]:
    """Alerts not yet sent anywhere, marked sent. `urgent_only` takes just the
    ones that can't wait for the daily digest (live publishing problems)."""
    urgent = "AND coalesce((data->>'urgent')::boolean, false)" if urgent_only else ""
    with ctx.db.tx() as conn:
        return conn.execute(
            f"""UPDATE events SET notified_at = now() WHERE id IN (
                   SELECT id FROM events WHERE level = 'alert' AND notified_at IS NULL {urgent} ORDER BY id LIMIT %s
                   FOR UPDATE SKIP LOCKED)
               RETURNING id, stage, message, data, created_at""", (limit,)).fetchall()


def alert_summary(rows: list[dict]) -> list[tuple[str, int]]:
    """Group alerts that differ only in numbers ("assignment 12 …", "assignment 31 …")."""
    import re
    counts: dict[str, int] = {}
    for r in rows:
        key = re.sub(r"\d[\d.:\- ]*\d|\d", "N", r["message"])[:140]
        counts[key] = counts.get(key, 0) + 1
    return sorted(counts.items(), key=lambda kv: -kv[1])


def digest(ctx: Ctx, dashboard_url: str | None = None) -> dict:
    """The one daily message: queue, spend, what happened, what needs a human."""
    h = health(ctx)
    alerts = claim_alerts(ctx, limit=500)
    day = ctx.db.one(
        """SELECT count(*) FILTER (WHERE status = 'approved' AND updated_at > now() - interval '24 hours') AS approved,
                  count(*) FILTER (WHERE status = 'rejected' AND updated_at > now() - interval '24 hours') AS rejected
           FROM creatives""")
    pubs = ctx.db.one("""SELECT count(*) FILTER (WHERE status = 'published') AS live,
                                count(*) FILTER (WHERE status = 'dry_run') AS dry
                         FROM publications WHERE updated_at > now() - interval '24 hours'""")
    report = ctx.db.one("SELECT week_start, summary FROM performance_reports WHERE created_at > now() - interval '24 hours'")
    q, spend = h["queue"], h["spend_month_usd"]
    lines = [
        f"{'🟢' if h['ok'] else '🟠'} **TSE agency — daily** · mode {h['effective_mode']}"
        + (" · **PAUSED**" if h["paused"] else ""),
        f"Queue: {q['days_covered']} days ready ({q['approved_slots']}/{q['expected_slots']} slots this week)",
        f"Last 24 h: {day['approved']} ads approved, {day['rejected']} rejected by QC"
        + (f", {pubs['live']} posted" if pubs["live"] else "") + (f", {pubs['dry']} dry-run slots" if pubs["dry"] else ""),
        f"Spend this month: images ${spend['visual']:.2f} / ${spend['visual_limit']:.0f} · Claude ${spend['claude']:.2f} / ${spend['claude_limit']:.0f}",
    ]
    if h["problems"]:
        lines.append("Needs a look: " + "; ".join(h["problems"]))
    if alerts:
        lines.append("Alerts:")
        lines += [f"• {msg}" + (f" (×{n})" if n > 1 else "") for msg, n in alert_summary(alerts)[:8]]
    if report:
        lines.append(f"📊 Weekly report ({report['week_start']}): {report['summary'].get('headline_summary', '')}")
    if dashboard_url:
        lines.append(dashboard_url)
    return {"text": "\n".join(lines)[:1900], "ok": h["ok"], "alerts": len(alerts)}


# -- performance ------------------------------------------------------------------

def _num(d: dict, *path, default=None):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return default
        d = d[p]
    return d


def _insight_value(insights: dict, name: str):
    for item in (insights or {}).get("data", []):
        if item.get("name") == name:
            vals = item.get("values") or []
            if vals:
                v = vals[0].get("value")
                return sum(v.values()) if isinstance(v, dict) else v
            return item.get("total_value", {}).get("value")
    return None


def collect_metrics(ctx: Ctx, days: int = 28) -> dict:
    graph = graph_client(ctx)
    if graph is None:
        return {"status": "no_credentials"}
    pubs = ctx.db.query(
        """SELECT * FROM publications WHERE status = 'published' AND mode = 'live'
           AND published_at > now() - make_interval(days => %s)""", (days,))
    ok = failed = 0
    for p in pubs:
        try:
            if p["platform"] == "facebook":
                raw = graph.facebook_metrics(p["external_id"])
                post, ins = raw.get("post", {}), raw.get("insights", {})
                row = {"reach": _insight_value(ins, "post_impressions_unique"),
                       "reactions": _num(post, "reactions", "summary", "total_count"),
                       "comments": _num(post, "comments", "summary", "total_count"),
                       "shares": _num(post, "shares", "count", default=0),
                       "link_clicks": None, "saves": None}
                clicks = _insight_value(ins, "post_clicks_by_type")
                row["link_clicks"] = clicks
            else:
                raw = graph.instagram_metrics(p["external_id"])
                ins = raw.get("insights", {})
                row = {"reach": _insight_value(ins, "reach"), "reactions": _insight_value(ins, "likes"),
                       "comments": _insight_value(ins, "comments"), "shares": _insight_value(ins, "shares"),
                       "saves": _insight_value(ins, "saved"), "link_clicks": None}
            engagements = sum(v for k, v in row.items() if k in ("reactions", "comments", "shares", "saves") and v)
            ctx.db.execute(
                """INSERT INTO post_metrics (publication_id, reach, engagements, reactions, comments, shares, saves,
                                             link_clicks, raw) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (p["id"], row["reach"], engagements, row["reactions"], row["comments"], row["shares"], row["saves"],
                 row["link_clicks"], Jsonb(raw)))
            ok += 1
        except MetaError as exc:
            failed += 1
            ctx.log("metrics", "warn", f"metrics for publication {p['id']} failed: {exc}")
    return {"status": "ok", "collected": ok, "failed": failed}


def weekly_report(ctx: Ctx, week_start: date | None = None) -> dict:
    week_start = week_start or (week_monday(ctx.now().date()) - timedelta(days=7))
    existing = ctx.db.one("SELECT summary FROM performance_reports WHERE week_start = %s", (week_start,))
    if existing:
        return {"week_start": str(week_start), "summary": existing["summary"], "created": False}
    rows = ctx.db.query(
        """SELECT p.platform, p.published_at, p.permalink, c.id AS creative_id, c.layout, k.headline, k.territory,
                  a.pillar, to_char(a.slot_at AT TIME ZONE 'Africa/Johannesburg', 'Dy HH24:MI') AS slot,
                  m.reach, m.engagements, m.reactions, m.comments, m.shares, m.saves, m.link_clicks
           FROM publications p JOIN creatives c ON c.id = p.creative_id JOIN concepts k ON k.id = c.concept_id
           JOIN assignments a ON a.id = c.assignment_id
           LEFT JOIN LATERAL (SELECT * FROM post_metrics x WHERE x.publication_id = p.id
                              ORDER BY fetched_at DESC LIMIT 1) m ON true
           WHERE p.status = 'published' AND p.mode = 'live'
             AND a.slot_at >= %s AND a.slot_at < %s""",
        (week_start, week_start + timedelta(days=7)))
    if not rows:
        return {"week_start": str(week_start), "status": "no_published_posts"}
    import json
    report = ctx.llm.run("analyst", PerformanceReport,
                         f"Week starting {week_start}. Published ads with latest metrics:\n"
                         f"{json.dumps(rows, default=str, indent=1)}", ref=f"report:{week_start}")
    ctx.db.execute("INSERT INTO performance_reports (week_start, summary) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                   (week_start, Jsonb(report.model_dump())))
    return {"week_start": str(week_start), "summary": report.model_dump(), "created": True}


# -- human review -------------------------------------------------------------------

def review(ctx: Ctx, creative_id: int, decision: str, note: str | None, by: str) -> dict:
    if decision not in ("approved", "rejected"):
        raise ValueError("decision must be approved or rejected")
    row = ctx.db.one("SELECT id, status FROM creatives WHERE id = %s", (creative_id,))
    if not row:
        raise LookupError(f"creative {creative_id} not found")
    ctx.db.execute("UPDATE creatives SET human_approval = %s, human_note = %s, updated_at = now() WHERE id = %s",
                   (decision, note, creative_id))
    ctx.db.execute("INSERT INTO qc_reviews (creative_id, kind, passed, findings) VALUES (%s, 'human', %s, %s)",
                   (creative_id, decision == "approved", Jsonb([{"by": by, "note": note}])))
    ctx.log("review", "info", f"creative {creative_id} {decision} by {by}", {"note": note})
    return {"creative_id": creative_id, "human_approval": decision}


def upcoming(ctx: Ctx, days: int = 14) -> list[dict]:
    return ctx.db.query(
        """SELECT s.slot_at, s.status AS slot_status, c.id AS creative_id, c.status, c.human_approval, c.final_asset,
                  c.caption_facebook, c.caption_instagram, c.layout, c.model, k.headline, k.support_line,
                  k.territory, a.pillar, a.angle,
                  (SELECT q.score FROM qc_reviews q WHERE q.creative_id = c.id AND q.kind = 'vision'
                   ORDER BY q.id DESC LIMIT 1) AS vision_score,
                  (SELECT json_agg(json_build_object('platform', p.platform, 'status', p.status, 'permalink', p.permalink))
                   FROM publications p WHERE p.creative_id = c.id) AS publications
           FROM schedule s LEFT JOIN creatives c ON c.id = s.creative_id
           LEFT JOIN concepts k ON k.id = c.concept_id LEFT JOIN assignments a ON a.id = c.assignment_id
           WHERE s.slot_at > now() - interval '2 days' AND s.slot_at < now() + make_interval(days => %s)
           ORDER BY s.slot_at""", (days,))
