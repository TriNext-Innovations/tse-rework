"""The agency's stages as idempotent, resumable database transitions.

    plan ─▶ develop ─▶ produce ─▶ qc ─▶ (schedule) ─▶ publish
             ▲  copy fails ──────────┘│
             └──────── image fails ───┘ (back to produce)

Each tick claims one unit of work with a row lock and a lease, does it, and
commits. n8n calls the ticks on a schedule; a tick that dies leaves its lease
to expire and the next tick resumes from the last committed state.
"""

from __future__ import annotations

import json
import random
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from psycopg.types.json import Jsonb

from . import memory
from .budget import BudgetExceeded, release_visual, reserve_visual
from .catalogue import Catalogue, CatalogueError, Product, choose_products, spotlight_indexes
from .config import IMAGE_MODELS, SAST, Env
from .db import Database
from .imagegen import FalClient, GenerationError
from .llm import LLM, Image, LLMError
from .prompts import PROMPT_VERSION, usable_fact_ids
from .qc import QCResult, check_asset, check_copy, check_repetition, stale_facts
from .render import RenderError, render
from .schemas import ArtBrief, CampaignPlan, ConceptSet, DirectorReview, VisionReview
from .storage import Storage

LEASE = timedelta(minutes=20)
JOB_TIMEOUT = timedelta(minutes=30)
PILLAR_MIX = {"brand": 5, "product": 3, "educational": 3, "commercial": 3}


@dataclass
class Ctx:
    db: Database
    env: Env
    llm: LLM
    fal: FalClient | None
    storage: Storage
    now: Callable[[], datetime] = field(default=lambda: datetime.now(SAST))
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    poll_seconds: float = 120.0
    poll_interval: float = 4.0
    fetch_page: Callable[[str], str] | None = None  # fact re-verification transport (tests inject)
    catalogue: Catalogue | None = None  # live store; None disables product spotlights

    def log(self, stage: str, level: str, message: str, data: dict | None = None, conn=None) -> None:
        self.db.event(stage, level, message, data, run_id=self.run_id, conn=conn)


# =============================================================================
# Planning
# =============================================================================

def week_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def slot_times(week_start: date, publish_times: list[str]) -> list[datetime]:
    slots = []
    for day in range(7):
        for t in publish_times:
            hh, mm = (int(x) for x in t.split(":"))
            slots.append(datetime(week_start.year, week_start.month, week_start.day, hh, mm, tzinfo=SAST)
                         + timedelta(days=day))
    return sorted(slots)


def ensure_planned(ctx: Ctx, horizon_days: int = 8) -> list[dict]:
    """Plan every week that starts within the horizon and has no campaign,
    including the current week (future slots only)."""
    today = ctx.now().date()
    planned = []
    week = week_monday(today)
    while week <= today + timedelta(days=horizon_days):
        if not ctx.db.one("SELECT id FROM campaigns WHERE week_start = %s", (week,)):
            planned.append(plan_week(ctx, week))
        week += timedelta(days=7)
    return planned


