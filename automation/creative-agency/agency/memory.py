"""Creative memory: what the agency has already said, shown, and learned.

Fed to the strategist, copywriter and director as context, and to QC as the
history the repetition checks run against.
"""

from __future__ import annotations

import json

from .db import Database


def recent_campaigns(db: Database, limit: int = 8) -> list[dict]:
    return db.query(
        "SELECT week_start, name, proposition, insight FROM campaigns ORDER BY week_start DESC LIMIT %s", (limit,))


def recent_work(db: Database, days: int = 120, exclude_assignment: int | None = None) -> list[dict]:
    """Selected concepts and their latest production, newest first."""
    return db.query(
        """SELECT c.id AS concept_id, c.assignment_id, c.headline, c.territory, c.visual, c.created_at,
                  a.pillar, cr.id AS creative_id, cr.image_prompt, cr.layout,
                  (SELECT p.status FROM publications p WHERE p.creative_id = cr.id ORDER BY p.id LIMIT 1) AS published
           FROM concepts c
           JOIN assignments a ON a.id = c.assignment_id
           LEFT JOIN LATERAL (SELECT * FROM creatives x WHERE x.concept_id = c.id
                              ORDER BY x.attempt DESC LIMIT 1) cr ON true
           WHERE c.status = 'selected' AND c.created_at > now() - make_interval(days => %s)
             AND (%s::bigint IS NULL OR c.assignment_id <> %s::bigint)
           ORDER BY c.created_at DESC""",
        (days, exclude_assignment, exclude_assignment),
    )


def territory_counts(db: Database, days: int = 56) -> list[dict]:
    return db.query(
        """SELECT lower(territory) AS territory, count(*) AS n, max(created_at)::date AS last_used
           FROM concepts WHERE status = 'selected' AND created_at > now() - make_interval(days => %s)
           GROUP BY 1 ORDER BY n DESC, last_used DESC""",
        (days,),
    )


def rejection_reasons(db: Database, days: int = 30, limit: int = 12) -> list[str]:
    rows = db.query(
        """SELECT rejection FROM concepts WHERE status = 'rejected' AND rejection IS NOT NULL
           AND created_at > now() - make_interval(days => %s) ORDER BY created_at DESC LIMIT %s""",
        (days, limit),
    )
    return [r["rejection"] for r in rows]


def latest_guidance(db: Database) -> str | None:
    row = db.one("SELECT summary FROM performance_reports ORDER BY week_start DESC LIMIT 1")
    if not row:
        return None
    s = row["summary"]
    return s.get("next_week_guidance") if isinstance(s, dict) else None


def search(db: Database, text: str, limit: int = 20) -> list[dict]:
    """Full-text search across every concept ever written, chosen or not."""
    return db.query(
        """SELECT id, assignment_id, status, headline, territory, left(idea, 160) AS idea, created_at::date AS day,
                  ts_rank(search, websearch_to_tsquery('english', %s)) AS rank
           FROM concepts WHERE search @@ websearch_to_tsquery('english', %s)
           ORDER BY rank DESC, created_at DESC LIMIT %s""",
        (text, text, limit),
    )


def brief_for_writers(db: Database, exclude_assignment: int | None = None) -> str:
    """The memory block shown to copywriter and director."""
    work = recent_work(db, days=120, exclude_assignment=exclude_assignment)[:40]
    lines = ["## Creative memory", "", "Recent headlines (newest first) — do not echo these:"]
    lines += [f"- [{w['created_at']:%Y-%m-%d}] ({w['territory']}) {w['headline']}" for w in work] or ["- none yet"]
    lines += ["", "Territories used in the last 8 weeks:"]
    lines += [f"- {t['territory']}: {t['n']}× (last {t['last_used']})" for t in territory_counts(db)] or ["- none yet"]
    reasons = rejection_reasons(db)
    if reasons:
        lines += ["", "Recent reasons concepts were rejected:"] + [f"- {r}" for r in reasons]
    return "\n".join(lines)


def brief_for_strategist(db: Database) -> str:
    camps = recent_campaigns(db)
    lines = ["## Previous campaigns"]
    lines += [f"- {c['week_start']}: {c['name']} — {c['proposition']}" for c in camps] or ["- none yet (first campaign)"]
    lines += ["", brief_for_writers(db)]
    guidance = latest_guidance(db)
    lines += ["", "## Latest performance guidance", guidance or "No performance data yet."]
    return "\n".join(lines)


def to_json(rows: list[dict]) -> str:
    return json.dumps(rows, default=str, indent=2)
