"""End-to-end pipeline tests with mocked Claude and mocked fal/Graph servers.
Numbers refer to the acceptance tests in the project brief (docs/TEST-REPORT.md)."""

from __future__ import annotations

import io
import threading

import pytest
from PIL import Image

from agency import ops, pipeline, publisher
from agency.budget import month_spend
from agency.fakes import FIXTURE_CONCEPTS, FakeFal, FakeLLM
from agency.schemas import ConceptScore, ConceptSet, DirectorReview, VisionIssue, VisionReview
from tests.conftest import fal_client, mark_facts_verified


def run_until_approved(ctx, n: int = 1, max_cycles: int = 10):
    for _ in range(max_cycles):
        pipeline.cycle(ctx, 8)
        if ctx.db.one("SELECT count(*) AS n FROM creatives WHERE status = 'approved'")["n"] >= n:
            return
    raise AssertionError("pipeline did not approve enough creatives")


def first_filled_slot(db):
    return db.one("SELECT * FROM schedule WHERE status = 'filled' ORDER BY slot_at LIMIT 1")


# -- Test 1: campaign concept -----------------------------------------------------

def test_01_plan_creates_campaign_with_balanced_assignments(make_ctx, db):
    ctx = make_ctx()
    out = pipeline.ensure_planned(ctx)
    assert [o["created"] for o in out] == [True, True]  # current week (remaining slots) + next week
    nxt = db.query("SELECT pillar, count(*) AS n FROM assignments a JOIN campaigns c ON c.id = a.campaign_id "
                   "WHERE c.week_start = '2026-11-02' GROUP BY pillar")
    assert {r["pillar"]: r["n"] for r in nxt} == {"brand": 5, "product": 3, "educational": 3, "commercial": 3}
    # Idempotent: planning again creates nothing.
    assert pipeline.ensure_planned(ctx) == []
    assert db.one("SELECT count(*) AS n FROM campaigns")["n"] == 2


def test_01_invalid_plan_is_retried_then_rejected(make_ctx, db):
    from agency.schemas import CampaignPlan
    bad = CampaignPlan(name="x", proposition="x", insight="x", rationale="x", territories_to_avoid=[], assignments=[])
    ctx = make_ctx(llm=FakeLLM(db, script={"strategist": lambda u, i: bad}))
    with pytest.raises(RuntimeError, match="invalid plan"):
        pipeline.plan_week(ctx, pipeline.week_monday(ctx.now().date()))
    assert db.one("SELECT count(*) AS n FROM campaigns")["n"] == 0
    assert db.one("SELECT count(*) AS n FROM events WHERE level = 'alert'")["n"] == 1


# -- Test 2: multiple concepts, strongest selected, weak rounds revised --------------

def test_02_director_choice_and_revision_round(make_ctx, db):
    rounds = {"n": 0}

    def director(user, images):
        rounds["n"] += 1
        if rounds["n"] == 1:  # first round: nothing good enough
            return DirectorReview(scores=[ConceptScore(concept_index=i, originality=4, insight=5, memorability=4,
                                  relevance=8, visual_potential=6, commercial_usefulness=5, craft=6, cliche_flags=["generic"],
                                  repetition_concern="", verdict="reject", notes="flat") for i in range(3)],
                                  selected_index=-1, selection_reason="none", revision_direction="Find the observation.",
                                  headline_edit="")
        scores = [ConceptScore(concept_index=i, originality=6 + i, insight=8, memorability=7 + i, relevance=9,
                               visual_potential=8, commercial_usefulness=7, craft=8, cliche_flags=[],
                               repetition_concern="", verdict="approve", notes="ok") for i in range(3)]
        return DirectorReview(scores=scores, selected_index=2, selection_reason="strongest", revision_direction="",
                              headline_edit="")

    llm = FakeLLM(db, script={"director": director})
    ctx = make_ctx(llm=llm)
    pipeline.ensure_planned(ctx)
    assert pipeline.develop(ctx)["status"] == "revising"
    a = db.one("SELECT * FROM assignments ORDER BY slot_at LIMIT 1")
    assert a["status"] == "developing" and a["attempts"] == 1
    out = pipeline.develop(ctx)
    assert out["status"] == "concept_ready"
    chosen = db.one("SELECT * FROM concepts WHERE status = 'selected'")
    # selected_index=2 in the second round's set
    assert chosen["round"] == 2
    # The copywriter's second brief carried the director's direction.
    second_copy_call = [c for c in llm.calls if c[0] == "copywriter"][1]
    assert second_copy_call[1].endswith(":copy:2")
    assert db.one("SELECT count(*) AS n FROM concepts WHERE status = 'rejected'")["n"] == 5