def plan_week(ctx: Ctx, week_start: date) -> dict:
    existing = ctx.db.one("SELECT * FROM campaigns WHERE week_start = %s", (week_start,))
    if existing:
        return {"campaign_id": existing["id"], "week_start": str(week_start), "created": False}
    settings = ctx.db.settings()
    slots = [s for s in slot_times(week_start, settings["publish_times"]) if s > ctx.now() + timedelta(hours=2)]
    if not slots:
        return {"week_start": str(week_start), "created": False, "reason": "no future slots"}

    n = len(slot_times(week_start, settings["publish_times"]))
    spotlights = plan_spotlights(ctx, week_start, n, settings)
    user = (
        f"Plan the campaign for the week starting Monday {week_start:%d %B %Y}.\n"
        f"Publishing slots this week: {n} ({', '.join(settings['publish_times'])} SAST daily). "
        f"Plan exactly {n} assignments, slot_index 0..{n - 1}.\n\n"
        f"{_spotlight_brief(spotlights)}"
        f"{memory.brief_for_strategist(ctx.db)}"
    )
    plan: CampaignPlan | None = None
    problems: list[str] = []
    for _ in range(2):
        candidate = ctx.llm.run("strategist", CampaignPlan, user + (
            "\n\nYour previous plan was invalid: " + "; ".join(problems) if problems else ""), ref=f"plan:{week_start}")
        problems = validate_plan(candidate, n, set(spotlights))
        if not problems:
            plan = candidate
            break
    if plan is None:
        ctx.log("plan", "alert", f"strategist produced no valid plan for {week_start}", {"problems": problems})
        raise RuntimeError(f"invalid plan: {problems}")

    all_slots = slot_times(week_start, settings["publish_times"])
    with ctx.db.tx() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('agency-plan'))")
        if conn.execute("SELECT 1 FROM campaigns WHERE week_start = %s", (week_start,)).fetchone():
            return {"week_start": str(week_start), "created": False}
        camp = conn.execute(
            """INSERT INTO campaigns (week_start, name, proposition, insight, brief, prompt_version)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (week_start, plan.name, plan.proposition, plan.insight, Jsonb(plan.model_dump()), PROMPT_VERSION),
        ).fetchone()
        created = 0
        for a in sorted(plan.assignments, key=lambda x: x.slot_index):
            slot = all_slots[a.slot_index]
            if slot not in slots:
                if a.slot_index in spotlights:
                    ctx.log("plan", "info", f"spotlight slot {a.slot_index} already past; "
                            f"{spotlights[a.slot_index].display_title} not used", conn=conn)
                continue  # already in the past
            product = spotlights.get(a.slot_index)
            row = conn.execute(
                """INSERT INTO assignments (campaign_id, slot_at, pillar, angle, audience, product)
                   VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (slot_at) DO NOTHING RETURNING id""",
                (camp["id"], slot, a.pillar, a.angle + (f" [facts: {', '.join(a.fact_ids)}]" if a.fact_ids else ""),
                 a.audience, Jsonb({**product.as_dict(), "fetched_at": ctx.now().isoformat()}) if product else None),
            ).fetchone()
            conn.execute("INSERT INTO schedule (slot_at) VALUES (%s) ON CONFLICT DO NOTHING", (slot,))
            created += bool(row)
        ctx.log("plan", "info", f"planned {plan.name!r} for {week_start}: {created} assignments",
                {"campaign_id": camp["id"]}, conn=conn)
    return {"campaign_id": camp["id"], "week_start": str(week_start), "created": True, "assignments": created,
            "name": plan.name, "proposition": plan.proposition,
            "spotlights": [f"{p.display_title} ({p.price_label})" for _, p in sorted(spotlights.items())]}


def plan_spotlights(ctx: Ctx, week_start: date, n: int, settings: dict) -> dict[int, Product]:
    """Choose which slots promote a real product, and which product.

    One spotlight every `spotlight_gap_min`..`spotlight_gap_max` posts at
    random, continuing last week's rhythm. Seeded by the week, so a retried
    plan picks the same slots. No catalogue (or an unreachable store) means
    no spotlights this week — planning never blocks on the store."""
    if ctx.catalogue is None:
        return {}
    gap_min, gap_max = int(settings["spotlight_gap_min"]), int(settings["spotlight_gap_max"])
    week_dt = datetime(week_start.year, week_start.month, week_start.day, tzinfo=SAST)
    last = ctx.db.one("SELECT max(slot_at) AS at FROM assignments WHERE product IS NOT NULL AND slot_at < %s", (week_dt,))
    if last and last["at"]:
        since = ctx.db.one("SELECT count(*) AS n FROM assignments WHERE slot_at > %s AND slot_at < %s",
                           (last["at"], week_dt))["n"]
    else:
        since = gap_min - 1  # first ever: a spotlight lands early in the week
    rng = random.Random(f"spotlights:{week_start.isoformat()}")
    indexes = spotlight_indexes(n, since, rng, gap_min, gap_max)
    if not indexes:
        return {}
    recent = ctx.db.query(
        """SELECT product->>'handle' AS handle, product->>'brand' AS brand FROM assignments
           WHERE product IS NOT NULL AND slot_at > %s ORDER BY slot_at""", (week_dt - timedelta(days=56),))
    try:
        candidates = ctx.catalogue.all()
    except CatalogueError as exc:
        ctx.log("plan", "warn", f"store unreachable; no product spotlights this week: {exc}")
        return {}
    products = choose_products(candidates, len(indexes), {r["handle"] for r in recent}, rng,
                               [r["brand"] for r in recent])
    return dict(zip(indexes, products))


def _spotlight_brief(spotlights: dict[int, Product]) -> str:
    if not spotlights:
        return ""
    lines = ["## Product spotlights (fixed — plan these slots around them)",
             "These slots promote one real product from the store. Give each pillar `product` and an angle about "
             "that product and who buys it. Use pillar `product` for no other slot.", ""]
    lines += [f"- slot_index {i}: {p.display_title} — {p.eyebrow.lower()} ({p.brand}), {p.price_label}"
              for i, p in sorted(spotlights.items())]
    return "\n".join(lines) + "\n\n"


def validate_plan(plan: CampaignPlan, n: int, spotlight_slots: set[int] | None = None) -> list[str]:
    problems = []
    idx = sorted(a.slot_index for a in plan.assignments)
    if idx != list(range(n)):
        problems.append(f"slot_index must be exactly 0..{n - 1}, got {idx}")
    counts: dict[str, int] = {}
    for a in plan.assignments:
        counts[a.pillar] = counts.get(a.pillar, 0) + 1
        bad = set(a.fact_ids) - usable_fact_ids()
        if bad:
            problems.append(f"slot {a.slot_index} cites unknown/restricted facts {sorted(bad)}")
    if spotlight_slots:
        product_slots = {a.slot_index for a in plan.assignments if a.pillar == "product"}
        if product_slots != spotlight_slots:
            problems.append(f"pillar 'product' must be used exactly at slots {sorted(spotlight_slots)}, "
                            f"got {sorted(product_slots)}")
        if n == 14 and (counts.get("brand", 0) < 4 or counts.get("educational", 0) < 2
                        or counts.get("commercial", 0) < 2):
            problems.append(f"need at least 4 brand, 2 educational, 2 commercial; got {counts}")
    elif n == 14 and counts != PILLAR_MIX:
        problems.append(f"pillar mix must be {PILLAR_MIX}, got {counts}")
    return problems


# =============================================================================
# Claiming work
# =============================================================================

def claim(ctx: Ctx, statuses: tuple[str, ...], extra_sql: str = "") -> dict | None:
    """Lease the earliest-due assignment in one of `statuses`."""
    with ctx.db.tx() as conn:
        row = conn.execute(
            f"""SELECT * FROM assignments
                WHERE status = ANY(%s) AND slot_at > %s
                  AND (locked_at IS NULL OR locked_at < %s) {extra_sql}
                ORDER BY slot_at LIMIT 1 FOR UPDATE SKIP LOCKED""",
            (list(statuses), ctx.now(), ctx.now() - LEASE),
        ).fetchone()
        if not row:
            return None
        conn.execute("UPDATE assignments SET locked_by = %s, locked_at = %s WHERE id = %s",
                     (ctx.run_id, ctx.now(), row["id"]))
        return row


def release(ctx: Ctx, assignment_id: int, status: str | None = None, error: str | None = None,
            attempts_inc: int = 0) -> None:
    ctx.db.execute(
        """UPDATE assignments SET locked_by = NULL, locked_at = NULL,
               status = coalesce(%s, status), last_error = %s, attempts = attempts + %s, updated_at = now()
           WHERE id = %s AND locked_by = %s""",
        (status, error, attempts_inc, assignment_id, ctx.run_id),
    )


# =============================================================================
# Creative development: copywriter → creative director → copy QC
# =============================================================================

def develop(ctx: Ctx) -> dict:
    a = claim(ctx, ("new", "developing"))
    if not a:
        return {"status": "idle"}
    settings = ctx.db.settings()
    try:
        if a["attempts"] >= settings["max_concept_rounds"]:
            ctx.log("develop", "alert", f"assignment {a['id']} exhausted {a['attempts']} concept rounds",
                    {"assignment_id": a["id"]})
            release(ctx, a["id"], "failed", "concept rounds exhausted")
            return {"status": "failed", "assignment_id": a["id"]}
        result = _develop_round(ctx, a, settings)
        return result
    except (LLMError, BudgetExceeded) as exc:
        ctx.log("develop", "error", f"assignment {a['id']}: {exc}", {"assignment_id": a["id"]})
        release(ctx, a["id"], "developing", str(exc))
        return {"status": "error", "assignment_id": a["id"], "error": str(exc)}
    except Exception as exc:
        release(ctx, a["id"], None, f"unexpected: {exc}")
        raise


def _assignment_context(ctx: Ctx, a: dict) -> str:
    camp = ctx.db.one("SELECT * FROM campaigns WHERE id = %s", (a["campaign_id"],))
    avoid = camp["brief"].get("territories_to_avoid", [])
    return (
        f"## Campaign\n{camp['name']}\nProposition: {camp['proposition']}\nInsight: {camp['insight']}\n"
        f"Territories to avoid: {', '.join(avoid) or 'none'}\n\n"
        f"## Assignment\nPillar: {a['pillar']}\nAngle: {a['angle']}\nAudience: {a['audience']}\n"
        f"Publishes: {a['slot_at'].astimezone(SAST):%A %d %B, %H:%M} SAST\n"
        + (_product_context(a["product"]) if a.get("product") else "")
    )


def _product_context(p: dict) -> str:
    product = _as_product(p)
    return (
        "\n## PRODUCT SPOTLIGHT — this ad sells one real product\n"
        f"Product: {product.display_title} (SKU {product.sku}), {product.eyebrow.lower()}, brand {product.brand}.\n"
        f"Price today: {product.price_label} incl. VAT. Page: /products/{product.handle}\n"
        "The renderer sets the product name, the line "
        f"'{product.eyebrow}' and the price large in the image, from live store data. You write:\n"
        f"- `headline`: exactly '{product.headline}' (it is replaced by the store title anyway)\n"
        "- `support_line`: one short line (≤ 10 words) giving the reason to buy — the idea of the ad\n"
        "- captions that name the product and send people to the product page. NEVER write the price "
        "or any rand amount in the captions or support line: the price lives only in the image so it "
        "can be updated if the store changes it. Don't list compatible printer models — they are not in "
        "your brief; say the page shows which printers it fits.\n"
        "- `visual`: a product-free still life that suits this product (no cartridges, no boxes, no "
        "printers with logos) — the type is the hero.\n"
    )


def _as_product(p: dict) -> Product:
    return Product(**{k: p[k] for k in ("handle", "title", "sku", "brand", "cartridge_type", "compatible", "price_zar")})


def _develop_round(ctx: Ctx, a: dict, settings: dict) -> dict:
    round_no = a["attempts"] + 1
    direction = ""
    if a["attempts"] > 0:
        prior = ctx.db.query(
            "SELECT headline, rejection FROM concepts WHERE assignment_id = %s AND status = 'rejected' ORDER BY id DESC LIMIT 6",
            (a["id"],))
        last_review = ctx.db.one(
            "SELECT review FROM concepts WHERE assignment_id = %s AND review IS NOT NULL ORDER BY id DESC LIMIT 1", (a["id"],))
        direction = "\n## Previous round was sent back\n" + "\n".join(
            f"- {p['headline']!r}: {p['rejection']}" for p in prior)
        if last_review and last_review["review"].get("revision_direction"):
            direction += f"\nCreative director's direction: {last_review['review']['revision_direction']}"

    mem = memory.brief_for_writers(ctx.db, exclude_assignment=a["id"])
    brief = _assignment_context(ctx, a)
    n_concepts = int(settings["concepts_per_round"])
    concepts = ctx.llm.run("copywriter", ConceptSet,
                           f"{brief}\n{mem}\n{direction}\n\nWrite {n_concepts} genuinely different concepts.",
                           ref=f"assignment:{a['id']}:copy:{round_no}").concepts
    if not concepts:
        raise LLMError("copywriter returned no concepts")

    ids = []
    with ctx.db.tx() as conn:
        for c in concepts:
            row = conn.execute(
                """INSERT INTO concepts (assignment_id, round, idea, insight, headline, support_line, visual,
                                         territory, claims, data, prompt_version)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (a["id"], round_no, c.idea, c.insight, c.headline.strip(), c.support_line.strip(), c.visual,
                 c.territory.strip().lower(), Jsonb(c.claims), Jsonb(c.model_dump()), PROMPT_VERSION),
            ).fetchone()
            ids.append(row["id"])

    listing = "\n\n".join(
        f"### Concept {i}\n{json.dumps(c.model_dump(), indent=1)}" for i, c in enumerate(concepts))
    review = ctx.llm.run("director", DirectorReview,
                         f"{brief}\n{mem}\n\n## Concepts to judge\n{listing}",
                         ref=f"assignment:{a['id']}:director:{round_no}")

    scores = {s.concept_index: s for s in review.scores}
    ranked = sorted(
        (i for i, s in scores.items() if s.verdict == "approve" and 0 <= i < len(concepts)),
        key=lambda i: (i != review.selected_index, -_total(scores[i])),
    )
    history = memory.recent_work(ctx.db, days=120, exclude_assignment=a["id"])
    stale = stale_facts(ctx.db)
    chosen = None
    with ctx.db.tx() as conn:
        for i, cid in enumerate(ids):
            s = scores.get(i)
            conn.execute("UPDATE concepts SET review = %s WHERE id = %s",
                         (Jsonb({**(s.model_dump() if s else {}), "revision_direction": review.revision_direction,
                                 "selection_reason": review.selection_reason}), cid))
        if review.selected_index >= 0:
            for i in ranked:
                c = concepts[i]
                headline = (review.headline_edit.strip() if i == review.selected_index and review.headline_edit.strip()
                            else c.headline.strip())
                if a.get("product"):
                    headline = _as_product(a["product"]).headline  # store data, never the model's wording
                qc = QCResult()
                check_copy({"headline": headline, "support_line": c.support_line, "claims": c.claims},
                           c.caption_facebook.replace("{link}", ""), c.caption_instagram, c.hashtags, qc, stale,
                           product=a.get("product"))
                if not a.get("product"):  # a product's own name is not a repeated idea
                    check_repetition(headline, "", history, qc)
                if qc.passed:
                    chosen = i
                    conn.execute("UPDATE concepts SET status = 'selected', headline = %s WHERE id = %s",
                                 (headline, ids[i]))
                    break
                conn.execute("UPDATE concepts SET status = 'rejected', rejection = %s WHERE id = %s",
                             ("copy QC: " + "; ".join(f.detail for f in qc.findings), ids[i]))
        for i, cid in enumerate(ids):
            if i == chosen:
                continue
            s = scores.get(i)
            conn.execute(
                "UPDATE concepts SET status = 'rejected', rejection = coalesce(rejection, %s) WHERE id = %s AND status = 'candidate'",
                (("director: " + s.notes) if s else "not reviewed", cid))

    if chosen is None:
        ctx.log("develop", "info", f"assignment {a['id']} round {round_no}: nothing approved",
                {"direction": review.revision_direction})
        release(ctx, a["id"], "developing", "no concept approved", attempts_inc=1)
        return {"status": "revising", "assignment_id": a["id"], "round": round_no}
    release(ctx, a["id"], "concept_ready", None, attempts_inc=1)
    ctx.log("develop", "info", f"assignment {a['id']}: selected {concepts[chosen].headline!r}",
            {"concept_id": ids[chosen]})
    return {"status": "concept_ready", "assignment_id": a["id"], "concept_id": ids[chosen],
            "headline": concepts[chosen].headline}


