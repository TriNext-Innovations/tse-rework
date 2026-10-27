"""Product spotlights: rhythm, product choice, honest pricing, live re-check."""

from __future__ import annotations

import io
import random
from datetime import date, datetime, timedelta

import pytest
from PIL import Image, ImageDraw

from agency import pipeline, publisher
from agency.catalogue import choose_products, spotlight_indexes
from agency.config import SAST
from agency.fakes import FIXTURE_CONCEPTS, FIXTURE_PRODUCTS, FakeCatalogue, FakeLLM
from agency.qc import QCResult, check_asset
from agency.render import render
from agency.schemas import ConceptSet
from tests.conftest import mark_facts_verified

MONDAY = date(2026, 11, 2)


@pytest.fixture
def monday(clock):
    clock.t = datetime(2026, 11, 2, 5, 0, tzinfo=SAST)  # before the week's first slot
    return clock


def spotlight_positions(db) -> list[int]:
    rows = db.query("SELECT product IS NOT NULL AS spot FROM assignments ORDER BY slot_at")
    return [i for i, r in enumerate(rows) if r["spot"]]


def big_store() -> FakeCatalogue:
    from agency.catalogue import Product
    brands = ["Brother", "Canon", "HP", "Epson", "Kyocera", "Samsung"]
    return FakeCatalogue([Product(f"p-{i}", f"{brands[i % 6]} X{i}", f"SKU-{i}", brands[i % 6], "laser", True, 200 + i)
                          for i in range(40)])


def test_rhythm_is_every_fourth_or_fifth_post_across_weeks(make_ctx, db, monday):
    ctx = make_ctx(catalogue=big_store())
    for w in range(3):
        pipeline.plan_week(ctx, MONDAY + timedelta(days=7 * w))
    pos = spotlight_positions(db)
    gaps = {b - a for a, b in zip(pos, pos[1:])}
    assert len(pos) >= 8 and gaps <= {4, 5}, (pos, gaps)
    assert pos[0] <= 4


def test_rhythm_is_random_not_fixed():
    patterns = {tuple(spotlight_indexes(14, 3, random.Random(seed), 4, 5)) for seed in range(20)}
    assert len(patterns) > 3


def test_products_are_real_compatible_and_rotate(make_ctx, db, monday):
    ctx = make_ctx(catalogue=FakeCatalogue())  # 5 compatibles + 1 original: rotation must not repeat
    for w in range(2):
        pipeline.plan_week(ctx, MONDAY + timedelta(days=7 * w))
    rows = db.query("SELECT product FROM assignments WHERE product IS NOT NULL ORDER BY slot_at")
    handles = [r["product"]["handle"] for r in rows]
    assert len(handles) == len(set(handles))  # no product twice in 8 weeks
    assert "hp-original-85a" not in handles  # originals are not spotlighted
    brands = [r["product"]["brand"] for r in rows]
    assert all(a != b for a, b in zip(brands, brands[1:]))
    assert all(r["product"]["price_zar"] > 0 for r in rows)


def test_choose_products_relaxes_brand_rule_when_short():
    picked = choose_products(FIXTURE_PRODUCTS[:2], 2, set(), random.Random(1), ["Brother", "Canon"])
    assert len(picked) == 2


def test_store_down_plans_without_spotlights(make_ctx, db, monday):
    store = FakeCatalogue()
    store.down = True
    out = pipeline.plan_week(make_ctx(catalogue=store), MONDAY)
    assert out["created"] and out["spotlights"] == []
    assert db.one("SELECT count(*) AS n FROM events WHERE message LIKE 'store unreachable%%'")["n"] == 1


def _approve_first_spotlight(ctx, db):
    for _ in range(8):
        pipeline.cycle(ctx, 8)
        row = db.one("""SELECT c.*, a.product, a.slot_at FROM creatives c JOIN assignments a ON a.id = c.assignment_id
                        WHERE a.product IS NOT NULL AND c.status = 'approved' ORDER BY a.slot_at LIMIT 1""")
        if row:
            return row
    raise AssertionError("no spotlight approved")


def test_spotlight_end_to_end(make_ctx, db, monday):
    ctx = make_ctx(catalogue=FakeCatalogue())
    pipeline.ensure_planned(ctx)
    cr = _approve_first_spotlight(ctx, db)
    p = cr["product"]
    concept = db.one("SELECT * FROM concepts WHERE id = %s", (cr["concept_id"],))
    assert concept["headline"] == f"{p['title']}."  # store title, not model wording
    meta = cr["art_brief"]["render"]
    assert cr["layout"] == "spotlight" and "price" in meta["boxes"] and meta["contrast"]["price"] >= 4.5
    assert f"/products/{p['handle']}?" in cr["link_url"]
    assert "R" + str(p["price_zar"]) not in cr["caption_facebook"] + cr["caption_instagram"]
    assert "No cartridges" in cr["image_prompt"]


