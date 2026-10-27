"""Unit tests: claims guard, copy rules, repetition, renderer, fact checker."""

from __future__ import annotations

import io

import pytest
from PIL import Image

from agency import factcheck
from agency.fakes import synthetic_plate
from agency.qc import QCResult, check_asset, check_claims, check_copy, check_repetition, similarity
from agency.render import RenderError, render


def claims(text, cited=()):
    r = QCResult()
    check_claims(text, list(cited), r)
    return [f.check for f in r.findings]


@pytest.mark.parametrize("text,cited,expected", [
    ("Since 1987.", ["est-1987"], []),
    ("Since 1987.", [], ["claims.uncited"]),
    ("Save 40% on toner", ["fraction-of-oem-price"], ["claims.percentage"]),
    ("Only R199", [], ["claims.price"]),
    ("Free delivery over R2,000", ["free-delivery-over-2000"], []),
    ("Free delivery on everything", ["free-delivery-over-2000"], ["claims.delivery_conditions"]),
    ("On your desk tomorrow.", ["overnight-jhb-pta"], ["claims.delivery_conditions"]),
    ("Order before noon, on your desk tomorrow in JHB & PTA with Overnight.", ["overnight-jhb-pta"], []),
    ("HP toner that works", [], ["claims.brand_as_product"]),
    ("Compatible with HP toner printers", [], []),
    ("Genuine quality", [], ["copy.banned_phrase"]),
    ("2,400 pages per cartridge", [], ["claims.yield"]),
    ("Forty years of experience", ["est-1987"], ["claims.years"]),
    ("Cheaper than the original", [], ["claims.uncited"]),
    ("Anything", ["cost-per-page-60"], ["claims.unknown_fact"]),
    ("Doesn't void your printer's warranty", ["warranty-not-void"], []),
])
def test_claims_guard(text, cited, expected):
    assert sorted(set(claims(text, cited))) == sorted(set(expected))


def test_copy_rules():
    r = QCResult()
    check_copy({"headline": "This headline is far too long to be any good at all", "support_line": "", "claims": []},
               "Great colour! Visit https://x {link}", "Look 😀😀😀 https://tse.co.za", ["a", "b", "c"], r)
    checks = {f.check for f in r.findings}
    assert {"copy.headline_length", "copy.placeholder", "copy.ig_link", "copy.hashtags", "copy.emoji"} <= checks


def test_us_spelling_flagged():
    r = QCResult()
    check_copy({"headline": "Pick a color", "support_line": "", "claims": []}, "x", "y", [], r)
    assert "copy.spelling" in {f.check for f in r.findings}


def test_repetition():
    assert similarity("Your printer has expensive taste.", "Your printer has expensive tastes") > 0.8
    assert similarity("It always knows.", "The rule that never was.") < 0.4
    r = QCResult()
    check_repetition("It's ink. Not a diamond.", "", [{"headline": "It's ink, not a diamond", "image_prompt": None}], r)
    assert r.findings[0].check == "memory.headline"


@pytest.mark.parametrize("layout", ["gallery", "poster", "editorial", "caption_band"])
@pytest.mark.parametrize("tone", ["dark", "light"])
def test_render_layouts_pass_asset_checks(layout, tone):
    r = render(synthetic_plate(3), layout=layout, headline="It's ink. Not a diamond.",
               support_line="So why pay like it is?", text_zone="bottom", tone=tone, accent="cyan")
    qc = QCResult()
    check_asset(r.jpeg, None, r.meta(), qc)
    assert qc.passed, qc.findings
    assert Image.open(io.BytesIO(r.jpeg)).size == (1080, 1350)


def test_render_scrims_busy_background_for_contrast():
    # A bright, noisy plate: light type must still reach 4.5:1.
    img = Image.effect_noise((1088, 1360), 90).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    r = render(buf.getvalue(), layout="gallery", headline="Generic. Not generic.", text_zone="top", tone="dark")
    assert r.contrast["headline"] >= 4.5


def test_render_refuses_unfittable_headline():
    with pytest.raises(RenderError):
        render(synthetic_plate(1), layout="caption_band", headline=" ".join(["Supercalifragilistic"] * 12))


def test_factcheck_marks_missing_evidence(db):
    page = "<html><body>TSE has supplied printer consumables in South Africa since 1987.</body></html>"
    out = factcheck.verify(db, only=["est-1987", "warranty-not-void"], fetch=lambda url: page)
    assert out == {"est-1987": True, "warranty-not-void": False}
    assert db.one("SELECT count(*) AS n FROM events WHERE level = 'alert'")["n"] == 1


def test_factcheck_network_failure_keeps_previous_result(db):
    db.execute("INSERT INTO fact_checks (fact_id, ok) VALUES ('est-1987', true)")

    def boom(url):
        raise OSError("offline")

    assert factcheck.verify(db, only=["est-1987"], fetch=boom) == {}
    assert db.one("SELECT ok FROM fact_checks WHERE fact_id = 'est-1987'")["ok"] is True


def test_settings_validation(db):
    with pytest.raises(ValueError):
        db.set_setting("mode", "yolo")
    with pytest.raises(ValueError):
        db.set_setting("visual_budget_monthly_usd", -1)
    with pytest.raises(KeyError):
        db.set_setting("nonsense", 1)
    db.set_setting("publish_times", ["07:30", "19:30"])
    assert db.setting("publish_times") == ["07:30", "19:30"]


def test_spotlight_display_title_and_eyebrow():
    from agency.catalogue import Product
    p = Product("generic-brother-tn-3185", "Generic Brother TN-3185", "S", "Brother", "laser", True, 400)
    assert p.headline == "Brother TN-3185." and p.eyebrow == "Compatible laser toner" and p.price_label == "R400"
    assert Product("x", "Epson 664 Black", "S", "Epson", "ink", True, 120).eyebrow == "Compatible refill ink"
    assert Product("y", "Kyocera TK-3060", "S", "Kyocera", "laser", True, 1450).price_label == "R1 450"