def _total(s) -> int:
    return (s.originality + s.insight + s.memorability + s.relevance + s.visual_potential
            + s.commercial_usefulness + s.craft)


# =============================================================================
# Production: art direction → generation (async) → render
# =============================================================================

def utm_link(ctx: Ctx, campaign_week: date, creative_id: int, platform: str = "facebook",
             product: dict | None = None) -> str:
    prefix = ctx.db.setting("utm_campaign_prefix")
    path = f"/products/{product['handle']}" if product else "/"
    return (f"{ctx.env.site_url}{path}?utm_source={platform}&utm_medium=social"
            f"&utm_campaign={prefix}-{campaign_week:%Y-%m-%d}&utm_content=c{creative_id}")


def produce(ctx: Ctx) -> dict:
    """Art-direct and submit generation for the next assignment that needs it."""
    a = claim(ctx, ("concept_ready", "in_production"),
              """AND NOT EXISTS (SELECT 1 FROM creatives c WHERE c.assignment_id = assignments.id
                                 AND c.status IN ('rendered', 'generating', 'generated'))""")
    if not a:
        return {"status": "idle"}
    try:
        return _produce(ctx, a)
    except Exception as exc:
        release(ctx, a["id"], None, f"unexpected: {exc}")
        raise


def collect(ctx: Ctx) -> dict:
    """Collect a finished generation job and render it."""
    a = claim(ctx, ("in_production",),
              """AND EXISTS (SELECT 1 FROM creatives c WHERE c.assignment_id = assignments.id
                             AND c.status IN ('generating', 'generated'))""")
    if not a:
        return {"status": "idle"}
    try:
        cr = ctx.db.one("""SELECT * FROM creatives WHERE assignment_id = %s AND status IN ('generating', 'generated')
                           ORDER BY attempt DESC LIMIT 1""", (a["id"],))
        if cr["status"] == "generating":
            outcome = _collect(ctx, a, cr)
            if outcome != "generated":
                release(ctx, a["id"], "in_production", None if outcome == "waiting" else outcome)
                return {"status": outcome, "creative_id": cr["id"]}
            cr = ctx.db.one("SELECT * FROM creatives WHERE id = %s", (cr["id"],))
        return _render(ctx, a, cr)
    except Exception as exc:
        release(ctx, a["id"], None, f"unexpected: {exc}")
        raise