def test_02_repetition_with_history_rejects_concept(make_ctx, db):
    ctx = make_ctx()
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 4)
    # The fixture copywriter only knows four concepts; a fifth assignment must
    # not reuse a headline already selected.
    assert pipeline.develop(ctx)["status"] == "revising"
    heads = [r["headline"] for r in db.query("SELECT headline FROM concepts WHERE status = 'selected'")]
    assert len(heads) == len(set(heads))
    rejected = db.query("SELECT rejection FROM concepts WHERE rejection LIKE 'copy QC:%%too close%%'")
    assert rejected, "expected repetition rejections from creative memory"


# -- Tests 3–6: generation via fal HTTP, branding, validation, saved post ---------------

def test_03_to_06_full_production_through_fal_http(make_ctx, db, fal_server, media_server):
    ctx = make_ctx(fal=fal_client(fal_server))
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 1)
    assert fal_server.auth_headers[0] == "Key test-key"
    sub = fal_server.submits[0]
    assert sub["model"] == "fal-ai/flux-2-pro"
    assert sub["input"]["image_size"] == {"width": 1088, "height": 1360}
    assert "No text" in sub["input"]["prompt"]

    cr = db.one("SELECT * FROM creatives WHERE status = 'approved'")
    jpeg = ctx.storage.read(cr["final_asset"])
    img = Image.open(io.BytesIO(jpeg))
    assert (img.format, img.size, img.mode) == ("JPEG", (1080, 1350), "RGB")
    meta = cr["art_brief"]["render"]
    assert meta["contrast"]["headline"] >= 4.5 and "logo" in meta["boxes"]
    # Test 6: captions, tracking link and schedule saved together.
    assert "utm_source=facebook" in cr["caption_facebook"] and f"utm_content=c{cr['id']}" in cr["link_url"]
    assert "http" not in cr["caption_instagram"]
    slot = db.one("SELECT * FROM schedule WHERE creative_id = %s", (cr["id"],))
    assert slot["status"] == "filled"
    kinds = {r["kind"] for r in db.query("SELECT kind FROM qc_reviews WHERE creative_id = %s AND passed", (cr["id"],))}
    assert kinds == {"deterministic", "vision"}
    # The plate is private; only final assets are served publicly.
    import httpx
    base, _ = media_server
    assert httpx.get(ctx.storage.url(cr["final_asset"])).status_code == 200
    assert httpx.get(f"{base}/media/{cr['raw_asset']}").status_code == 404


def test_05_vision_rejection_triggers_bounded_regeneration(make_ctx, db):
    calls = {"n": 0}

    def vision(user, images):
        calls["n"] += 1
        return VisionReview(headline_as_read="x", headline_matches=True, logo_present_and_intact=True,
                            stray_text_in_artwork=True, score=6.0, verdict="revise", summary="garbled label",
                            issues=[VisionIssue(severity="blocker", category="gibberish_text", detail="label text")])

    fal = FakeFal()
    ctx = make_ctx(llm=FakeLLM(db, script={"qc_vision": vision}), fal=fal)
    pipeline.ensure_planned(ctx)
    for _ in range(6):
        pipeline.cycle(ctx, 8)
    first = db.one("SELECT * FROM assignments ORDER BY slot_at LIMIT 1")
    attempts = db.query("SELECT status FROM creatives WHERE assignment_id = %s", (first["id"],))
    assert len(attempts) == 3 and all(a["status"] == "rejected" for a in attempts)  # max_production_attempts
    assert first["status"] == "failed"
    assert db.one("SELECT count(*) AS n FROM schedule WHERE status = 'filled'")["n"] == 0
    assert db.one("SELECT count(*) AS n FROM events WHERE level = 'alert' AND message LIKE '%%production attempts%%'")["n"] >= 1


