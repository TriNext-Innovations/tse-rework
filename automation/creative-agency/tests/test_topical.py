"""Topical posts: tagging, holding until the story can be fresh, choosing safely."""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest

from agency import ops, pipeline
from agency.config import SAST
from agency.fakes import FakeLLM, FakeNews
from agency.news import parse_rss

MONDAY = date(2026, 11, 2)


@pytest.fixture
def monday(clock):
    clock.t = datetime(2026, 11, 2, 5, 0, tzinfo=SAST)
    return clock


def _topical_rows(db):
    return db.query("SELECT * FROM assignments WHERE topical IS NOT NULL ORDER BY slot_at")


def test_off_by_default(make_ctx, db, monday):
    pipeline.ensure_planned(make_ctx(news=FakeNews()))
    assert _topical_rows(db) == []


def test_marks_one_non_product_post_per_week(make_ctx, db, monday):
    db.set_setting("topical_per_week", 1)
    out = pipeline.ensure_planned(make_ctx(news=FakeNews()))
    rows = _topical_rows(db)
    assert len(rows) == 2 and [x for x in out if "topical_marked" in x]  # this week and next
    assert all(r["topical"] == {} and r["product"] is None for r in rows)
    assert all(r["slot_at"] > monday.t + timedelta(hours=36) for r in rows)
    pipeline.ensure_planned(make_ctx(news=FakeNews()))
    assert len(_topical_rows(db)) == 2  # idempotent


def test_topical_waits_for_lead_time_then_picks_a_story(make_ctx, db, monday):
    db.set_setting("topical_per_week", 1)
    llm = FakeLLM(db)
    ctx = make_ctx(llm=llm, news=FakeNews())
    pipeline.ensure_planned(ctx)
    t = _topical_rows(db)[0]
    # develop everything that is allowed now: the topical one must not be touched
    for _ in range(40):
        if pipeline.develop(ctx)["status"] == "idle":
            break
    row = db.one("SELECT * FROM assignments WHERE id = %s", (t["id"],))
    assert row["topical"] == {} and row["status"] == "new"
    assert not [c for c in llm.calls if c[0] == "news_editor"]
    # 30 hours before the slot it is picked up and the story is chosen
    monday.t = t["slot_at"] - timedelta(hours=30)
    while True:
        out = pipeline.develop(ctx)
        if out.get("assignment_id") == t["id"] or out["status"] == "idle":
            break
    row = db.one("SELECT * FROM assignments WHERE id = %s", (t["id"],))
    assert row["topical"]["story"] == "The Springboks play a test this weekend." and row["topical"]["checked_at"]
    brief = pipeline._assignment_context(ctx, row)
    assert "TOPICAL POST" in brief and "Never name people" in brief


def test_nothing_suitable_makes_an_ordinary_post(make_ctx, db, monday):
    db.set_setting("topical_per_week", 1)
    ctx = make_ctx(news=FakeNews(["Local election results: counting continues"]))
    pipeline.ensure_planned(ctx)
    t = _topical_rows(db)[0]
    monday.t = t["slot_at"] - timedelta(hours=30)
    while pipeline.develop(ctx).get("assignment_id") not in (t["id"], None):
        pass
    row = db.one("SELECT * FROM assignments WHERE id = %s", (t["id"],))
    assert "none" in row["topical"] and row["status"] != "new"
    assert "TOPICAL POST" not in pipeline._assignment_context(ctx, row)


def test_news_down_never_blocks_the_post(make_ctx, db, monday):
    db.set_setting("topical_per_week", 1)
    news = FakeNews()
    news.down = True
    ctx = make_ctx(news=news)
    pipeline.ensure_planned(ctx)
    t = _topical_rows(db)[0]
    monday.t = t["slot_at"] - timedelta(hours=30)
    while pipeline.develop(ctx).get("assignment_id") not in (t["id"], None):
        pass
    row = db.one("SELECT * FROM assignments WHERE id = %s", (t["id"],))
    assert row["topical"]["none"] == "no headlines available"


def test_queue_health_counts_a_waiting_topical_post_as_on_track(make_ctx, db, monday):
    db.set_setting("topical_per_week", 1)
    ctx = make_ctx(news=FakeNews())
    pipeline.ensure_planned(ctx)
    t = _topical_rows(db)[0]
    db.execute("DELETE FROM schedule WHERE slot_at <> %s", (t["slot_at"],))  # only the topical slot is upcoming
    assert ops.queue_status(ctx)["consecutive_ready"] == 1
    monday.t = t["slot_at"] - timedelta(hours=30)  # inside the lead time with no creative: now it is missing
    assert ops.queue_status(ctx)["consecutive_ready"] == 0


def test_parse_google_news_rss():
    xml = """<rss><channel><item><title>Boks v Italy in Turin - News24</title><source url="x">News24</source>
             <pubDate>Fri, 06 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>"""
    [h] = parse_rss(xml, "top")
    assert h.title == "Boks v Italy in Turin" and h.source == "News24" and h.published.startswith("2026-11-06")
