"""Offline stand-ins for Claude and fal.ai, used by tests and `agency demo`.

The fake copy below is hand-written fixture content so the pipeline can be
exercised end to end without spending money. It is labelled as such
everywhere it surfaces; it is not output from the Claude API.
"""

from __future__ import annotations

import io
import itertools
import random
import uuid
from collections.abc import Callable

from PIL import Image as PILImage
from PIL import ImageDraw, ImageFilter

from .imagegen import GenerationError
from .schemas import (ArtBrief, CampaignPlan, Concept, ConceptScore, ConceptSet, DirectorReview, Learning,
                      PerformanceReport, PlannedAssignment, VisionReview)

FIXTURE_CONCEPTS = [
    Concept(territory="luxury parody", idea="Treat a toner cartridge with the reverence of a luxury watch.",
            insight="Original cartridges are priced like luxury goods for plastic and powder.",
            headline="Your printer has expensive taste.", support_line="You don't have to.",
            visual="A single unbranded matte-black toner cartridge on a velvet watch cushion in a glass vitrine.",
            caption_facebook="Some printers only drink the expensive stuff. Ours are less fussy.\n\nCompatible cartridges for 12 printer brands, at a fraction of the price of originals. {link}",
            caption_instagram="Some printers only drink the expensive stuff.\n\nCompatibles for 12 printer brands. tse.co.za",
            hashtags=["printing"], claims=["fraction-of-oem-price", "brands-covered"],
            why_it_works="Borrowed luxury codes make the price absurdity visible."),
    Concept(territory="warranty myth", idea="Debunk the belief that compatibles void a printer's warranty.",
            insight="People pay more out of fear of a rule that doesn't exist.",
            headline="The rule that never was.", support_line="Compatible cartridges don't void your printer's warranty.",
            visual="An old rubber stamp resting on a blank sheet, ink pad dry, raking light.",
            caption_facebook="Somebody once told your office that generic cartridges void the printer's warranty. They don't. Using a compatible cartridge does not void your printer's warranty.\n\nFind yours: {link}",
            caption_instagram="Using a compatible cartridge doesn't void your printer's warranty. It never did.",
            hashtags=[], claims=["warranty-not-void"], why_it_works="Myth-busting with a quiet, official tone."),
    Concept(territory="worst moment", idea="The printer always runs out at the worst possible moment.",
            insight="Toner is invisible until the board pack is due.",
            headline="It always knows.", support_line="Order before noon for same-day dispatch.",
            visual="A single sheet stuck half-out of an office printer tray at night, desk lamp on.",
            caption_facebook="Printers run out at 4:55pm on the day the board pack is due. We can't change that. We can dispatch the same day if you order before noon. {link}",
            caption_instagram="Printers run out at 4:55pm on deadline day. Order before noon for same-day dispatch.",
            hashtags=[], claims=["same-day-dispatch"], why_it_works="Universal office truth, dry delivery."),
    Concept(territory="since 1987", idea="Thirty-nine years of quietly sorting it out.",
            insight="Trust in generics comes from track record, not adjectives.",
            headline="Generic. Not generic.", support_line="Since 1987.",
            visual="A worn brass trade counter bell on a clean steel counter, soft daylight.",
            caption_facebook="We have sold printer cartridges from Kya Sands since 1987. Family-run, then and now. {link}",
            caption_instagram="Family-run, from Kya Sands, since 1987.",
            hashtags=[], claims=["est-1987", "family-run-kya-sands"], why_it_works="Brand line plus proof."),
]

GOOD_PROMPTS = [
    "A single matte-black unbranded laser toner cartridge resting on a black velvet watch cushion inside a glass vitrine, museum still life, 85mm lens, low-key softbox from upper left, deep charcoal background, generous empty space across the bottom third. No text, letters, numbers, labels, logos or watermarks anywhere in the image.",
    "An old wooden-handled rubber stamp resting beside a dry ink pad on a pale grey desk, raking afternoon light, 50mm lens, empty calm space across the top third. No text, letters, numbers, labels, logos or watermarks anywhere in the image.",
    "A dark open-plan office at night, one desk lamp lighting an office printer with a single blank sheet half-fed, 35mm documentary photograph, quiet empty wall at the top. No text, letters, numbers, labels, logos or watermarks anywhere in the image.",
    "A worn brass counter bell on a brushed steel trade counter, soft window daylight, shallow depth of field, plain warm wall filling the upper third. No text, letters, numbers, labels, logos or watermarks anywhere in the image.",
]