def _active_creative(ctx: Ctx, assignment_id: int) -> dict | None:
    return ctx.db.one(
        """SELECT * FROM creatives WHERE assignment_id = %s AND status IN ('art_directed', 'budget_blocked')
           ORDER BY attempt DESC LIMIT 1""", (assignment_id,))


def _produce(ctx: Ctx, a: dict) -> dict:
    settings = ctx.db.settings()
    cr = _active_creative(ctx, a["id"])
    if cr is None:
        attempts = ctx.db.one("SELECT coalesce(max(attempt), 0) AS n FROM creatives WHERE assignment_id = %s", (a["id"],))["n"]
        if attempts >= settings["max_production_attempts"]:
            ctx.log("produce", "alert", f"assignment {a['id']} exhausted {attempts} production attempts",
                    {"assignment_id": a["id"]})
            release(ctx, a["id"], "failed", "production attempts exhausted")
            return {"status": "failed", "assignment_id": a["id"]}
        try:
            cr = _art_direct(ctx, a, attempts + 1)
        except LLMError as exc:
            release(ctx, a["id"], "concept_ready", str(exc))
            return {"status": "error", "error": str(exc)}
    outcome = _submit(ctx, a, cr, settings)
    if outcome == "post_budget_spent":
        ctx.log("produce", "alert", f"assignment {a['id']} spent its per-ad image budget without an approved ad",
                {"assignment_id": a["id"]})
        release(ctx, a["id"], "failed", "per-ad image budget spent")
        return {"status": "failed", "assignment_id": a["id"]}
    release(ctx, a["id"], "in_production", None if outcome == "submitted" else outcome)
    return {"status": outcome, "creative_id": cr["id"]}