def test_05_claim_guard_blocks_invented_offer(make_ctx, db):
    bad = FIXTURE_CONCEPTS[0].model_copy(update={
        "headline": "50% off toner this week", "caption_facebook": "Hurry, sale ends tonight! HP toner from R199. {link}",
        "claims": []})

    def copywriter(user, images):
        return ConceptSet(concepts=[bad, bad.model_copy(), bad.model_copy()])

    ctx = make_ctx(llm=FakeLLM(db, script={"copywriter": copywriter}))
    pipeline.ensure_planned(ctx)
    assert pipeline.develop(ctx)["status"] == "revising"
    reasons = " ".join(r["rejection"] for r in db.query("SELECT rejection FROM concepts"))
    for expected in ("percentages", "R199", "banned pattern", "OEM product"):
        assert expected in reasons
    assert db.one("SELECT count(*) AS n FROM concepts WHERE status = 'selected'")["n"] == 0


# -- Test 7: dry-run publishing ---------------------------------------------------------

def test_07_dry_run_publishes_nothing(make_ctx, db, clock, graph_server):
    ctx = make_ctx(graph=graph_server)  # credentials present, but mode is dry_run by default
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 1)
    mark_facts_verified(db)
    clock.t = first_filled_slot(db)["slot_at"]
    out = publisher.publish_due(ctx)
    assert out["mode"] == "dry_run" and out["status"] == "done"
    assert graph_server.fb_posts == [] and graph_server.ig_containers == {}
    pubs = db.query("SELECT platform, status, response FROM publications ORDER BY platform")
    assert [p["status"] for p in pubs] == ["dry_run", "dry_run"]
    assert pubs[0]["response"]["would_post"]["image_url"].endswith(".jpg")


# -- Tests 8, 12: live mode gates and duplicate safety ----------------------------------------

def _live_ready(make_ctx, db, clock, graph_server, **kw):
    ctx = make_ctx(graph=graph_server, live=True, **kw)
    db.set_setting("mode", "autonomous")
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 1)
    mark_facts_verified(db)
    clock.t = first_filled_slot(db)["slot_at"]
    return ctx


def test_12_live_requires_deployment_flag(make_ctx, db, clock, graph_server):
    ctx = make_ctx(graph=graph_server, live=False)
    db.set_setting("mode", "autonomous")
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 1)
    mark_facts_verified(db)
    clock.t = first_filled_slot(db)["slot_at"]
    out = publisher.publish_due(ctx)
    assert out["mode"] == "dry_run" and graph_server.fb_posts == []
    assert db.one("SELECT count(*) AS n FROM events WHERE message LIKE '%%LIVE_PUBLISHING_ENABLED is off%%'")["n"] == 1