def test_price_in_caption_is_rejected(make_ctx, db, monday):
    def copywriter(user, images):
        if "PRODUCT SPOTLIGHT" not in user:
            return ConceptSet(concepts=[c.model_copy() for c in FIXTURE_CONCEPTS[:3]])
        title = user.split("Product: ", 1)[1].split(" (SKU", 1)[0]
        bad = FIXTURE_CONCEPTS[0].model_copy(update={
            "headline": f"{title}.", "caption_facebook": f"{title}, compatible, only R199. {{link}}",
            "caption_instagram": f"{title}. Compatible.", "claims": []})
        return ConceptSet(concepts=[bad, bad.model_copy(), bad.model_copy()])

    ctx = make_ctx(llm=FakeLLM(db, script={"copywriter": copywriter}), catalogue=FakeCatalogue())
    pipeline.ensure_planned(ctx)
    for _ in range(4):
        pipeline.develop(ctx)
    spot = db.one("SELECT id FROM assignments WHERE product IS NOT NULL ORDER BY slot_at LIMIT 1")
    reasons = " ".join(r["rejection"] or "" for r in db.query(
        "SELECT rejection FROM concepts WHERE assignment_id = %s", (spot["id"],)))
    assert "price belongs only in the rendered image" in reasons
    assert not db.one("SELECT 1 AS x FROM concepts WHERE assignment_id = %s AND status = 'selected'", (spot["id"],))


def _ready_to_publish(make_ctx, db, monday, store, **ctx_kw):
    ctx = make_ctx(catalogue=store, **ctx_kw)
    pipeline.ensure_planned(ctx)
    cr = _approve_first_spotlight(ctx, db)
    mark_facts_verified(db)
    # Publish exactly that slot: earlier slots are emptied out of the way.
    db.execute("UPDATE schedule SET status = 'skipped' WHERE slot_at < %s", (cr["slot_at"],))
    monday.t = cr["slot_at"]
    return ctx, cr


def test_price_change_rerenders_before_publishing(make_ctx, db, monday):
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    handle, old = cr["product"]["handle"], cr["product"]["price_zar"]
    store.set_price(handle, old - 25)
    out = publisher.publish_due(ctx)
    assert out["status"] == "done"
    after = db.one("SELECT c.final_sha256, c.final_asset, a.product FROM creatives c JOIN assignments a "
                   "ON a.id = c.assignment_id WHERE c.id = %s", (cr["id"],))
    assert after["final_sha256"] != cr["final_sha256"] and after["product"]["price_zar"] == old - 25
    pub = db.one("SELECT response FROM publications WHERE platform = 'facebook'")
    assert pub["response"]["would_post"]["image_url"].endswith(after["final_asset"])
    assert db.one("SELECT count(*) AS n FROM events WHERE message LIKE '%%price changed%%'")["n"] == 1


def test_unchanged_price_publishes_original_render(make_ctx, db, monday):
    ctx, cr = _ready_to_publish(make_ctx, db, monday, FakeCatalogue())
    assert publisher.publish_due(ctx)["status"] == "done"
    assert db.one("SELECT final_sha256 FROM creatives WHERE id = %s", (cr["id"],))["final_sha256"] == cr["final_sha256"]


def test_product_gone_blocks_publication(make_ctx, db, monday):
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    del store.products[cr["product"]["handle"]]
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and "no longer in the store" in out["problems"][0]


def test_store_down_at_publish_is_retried(make_ctx, db, monday):
    store = FakeCatalogue()
    ctx, _ = _ready_to_publish(make_ctx, db, monday, store)
    store.down = True
    assert publisher.publish_due(ctx)["status"] == "preflight_retry"
    store.down = False
    monday.advance(minutes=11)
    assert publisher.publish_due(ctx)["status"] == "done"


def test_busy_text_area_fails_qc():
    img = Image.new("RGB", (1088, 1360), (30, 30, 30))
    d = ImageDraw.Draw(img)
    for x in range(0, 1088, 24):  # hard-edged clutter where the type will sit
        d.rectangle((x, 560, x + 10, 1360), fill=(230, 230, 230))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    r = render(buf.getvalue(), layout="spotlight", headline="Canon 054.", text_zone="bottom", tone="dark",
               eyebrow="Compatible laser toner", price="R350", support_line="Same pages. Smaller invoice.")
    qc = QCResult()
    check_asset(r.jpeg, None, r.meta(), qc)
    assert "layout.busy" in {f.check for f in qc.findings}