def _art_direct(ctx: Ctx, a: dict, attempt: int) -> dict:
    concept = ctx.db.one("SELECT * FROM concepts WHERE assignment_id = %s AND status = 'selected' ORDER BY id DESC LIMIT 1",
                         (a["id"],))
    if not concept:
        raise LLMError("no selected concept")
    feedback = ""
    prior = ctx.db.query(
        """SELECT cr.attempt, cr.image_prompt, q.findings FROM creatives cr
           JOIN qc_reviews q ON q.creative_id = cr.id AND NOT q.passed
           WHERE cr.assignment_id = %s ORDER BY cr.attempt""", (a["id"],))
    if prior:
        feedback = "\n## Earlier attempts were rejected by QC — fix these\n" + "\n".join(
            f"- attempt {p['attempt']}: {json.dumps(p['findings'])[:800]}" for p in prior)
    history = memory.recent_work(ctx.db, days=60, exclude_assignment=a["id"])[:15]
    recent_prompts = "\n".join(f"- {h['image_prompt'][:200]}" for h in history if h.get("image_prompt"))
    models = "\n".join(f"- {k}: {v['label']} (≈${v['est_cost_usd']}/image)" for k, v in IMAGE_MODELS.items())
    data = concept["data"]
    brief = ctx.llm.run("art_director", ArtBrief, (
        f"{_assignment_context(ctx, a)}\n## Approved concept\nHeadline: {concept['headline']}\n"
        f"Support line: {concept['support_line']}\nIdea: {concept['idea']}\nVisual: {concept['visual']}\n\n"
        f"## Available image models\n{models}\n\n## Recent image prompts — do not repeat these compositions\n"
        f"{recent_prompts or '- none yet'}\n{feedback}"), ref=f"assignment:{a['id']}:art:{attempt}")
    if brief.model not in IMAGE_MODELS:
        brief.model = ctx.db.setting("image_model")
    if a.get("product"):
        brief.layout = "spotlight"  # the product name and price are the hero
    prompt = brief.prompt.strip()
    if a.get("product") and "no cartridges" not in prompt.lower():
        prompt += " No cartridges, toner, ink bottles, packaging, boxes or printers in the frame."
    if "no text" not in prompt.lower():
        prompt += " No text, letters, numbers, labels, logos or watermarks anywhere in the image."
    hashtags = " ".join(h if h.startswith("#") else f"#{h}" for h in data.get("hashtags", [])[:2])
    with ctx.db.tx() as conn:
        camp_week = conn.execute("SELECT week_start FROM campaigns WHERE id = %s", (a["campaign_id"],)).fetchone()["week_start"]
        row = conn.execute(
            """INSERT INTO creatives (assignment_id, concept_id, attempt, art_brief, image_prompt, model, layout,
                                      caption_facebook, caption_instagram)
               VALUES (%s, %s, %s, %s, %s, %s, %s, '', '') RETURNING id""",
            (a["id"], concept["id"], attempt, Jsonb(brief.model_dump()), prompt, brief.model, brief.layout),
        ).fetchone()
        link = utm_link(ctx, camp_week, row["id"], product=a.get("product"))
        fb = data["caption_facebook"]
        fb = fb.replace("{link}", link) if "{link}" in fb else f"{fb.rstrip()}\n\n{link}"
        ig = data["caption_instagram"].rstrip() + (f"\n\n{hashtags}" if hashtags else "")
        conn.execute("UPDATE creatives SET caption_facebook = %s, caption_instagram = %s, link_url = %s WHERE id = %s",
                     (fb, ig, link, row["id"]))
        conn.execute("UPDATE assignments SET status = 'in_production' WHERE id = %s", (a["id"],))
        return conn.execute("SELECT * FROM creatives WHERE id = %s", (row["id"],)).fetchone()