def test_08_duplicate_and_concurrent_runs_publish_once(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    results = []
    threads = [threading.Thread(target=lambda: results.append(publisher.publish_due(ctx))) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    results.append(publisher.publish_due(ctx))  # and once more after the fact
    assert len(graph_server.fb_posts) == 1 and len(graph_server.ig_media) == 1
    pubs = db.query("SELECT platform, status, external_id, permalink FROM publications ORDER BY platform")
    assert [(p["platform"], p["status"]) for p in pubs] == [("facebook", "published"), ("instagram", "published")]
    assert pubs[0]["permalink"].startswith("https://facebook.example/")
    assert graph_server.tokens == {"test-token"}
    assert db.one("SELECT status FROM schedule WHERE slot_at = %s", (clock.t,))["status"] == "done"


def test_review_mode_needs_human_approval(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    db.set_setting("mode", "review")
    assert publisher.publish_due(ctx)["status"] == "awaiting_approval"
    assert graph_server.fb_posts == []
    cid = first_filled_slot(db)["creative_id"]
    ops.review(ctx, cid, "approved", "looks good", by="test")
    assert publisher.publish_due(ctx)["status"] == "done"
    assert len(graph_server.fb_posts) == 1


def test_pause_switch_stops_everything(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    db.set_setting("publishing_paused", True)
    assert publisher.publish_due(ctx)["status"] == "paused"
    assert graph_server.fb_posts == [] and db.query("SELECT * FROM publications") == []


# -- Test 9: failures handled safely ------------------------------------------------------

def test_09_failed_generation_releases_budget_and_retries(make_ctx, db, fal_server):
    fal_server.result_status = 500  # transient: the job stays open and is collected later
    ctx = make_ctx(fal=fal_client(fal_server))
    pipeline.ensure_planned(ctx)
    pipeline.develop(ctx)
    pipeline.produce(ctx)
    assert pipeline.collect(ctx)["status"] == "waiting"
    assert len(fal_server.submits) == 1
    fal_server.result_status = 422  # permanent: job failed, reservation released, new attempt
    assert pipeline.collect(ctx)["status"] == "generation_failed"
    with db.tx() as conn:
        assert float(month_spend(conn, "visual")) == 0.0
    pipeline.produce(ctx)
    assert len(fal_server.submits) == 2


def test_09_fal_rejects_submit(make_ctx, db, fal_server):
    fal_server.submit_status = 422
    ctx = make_ctx(fal=fal_client(fal_server))
    pipeline.ensure_planned(ctx)
    pipeline.develop(ctx)
    assert pipeline.produce(ctx)["status"] == "generation_failed"
    with db.tx() as conn:
        assert float(month_spend(conn, "visual")) == 0.0


def test_09_partial_success_then_instagram_retry(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    graph_server.ig_error = True
    out = publisher.publish_due(ctx)
    assert out["platforms"] == {"facebook": "published", "instagram": "failed"}
    assert out["status"] == "partial"
    assert db.one("SELECT count(*) AS n FROM events WHERE level = 'alert' AND message LIKE '%%partial%%'")["n"] == 1
    # A later run does not re-post Facebook.
    graph_server.ig_error = False
    publisher.publish_due(ctx)
    assert len(graph_server.fb_posts) == 1


def test_09_transient_facebook_error_retries_within_window(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    graph_server.fb_transient = 1
    first = publisher.publish_due(ctx)
    assert first["platforms"]["facebook"] == "pending"
    clock.advance(minutes=30)
    second = publisher.publish_due(ctx)
    assert second["platforms"]["facebook"] == "published" and second["status"] == "done"
    assert len(graph_server.fb_posts) == 1


def test_09_consecutive_live_failures_auto_pause(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    db.set_setting("platforms", ["instagram"])
    db.set_setting("consecutive_failure_pause", 1)
    graph_server.ig_error = True
    publisher.publish_due(ctx)
    assert db.setting("publishing_paused") is True


def test_preflight_blocks_stale_fact(make_ctx, db, clock, graph_server):
    from agency import factcheck
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    cr = db.one("SELECT c.* FROM creatives c WHERE status = 'approved'")
    cited = db.one("SELECT claims FROM concepts WHERE id = %s", (cr["concept_id"],))["claims"]
    assert cited
    # The client edits the site: the evidence disappears.
    ctx.fetch_page = lambda url: "<html>nothing here</html>"
    factcheck.verify(db, fetch=ctx.fetch_page)
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and graph_server.fb_posts == []


def test_preflight_blocks_tampered_asset(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    cr = db.one("SELECT * FROM creatives WHERE status = 'approved'")
    ctx.storage.path(cr["final_asset"]).write_bytes(b"not a jpeg")
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and graph_server.fb_posts == []


# -- Test 10: budgets -------------------------------------------------------------------------

def test_10_monthly_visual_budget_hard_stop(make_ctx, db):
    db.set_setting("visual_budget_monthly_usd", 0.05)  # one FLUX image (0.045)
    fal = FakeFal()
    ctx = make_ctx(fal=fal)
    pipeline.ensure_planned(ctx)
    for _ in range(3):
        pipeline.cycle(ctx, 8)
    assert len(fal.submitted) == 1
    assert db.one("SELECT count(*) AS n FROM creatives WHERE status = 'budget_blocked'")["n"] >= 1
    assert db.one("SELECT count(*) AS n FROM events WHERE level = 'alert' AND message LIKE 'budget stop%%'")["n"] >= 1
    assert not ops.health(ctx)["ok"]


def test_10_per_post_budget(make_ctx, db):
    db.set_setting("visual_budget_per_post_usd", 0.05)

    def vision(user, images):
        return VisionReview(headline_as_read="x", headline_matches=True, logo_present_and_intact=True,
                            stray_text_in_artwork=False, score=5.0, verdict="revise", summary="weak", issues=[])

    fal = FakeFal()
    ctx = make_ctx(llm=FakeLLM(db, script={"qc_vision": vision}), fal=fal)
    pipeline.ensure_planned(ctx)
    for _ in range(4):
        pipeline.cycle(ctx, 8)
    first = db.one("SELECT id FROM assignments ORDER BY slot_at LIMIT 1")["id"]
    jobs = db.one("SELECT count(*) AS n FROM generation_jobs j JOIN creatives c ON c.id = j.creative_id "
                  "WHERE c.assignment_id = %s", (first,))["n"]
    assert jobs == 1  # the second attempt would exceed $0.05 for this post


def test_10_claude_budget_stops_llm_stages(make_ctx, db):
    from agency.budget import BudgetExceeded, check_llm_budget
    db.set_setting("llm_budget_monthly_usd", 0.0)
    with db.tx() as conn, pytest.raises(BudgetExceeded):
        check_llm_budget(conn, db.settings())


# -- Test 11: recovery after interruption --------------------------------------------------------

def test_11_crash_mid_facebook_call_is_reconciled_not_reposted(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    db.set_setting("platforms", ["facebook"])
    graph_server.fb_drop_after_post = True  # post created, response lost
    out = publisher.publish_due(ctx)
    assert out["platforms"]["facebook"] == "unknown"
    assert len(graph_server.fb_posts) == 1
    clock.advance(minutes=15)
    out = publisher.publish_due(ctx)
    assert out["platforms"]["facebook"] == "published"
    assert len(graph_server.fb_posts) == 1  # reconciled from the page's own posts
    assert db.one("SELECT external_id FROM publications")["external_id"] == graph_server.fb_posts[0]["id"]


def test_11_interrupted_generation_is_resumed_without_resubmitting(make_ctx, db, clock, fal_server):
    fal_server.polls_until_done = 10**6
    ctx = make_ctx(fal=fal_client(fal_server))
    ctx.poll_seconds = 0.05
    pipeline.ensure_planned(ctx)
    pipeline.develop(ctx)
    pipeline.produce(ctx)
    assert pipeline.collect(ctx)["status"] == "waiting"
    # Simulate the worker dying holding a lease: a new run with a different id.
    db.execute("UPDATE assignments SET locked_by = 'dead-run', locked_at = %s", (ctx.now(),))
    fal_server.polls_until_done = 0
    fresh = make_ctx(fal=fal_client(fal_server))
    assert pipeline.collect(fresh)["status"] == "idle"  # lease still held
    clock.advance(minutes=21)  # lease expires
    assert pipeline.collect(fresh)["status"] == "rendered"
    assert len(fal_server.submits) == 1


def test_11_recover_flags_stuck_publication(make_ctx, db, clock, graph_server):
    ctx = _live_ready(make_ctx, db, clock, graph_server)
    publisher.publish_due(ctx)
    db.execute("UPDATE publications SET status = 'in_progress', started_at = now() - interval '1 hour'")
    out = ops.recover(ctx)
    assert out["unknown_publications"] == 2
    alerts = ops.claim_alerts(ctx)
    assert any("interrupted" in a["message"] for a in alerts)
    assert ops.claim_alerts(ctx) == []  # claimed exactly once


def test_health_reports_queue_and_spend(make_ctx, db):
    ctx = make_ctx()
    pipeline.ensure_planned(ctx)
    run_until_approved(ctx, 2)
    h = ops.health(ctx)
    assert h["queue"]["approved_slots"] >= 2
    assert h["spend_month_usd"]["visual"] > 0 and h["spend_month_usd"]["claude"] > 0
    assert h["effective_mode"] == "dry_run"