def test_prices_keep_cents():
    from agency.catalogue import Product
    p = Product("x", "Canon 054", "S", "Canon", "laser", True, 449.5)
    assert p.price_label == "R449.50"
    assert Product("y", "Kyocera TK-3060", "S", "Kyocera", "laser", True, 1450.0).price_label == "R1 450"
    assert Catalogue_product_price({"calculated_amount": 99.99}) == 99.99


def Catalogue_product_price(calculated: dict) -> float:
    from agency.catalogue import Catalogue
    p = Catalogue._product({"handle": "h", "title": "T", "metadata": {}, "variants": [
        {"sku": "S", "calculated_price": calculated}]})
    return p.price_zar


def test_cents_only_price_change_is_rerendered(make_ctx, db, monday):
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    store.set_price(cr["product"]["handle"], cr["product"]["price_zar"] - 0.01)
    assert publisher.publish_due(ctx)["status"] == "done"
    assert db.one("SELECT final_sha256 FROM creatives WHERE id = %s", (cr["id"],))["final_sha256"] != cr["final_sha256"]


def test_rerender_failure_is_reported_not_crashed(make_ctx, db, monday, monkeypatch):
    from agency.render import RenderError
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    store.set_price(cr["product"]["handle"], 99999.99)

    def boom(*a, **k):
        raise RenderError("price does not fit")

    monkeypatch.setattr(publisher, "render_creative", boom)
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and "price does not fit" in out["problems"][0]
    assert db.one("SELECT status FROM schedule WHERE slot_at = %s", (cr["slot_at"],))["status"] == "failed"


def test_repriced_ad_gets_vision_review_and_fails_closed(make_ctx, db, monday):
    from agency.schemas import VisionReview
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    ctx.llm.script["qc_vision"] = lambda u, i: VisionReview(
        headline_as_read="x", headline_matches=False, logo_present_and_intact=True, stray_text_in_artwork=False,
        issues=[], score=4.0, verdict="revise", summary="price unreadable")
    store.set_price(cr["product"]["handle"], cr["product"]["price_zar"] + 10)
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and "failed vision QC" in out["problems"][0]
    assert db.one("SELECT final_sha256 FROM creatives WHERE id = %s", (cr["id"],))["final_sha256"] == cr["final_sha256"]


def test_repriced_ad_needs_reapproval_in_review_mode(make_ctx, db, monday, graph_server):
    from agency import ops
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store, graph=graph_server, live=True)
    db.set_setting("mode", "review")
    ops.review(ctx, cr["id"], "approved", None, by="test")
    store.set_price(cr["product"]["handle"], cr["product"]["price_zar"] + 10)
    assert publisher.publish_due(ctx)["status"] == "preflight_retry"
    assert db.one("SELECT human_approval FROM creatives WHERE id = %s", (cr["id"],))["human_approval"] is None
    monday.advance(minutes=11)
    assert publisher.publish_due(ctx)["status"] == "awaiting_approval"
    ops.review(ctx, cr["id"], "approved", "new price ok", by="test")
    assert publisher.publish_due(ctx)["status"] == "done"
    assert len(graph_server.fb_posts) == 1


def test_renamed_product_is_held(make_ctx, db, monday):
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    store.rename(cr["product"]["handle"], "Something Else 999")
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and "renamed" in out["problems"][0]


@pytest.mark.parametrize("price", [0, -5])
def test_non_positive_store_price_is_never_published(make_ctx, db, monday, price):
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    store.set_price(cr["product"]["handle"], price)
    out = publisher.publish_due(ctx)
    assert out["status"] == "preflight_failed" and "non-positive price" in out["problems"][0]


def test_compatible_flag_flip_is_held(make_ctx, db, monday):
    from dataclasses import replace
    store = FakeCatalogue()
    ctx, cr = _ready_to_publish(make_ctx, db, monday, store)
    h = cr["product"]["handle"]
    store.products[h] = replace(store.products[h], compatible=False)
    assert "compatible and original" in publisher.publish_due(ctx)["problems"][0]


@pytest.mark.parametrize("caption", ["Only ZAR 399 today", "Just 399 rand", "R 399"])
def test_any_price_form_in_spotlight_copy_is_caught(caption):
    from agency.qc import check_spotlight_copy
    q = QCResult()
    check_spotlight_copy({"title": "Canon 054", "compatible": True}, "", f"Canon 054 compatible. {caption}", "compatible", q)
    assert "spotlight.price_in_copy" in {f.check for f in q.findings}