def _submit(ctx: Ctx, a: dict, cr: dict, settings: dict) -> str:
    model = cr["model"]
    spec = IMAGE_MODELS[model]
    est = float(spec["est_cost_usd"])
    payload = spec["input"](cr["image_prompt"], None)  # type: ignore[operator]
    job = ctx.db.one("SELECT * FROM generation_jobs WHERE creative_id = %s AND status = 'reserved' ORDER BY id DESC LIMIT 1",
                     (cr["id"],))
    if job is None and ctx.fal is None:
        # Reserve nothing until there is a provider to spend it on.
        ctx.log("produce", "error", "FAL_KEY not configured; cannot generate", {"creative_id": cr["id"]})
        return "no_provider"
    if job is None:
        try:
            with ctx.db.tx() as conn:
                job = conn.execute(
                    """INSERT INTO generation_jobs (creative_id, provider, model, est_cost_usd, input)
                       VALUES (%s, 'fal', %s, %s, %s) RETURNING *""",
                    (cr["id"], model, est, Jsonb(payload))).fetchone()
                reserve_visual(conn, settings=settings, assignment_id=a["id"], job_ref=f"job:{job['id']}",
                               provider="fal", model=model, amount=est)
        except BudgetExceeded as exc:
            if exc.scope == "post":
                # This ad has spent its image allowance: more ticks can't change that.
                ctx.db.execute("UPDATE creatives SET status = 'failed', last_error = %s, updated_at = now() WHERE id = %s",
                               (str(exc), cr["id"]))
                return "post_budget_spent"
            ctx.db.execute("UPDATE creatives SET status = 'budget_blocked', last_error = %s, updated_at = now() WHERE id = %s",
                           (str(exc), cr["id"]))
            # Retried every tick until the month turns: say so once a day, not every tick.
            if not ctx.db.one("""SELECT 1 AS x FROM events WHERE level = 'alert' AND message LIKE 'monthly visual budget%%'
                                 AND created_at > now() - interval '24 hours'"""):
                ctx.log("produce", "alert", f"monthly visual budget: {exc}; image generation paused until next month")
            return "budget_blocked"
    if ctx.fal is None:
        ctx.log("produce", "error", "FAL_KEY not configured; cannot generate", {"creative_id": cr["id"]})
        return "no_provider"
    try:
        sub = ctx.fal.submit(model, payload)
    except GenerationError as exc:
        if exc.retryable:
            ctx.log("produce", "warn", f"fal submit retryable failure: {exc}", {"job_id": job["id"]})
            return "provider_retry"
        with ctx.db.tx() as conn:
            conn.execute("UPDATE generation_jobs SET status = 'failed', error = %s, completed_at = now() WHERE id = %s",
                         (str(exc), job["id"]))
            release_visual(conn, assignment_id=a["id"], job_ref=f"job:{job['id']}", provider="fal", model=model,
                           amount=est, reason="submit rejected")
            conn.execute("UPDATE creatives SET status = 'failed', last_error = %s WHERE id = %s", (str(exc), cr["id"]))
        ctx.log("produce", "error", f"fal rejected job {job['id']}: {exc}", {"creative_id": cr["id"]})
        return "generation_failed"
    with ctx.db.tx() as conn:
        conn.execute(
            "UPDATE generation_jobs SET status = 'submitted', request_id = %s, output = %s WHERE id = %s",
            (sub["request_id"], Jsonb({"status_url": sub["status_url"], "response_url": sub["response_url"]}), job["id"]))
        conn.execute("UPDATE creatives SET status = 'generating', last_error = NULL, updated_at = now() WHERE id = %s",
                     (cr["id"],))
    return "submitted"


def _collect(ctx: Ctx, a: dict, cr: dict) -> str:
    job = ctx.db.one("SELECT * FROM generation_jobs WHERE creative_id = %s AND status = 'submitted' ORDER BY id DESC LIMIT 1",
                     (cr["id"],))
    if job is None:
        ctx.db.execute("UPDATE creatives SET status = 'art_directed' WHERE id = %s", (cr["id"],))
        return "resubmit"
    if ctx.fal is None:
        return "no_provider"
    urls = job["output"]
    deadline = time.monotonic() + ctx.poll_seconds
    status = "UNKNOWN"
    try:
        while True:
            status = ctx.fal.status(urls["status_url"])
            if status == "COMPLETED" or time.monotonic() >= deadline:
                break
            time.sleep(ctx.poll_interval)
    except GenerationError as exc:
        if not exc.retryable:
            return _fail_job(ctx, a, cr, job, str(exc))
        return "waiting"
    if status != "COMPLETED":
        # Provider timeouts are wall-clock, measured by the database.
        aged = ctx.db.one("SELECT now() - created_at > %s AS old FROM generation_jobs WHERE id = %s",
                          (JOB_TIMEOUT, job["id"]))["old"]
        if aged:
            return _fail_job(ctx, a, cr, job, f"timed out in state {status}")
        return "waiting"
    try:
        result = ctx.fal.result(urls["response_url"])
        image = ctx.fal.download(result["images"][0]["url"])
    except GenerationError as exc:
        if exc.retryable:
            return "waiting"
        return _fail_job(ctx, a, cr, job, str(exc))
    key, _ = ctx.storage.put(f"plates/a{a['id']}-c{cr['id']}", image, "png")
    with ctx.db.tx() as conn:
        conn.execute("UPDATE generation_jobs SET status = 'completed', completed_at = now(), output = output || %s WHERE id = %s",
                     (Jsonb({"result": result}), job["id"]))
        conn.execute("UPDATE creatives SET status = 'generated', raw_asset = %s, updated_at = now() WHERE id = %s",
                     (key, cr["id"]))
    return "generated"


