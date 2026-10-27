"""Structured outputs for every agent stage. Claude is constrained to these
schemas through `messages.parse`; lengths and word counts are enforced by
QC afterwards rather than in the schema, so a long headline fails loudly
instead of being silently truncated."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Pillar = Literal["brand", "product", "educational", "commercial"]
Layout = Literal["gallery", "poster", "editorial", "caption_band"]


class PlannedAssignment(BaseModel):
    slot_index: int  # 0..13 within the week, in publishing order
    pillar: Pillar
    angle: str  # the specific thing this post says, in one sentence
    audience: str
    fact_ids: list[str]


class CampaignPlan(BaseModel):
    name: str
    proposition: str
    insight: str
    rationale: str
    territories_to_avoid: list[str]
    assignments: list[PlannedAssignment]


class Concept(BaseModel):
    territory: str  # 2-4 word tag naming the creative territory, e.g. "luxury parody"
    idea: str
    insight: str
    headline: str
    support_line: str
    visual: str
    caption_facebook: str
    caption_instagram: str
    hashtags: list[str]
    claims: list[str]  # verified fact ids the copy relies on
    why_it_works: str


class ConceptSet(BaseModel):
    concepts: list[Concept]


class ConceptScore(BaseModel):
    concept_index: int
    originality: int
    insight: int
    memorability: int
    relevance: int
    visual_potential: int
    commercial_usefulness: int
    craft: int
    cliche_flags: list[str]
    repetition_concern: str
    verdict: Literal["approve", "reject"]
    notes: str


class DirectorReview(BaseModel):
    scores: list[ConceptScore]
    selected_index: int  # -1 when nothing is good enough
    selection_reason: str
    revision_direction: str
    headline_edit: str  # empty unless the director tightened the chosen headline


class ArtBrief(BaseModel):
    layout: Layout
    text_zone: Literal["top", "bottom"]
    tone: Literal["dark", "light"]  # ground the headline sits on
    accent: Literal["cyan", "lime", "none"]
    model: Literal["fal-ai/flux-2-pro", "fal-ai/nano-banana-2"]
    subject: str
    composition: str
    camera: str
    lighting: str
    materials_and_palette: str
    negative_space: str
    prompt: str
    must_avoid: list[str]


class VisionIssue(BaseModel):
    severity: Literal["blocker", "major", "minor"]
    category: Literal["gibberish_text", "logo", "product_misrepresentation", "artifact",
                      "typography", "legibility", "brand", "relevance", "taste", "claim", "other"]
    detail: str


class VisionReview(BaseModel):
    headline_as_read: str
    headline_matches: bool
    logo_present_and_intact: bool
    stray_text_in_artwork: bool
    issues: list[VisionIssue]
    score: float  # 0-10, would a good agency ship this?
    verdict: Literal["approve", "revise", "reject"]
    summary: str


class Learning(BaseModel):
    observation: str
    evidence: str
    recommendation: str


class PerformanceReport(BaseModel):
    headline_summary: str
    best: list[str]
    worst: list[str]
    learnings: list[Learning]
    next_week_guidance: str