class FakeLLM:
    """Deterministic stage outputs; `script` overrides a stage with a callable."""

    def __init__(self, db=None, script: dict[str, Callable] | None = None):
        self.db = db
        self.script = script or {}
        self.calls: list[tuple[str, str]] = []
        self._concept_cycle = itertools.count()

    def run(self, stage, schema, user, *, images=None, ref=None):
        self.calls.append((stage, ref or ""))
        if self.db is not None:
            from .budget import record_llm
            with self.db.tx() as conn:  # record a token-shaped cost so ledgers are exercised
                record_llm(conn, model="claude-opus-5-5", stage=stage, ref=ref,
                           usage={"input_tokens": 3000, "output_tokens": 1200})
        if stage in self.script:
            return self.script[stage](user, images)
        return getattr(self, f"_{stage}")(user, images)

    def _strategist(self, user, images):
        pillars = (["brand"] * 5 + ["product"] * 3 + ["educational"] * 3 + ["commercial"] * 3)
        order = [0, 5, 8, 11, 1, 6, 9, 12, 2, 7, 10, 13, 3, 4]
        return CampaignPlan(
            name="[fixture] The quiet people behind the noisy printer",
            proposition="When the printer lets you down, TSE is the calm, competent people who sort it out.",
            insight="Nobody thinks about toner until it is the only thing they can think about.",
            rationale="Fixture plan for offline runs.", territories_to_avoid=[],
            assignments=[PlannedAssignment(slot_index=i, pillar=pillars[order[i]],
                                           angle=f"[fixture] angle {i}", audience="office administrators",
                                           fact_ids=[]) for i in range(14)])

    def _copywriter(self, user, images):
        start = next(self._concept_cycle)
        picked = [FIXTURE_CONCEPTS[(start + k) % len(FIXTURE_CONCEPTS)] for k in range(3)]
        return ConceptSet(concepts=[c.model_copy() for c in picked])

    def _director(self, user, images):
        scores = [ConceptScore(concept_index=i, originality=8 - i, insight=8, memorability=8 - i, relevance=9,
                               visual_potential=8, commercial_usefulness=7, craft=8, cliche_flags=[],
                               repetition_concern="", verdict="approve", notes="fixture review")
                  for i in range(3)]
        return DirectorReview(scores=scores, selected_index=0, selection_reason="fixture", revision_direction="",
                              headline_edit="")

    def _art_director(self, user, images):
        for i, c in enumerate(FIXTURE_CONCEPTS):
            if c.headline in user:
                prompt = GOOD_PROMPTS[i]
                break
        else:
            prompt = GOOD_PROMPTS[0]
        return ArtBrief(layout="gallery", text_zone="bottom", tone="dark", accent="cyan", model="fal-ai/flux-2-pro",
                        subject="fixture", composition="fixture", camera="85mm", lighting="softbox",
                        materials_and_palette="charcoal", negative_space="bottom third", prompt=prompt,
                        must_avoid=["text"])

    def _qc_vision(self, user, images):
        intended = user.split("Intended headline: ", 1)[1].split("\n", 1)[0]
        return VisionReview(headline_as_read=intended, headline_matches=True, logo_present_and_intact=True,
                            stray_text_in_artwork=False, issues=[], score=8.0, verdict="approve",
                            summary="[fixture] no issues")

    def _analyst(self, user, images):
        return PerformanceReport(headline_summary="[fixture] report", best=[], worst=[],
                                 learnings=[Learning(observation="fixture", evidence="fixture", recommendation="fixture")],
                                 next_week_guidance="[fixture] keep going")


def synthetic_plate(seed: int) -> bytes:
    """A studio-like still life: graded backdrop, plinth, dark object."""
    rnd = random.Random(seed)
    img = PILImage.new("RGB", (1088, 1360))
    d = ImageDraw.Draw(img)
    base = rnd.randint(18, 40)
    for y in range(1360):
        v = int(base + 45 * (y / 1360))
        d.line([(0, y), (1088, y)], fill=(v, v - 3 if v > 3 else v, max(0, v - 6)))
    d.ellipse((260, 640, 830, 820), fill=(96 + rnd.randint(0, 30), 88, 80))
    d.rounded_rectangle((470, 360, 620, 730), radius=14, fill=(14, 14, 14))
    d.rectangle((470, 360, 490, 730), fill=(36, 36, 36))
    img = img.filter(ImageFilter.GaussianBlur(2))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


class FakeFal:
    """In-process fal stand-in: jobs complete after `ready_after` status polls."""

    def __init__(self, ready_after: int = 1, fail_submit: bool = False, fail_result: bool = False):
        self.ready_after = ready_after
        self.fail_submit = fail_submit
        self.fail_result = fail_result
        self.jobs: dict[str, dict] = {}
        self.submitted: list[tuple[str, dict]] = []

    def submit(self, model, payload):
        if self.fail_submit:
            raise GenerationError("fake: model rejected input", retryable=False)
        rid = uuid.uuid4().hex
        self.jobs[rid] = {"polls": 0, "seed": len(self.jobs) + 1}
        self.submitted.append((model, payload))
        return {"request_id": rid, "status_url": f"fake://{rid}/status", "response_url": f"fake://{rid}"}

    def status(self, status_url):
        rid = status_url.split("/")[2]
        job = self.jobs[rid]
        job["polls"] += 1
        return "COMPLETED" if job["polls"] >= self.ready_after else "IN_PROGRESS"

    def result(self, response_url):
        if self.fail_result:
            raise GenerationError("fake: generation failed", retryable=False)
        rid = response_url.split("/")[2]
        return {"images": [{"url": f"fake://{rid}/image.png"}]}

    def download(self, url):
        rid = url.split("/")[2]
        return synthetic_plate(self.jobs[rid]["seed"])