def _fail_job(ctx: Ctx, a: dict, cr: dict, job: dict, error: str) -> str:
    with ctx.db.tx() as conn:
        conn.execute("UPDATE generation_jobs SET status = 'failed', error = %s, completed_at = now() WHERE id = %s",
                     (error, job["id"]))
        # fal does not bill failed requests; give the reservation back.
        release_visual(conn, assignment_id=a["id"], job_ref=f"job:{job['id']}", provider="fal", model=job["model"],
                       amount=float(job["est_cost_usd"]), reason=error[:200])
        conn.execute("UPDATE creatives SET status = 'failed', last_error = %s WHERE id = %s", (error, cr["id"]))
    ctx.log("produce", "error", f"generation job {job['id']} failed: {error}", {"creative_id": cr["id"]})
    return "generation_failed"


def render_creative(plate: bytes, a: dict, concept: dict, brief: dict, preferred: str):
    """Render one creative. Spotlights take name and price from the assignment's
    store data; other ads fall back to safer layouts if the type won't fit."""
    common = dict(support_line=concept["support_line"] or "", text_zone=brief.get("text_zone", "bottom"),
                  tone=brief.get("tone", "dark"), accent=brief.get("accent", "none"))
    if a.get("product"):
        p = _as_product(a["product"])
        return render(plate, layout="spotlight", headline=p.headline, eyebrow=p.eyebrow, price=p.price_label, **common)
    last: RenderError | None = None
    for layout in [preferred] + [x for x in ("editorial", "poster") if x != preferred]:
        try:
            return render(plate, layout=layout, headline=concept["headline"], **common)
        except RenderError as exc:
            last = exc
    raise last  # type: ignore[misc]


def _render(ctx: Ctx, a: dict, cr: dict) -> dict:
    concept = ctx.db.one("SELECT * FROM concepts WHERE id = %s", (cr["concept_id"],))
    brief = cr["art_brief"]
    plate = ctx.storage.read(cr["raw_asset"])
    try:
        r = render_creative(plate, a, concept, brief, cr["layout"])
    except RenderError as exc:
        last_error = str(exc)
        ctx.db.execute("UPDATE creatives SET status = 'rejected', last_error = %s WHERE id = %s", (last_error, cr["id"]))
        ctx.db.execute("UPDATE concepts SET status = 'rejected', rejection = %s WHERE id = %s",
                       (f"render: {last_error}", concept["id"]))
        release(ctx, a["id"], "developing", last_error)
        return {"status": "render_failed", "creative_id": cr["id"], "error": last_error}
    key, digest = ctx.storage.put(f"final/a{a['id']}-c{cr['id']}", r.jpeg, "jpg")
    ctx.db.execute(
        """UPDATE creatives SET status = 'rendered', final_asset = %s, final_sha256 = %s, width = %s, height = %s,
               layout = %s, art_brief = art_brief || %s, updated_at = now() WHERE id = %s""",
        (key, digest, r.width, r.height, r.layout, Jsonb({"render": r.meta()}), cr["id"]))
    release(ctx, a["id"], "produced")
    ctx.log("produce", "info", f"creative {cr['id']} rendered ({r.layout})", {"asset": key})
    return {"status": "rendered", "creative_id": cr["id"], "asset": key}


# =============================================================================
# Quality control
# =============================================================================

def quality_control(ctx: Ctx) -> dict:
    a = claim(ctx, ("produced",))
    if not a:
        return {"status": "idle"}
    try:
        return _qc(ctx, a)
    except Exception as exc:
        release(ctx, a["id"], None, f"unexpected: {exc}")
        raise


def _qc(ctx: Ctx, a: dict) -> dict:
    settings = ctx.db.settings()
    cr = ctx.db.one("SELECT * FROM creatives WHERE assignment_id = %s AND status = 'rendered' ORDER BY attempt DESC LIMIT 1",
                    (a["id"],))
    if not cr:
        release(ctx, a["id"], "concept_ready", "no rendered creative")
        return {"status": "noop"}
    concept = ctx.db.one("SELECT * FROM concepts WHERE id = %s", (cr["concept_id"],))
    jpeg = ctx.storage.read(cr["final_asset"])

    det = QCResult()
    check_copy({"headline": concept["headline"], "support_line": concept["support_line"], "claims": concept["claims"]},
               cr["caption_facebook"].replace(cr["link_url"] or "", ""), cr["caption_instagram"],
               concept["data"].get("hashtags", []), det, stale_facts(ctx.db), product=a.get("product"))
    # A product's name is not a repeated idea ("Brother TN 277." vs "TN 279."); compositions still are.
    check_repetition("" if a.get("product") else concept["headline"], cr["image_prompt"],
                     memory.recent_work(ctx.db, days=120, exclude_assignment=a["id"]), det)
    check_asset(jpeg, cr["final_sha256"], cr["art_brief"].get("render", {}), det)
    ctx.db.execute("INSERT INTO qc_reviews (creative_id, kind, passed, findings) VALUES (%s, 'deterministic', %s, %s)",
                   (cr["id"], det.passed, Jsonb([f.as_dict() for f in det.findings])))
    if not det.passed:
        return _qc_reject(ctx, a, cr, concept, det.targets, [f.detail for f in det.findings])

    try:
        passed, vision = vision_review(ctx, a, cr, concept, jpeg, settings)
    except LLMError as exc:
        release(ctx, a["id"], "produced", f"vision QC unavailable: {exc}")
        return {"status": "error", "error": str(exc)}
    if not passed:
        target = {"copy"} if vision.verdict == "reject" else {"image"}
        if any(i.category == "claim" for i in vision.issues):
            target = {"copy"}
        return _qc_reject(ctx, a, cr, concept, target,
                          [f"{i.severity} {i.category}: {i.detail}" for i in vision.issues] or [vision.summary])

    with ctx.db.tx() as conn:
        conn.execute("UPDATE creatives SET status = 'approved', updated_at = now() WHERE id = %s", (cr["id"],))
        conn.execute("INSERT INTO schedule (slot_at) VALUES (%s) ON CONFLICT DO NOTHING", (a["slot_at"],))
        conn.execute(
            "UPDATE schedule SET creative_id = %s, status = 'filled', updated_at = now() WHERE slot_at = %s AND creative_id IS NULL",
            (cr["id"], a["slot_at"]))
    release(ctx, a["id"], "approved")
    ctx.log("qc", "info", f"creative {cr['id']} approved (vision {vision.score})", {"slot_at": str(a["slot_at"])})
    return {"status": "approved", "creative_id": cr["id"], "score": vision.score}


def vision_review(ctx: Ctx, a: dict, cr: dict, concept: dict, jpeg: bytes, settings: dict) -> tuple[bool, VisionReview]:
    """Vision QC on the exact pixels; records the review. Raises LLMError."""
    product = _as_product(a["product"]) if a.get("product") else None
    vision = ctx.llm.run("qc_vision", VisionReview, (
        f"Intended headline: {product.headline if product else concept['headline']}\n"
        f"Intended support line: {concept['support_line'] or '(none)'}\n"
        + (f"Product spotlight: the image must also show the line '{product.eyebrow}' and the "
           f"price '{product.price_label}' exactly, and no product, packaging or printer.\n" if product else "")
        + f"Concept: {concept['idea']}\nVisual intent: {concept['visual']}\n"
        f"Facebook caption:\n{cr['caption_facebook']}\n"), images=[Image(jpeg, "image/jpeg")],
        ref=f"assignment:{a['id']}:qc:{cr['attempt']}")
    blockers = [i for i in vision.issues if i.severity in ("blocker", "major")]
    passed = (vision.verdict == "approve" and vision.score >= float(settings["qc_min_vision_score"])
              and vision.headline_matches and vision.logo_present_and_intact
              and not vision.stray_text_in_artwork and not blockers)
    ctx.db.execute("INSERT INTO qc_reviews (creative_id, kind, passed, score, findings) VALUES (%s, 'vision', %s, %s, %s)",
                   (cr["id"], passed, vision.score, Jsonb(vision.model_dump())))
    return passed, vision


def _qc_reject(ctx: Ctx, a: dict, cr: dict, concept: dict, targets: set[str], details: list[str]) -> dict:
    reason = "; ".join(details)[:1500]
    ctx.db.execute("UPDATE creatives SET status = 'rejected', last_error = %s, updated_at = now() WHERE id = %s",
                   (reason, cr["id"]))
    if "copy" in targets:
        # The idea or its words are wrong: a fresh concept round.
        ctx.db.execute("UPDATE concepts SET status = 'rejected', rejection = %s WHERE id = %s",
                       (f"QC: {reason}", concept["id"]))
        release(ctx, a["id"], "developing", reason)
        nxt = "developing"
    else:
        release(ctx, a["id"], "concept_ready", reason)
        nxt = "concept_ready"
    ctx.log("qc", "warn", f"creative {cr['id']} rejected → {nxt}", {"findings": details[:10]})
    return {"status": "rejected", "creative_id": cr["id"], "next": nxt, "findings": details}


# =============================================================================
# One production cycle (what the n8n production workflow calls)
# =============================================================================

def cycle(ctx: Ctx, max_steps: int = 8, time_budget_s: float = 420) -> dict:
    """Advance the pipeline a few steps. Finishing work beats starting it:
    QC, then collecting generations, then submitting, then new concepts.
    Each stage is tried until it is idle; a stage that is only waiting on a
    provider is not retried within the same cycle."""
    steps: list[dict] = []
    waiting: set[str] = set()
    started = time.monotonic()
    for i in range(max_steps):
        # No new step once the budget is spent: a Claude round can take minutes, and the
        # n8n call that started this cycle gives up after 15. The next tick continues.
        if i and time.monotonic() - started > time_budget_s:
            break
        did = False
        for name, fn in (("qc", quality_control), ("collect", collect), ("produce", produce), ("develop", develop)):
            if name in waiting:
                continue
            out = fn(ctx)
            status = out.get("status")
            if status == "idle":
                continue
            steps.append({"stage": name, **out})
            if status in ("waiting", "budget_blocked", "no_provider", "provider_retry"):
                waiting.add(name)
                continue
            did = True
            break
        if not did:
            break
    return {"steps": steps}
