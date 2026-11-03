"""Quality control: deterministic gates on the copy and the finished file.

These run before the (paid) vision review and do not depend on any model's
judgment: claims are checked against the verified fact sheet, text against
length and tone rules, the JPEG against platform specs, the layout against
safe areas and contrast, and the headline and image prompt against creative
memory for repetition.
"""

from __future__ import annotations

import hashlib
import io
import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from PIL import Image

from .config import FEED_HEIGHT, FEED_WIDTH
from .prompts import facts, usable_fact_ids
from .render import MARGIN, MIN_CONTRAST

PRINTER_BRANDS = r"(HP|Canon|Epson|Brother|Samsung|Kyocera|Lexmark|Xerox|Pantum|Ricoh|OKI|Konica(?: Minolta)?)"

BANNED_PHRASES = [
    r"don'?t miss out", r"\bhurry\b", r"game[- ]changer", r"level up", r"say goodbye to",
    r"look no further", r"limited[- ]time", r"today only", r"ends (tonight|today|soon)", r"only \d+ left",
    r"\bsale\b", r"\bdiscount", r"\bpromo", r"% off", r"\bspecial offer", r"\bdeal of",
    r"better than (the )?original", r"\bgenuine\b", r"\bOEM\b", r"\btestimonial", r"customers (say|love)",
    r"\b\d+ (happy )?customers\b", r"\brated\b", r"\b\d(\.\d)? stars?\b", r"act now", r"click here",
    r"unlock", r"elevate your",
]

MAX_BUSY_PCT = 1.5  # calibrated 27 Oct: calm grounds 0–0.2 %, type over an object 3.4 %

EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F02F]")


@dataclass
class Finding:
    check: str
    detail: str
    target: str = "copy"  # copy | image | layout — decides what gets redone

    def as_dict(self) -> dict:
        return {"check": self.check, "detail": self.detail, "target": self.target}


@dataclass
class QCResult:
    findings: list[Finding] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.findings

    def fail(self, check: str, detail: str, target: str = "copy") -> None:
        self.findings.append(Finding(check, detail, target))

    @property
    def targets(self) -> set[str]:
        return {f.target for f in self.findings}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).lower()
    text = text.replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9' ]+", " ", text).strip()


def _tokens(text: str) -> set[str]:
    stop = {"the", "a", "an", "it", "its", "it's", "is", "your", "you", "to", "of", "and", "not", "for", "on", "in"}
    return {t for t in _norm(text).split() if t not in stop}


def similarity(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    jaccard = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    return max(jaccard, SequenceMatcher(None, _norm(a), _norm(b)).ratio())


# -- claims ----------------------------------------------------------------------

def check_claims(text: str, cited: list[str], result: QCResult, stale: set[str] | None = None) -> None:
    """Every factual trigger in the text must be backed by a cited, usable,
    currently verified fact. Unknown numbers fail closed."""
    usable = usable_fact_ids()
    stale = stale or set()
    cited_set = set(cited)
    for fid in cited_set - usable:
        result.fail("claims.unknown_fact", f"cites {fid!r}, which is not a usable verified fact")
    for fid in cited_set & stale:
        result.fail("claims.stale_fact", f"fact {fid!r} failed its last live re-verification")

    t = text
    low = t.lower()

    def need(fid: str, why: str) -> None:
        if fid not in cited_set:
            result.fail("claims.uncited", f"{why} but fact {fid!r} is not cited")

    for phrase in BANNED_PHRASES:
        if re.search(phrase, t, flags=re.IGNORECASE):
            result.fail("copy.banned_phrase", f"matches banned pattern {phrase!r}")

    if "%" in t or re.search(r"\bper ?cent\b", low):
        result.fail("claims.percentage", "percentages are not supported by any usable fact")
    for m in re.finditer(r"\bR\s?(\d[\d ,]*(?:\.\d+)?)", t):
        amount = re.sub(r"[ ,]", "", m.group(1))
        if amount == "2000":
            need("free-delivery-over-2000", "mentions R2,000")
        else:
            result.fail("claims.price", f"rand amount {m.group(0)!r} is not a verified fact")
    if re.search(r"\b\d[\d,]* ?(pages|prints)\b", low) or "page yield" in low or "cost per page" in low:
        result.fail("claims.yield", "page yields / cost-per-page figures are restricted")
    if re.search(r"\b1987\b|since 19|\b39 years\b|\bfour decades\b|\bnearly 40\b", low):
        need("est-1987", "states the founding year or age")
    if re.search(r"\b(\d+|forty|thirty)[- ]years?\b", low) and not re.search(r"\b39 years\b", low):
        result.fail("claims.years", "only '39 years' / 'since 1987' are verified")
    if "warrant" in low:
        if not cited_set & {"warranty-not-void", "six-month-faulty-cover"}:
            result.fail("claims.uncited", "mentions warranty without citing a warranty fact")
    if re.search(r"guarantee|we replace|replace it|replacement", low):
        if not cited_set & {"replacement-guarantee", "six-month-faulty-cover", "prints-as-well-as-original"}:
            result.fail("claims.uncited", "mentions a guarantee/replacement without citing it")
    if re.search(r"overnight|next[- ]day|next business day|on your desk tomorrow|delivered tomorrow|there tomorrow", low):
        need("overnight-jhb-pta", "promises next-day delivery")
        if not re.search(r"noon|12:00|midday", low) or not re.search(r"jhb|johannesburg|pretoria|pta|joburg", low):
            result.fail("claims.delivery_conditions", "next-day delivery must state 'before noon' and JHB/PTA")
    if re.search(r"same[- ]day", low):
        need("same-day-dispatch", "promises same-day dispatch")
    if re.search(r"free (delivery|shipping)", low):
        need("free-delivery-over-2000", "promises free delivery")
        if not re.search(r"r ?2[ ,]?000", low):
            result.fail("claims.delivery_conditions", "free delivery must state the R2,000 threshold")
    if re.search(r"nationwide|countrywide|anywhere in (sa|south africa)", low):
        need("nationwide-courier", "promises nationwide delivery")
    if re.search(r"\b(12|twelve) (printer )?brands\b", low):
        need("brands-covered", "states the brand count")
    if re.search(rf"\b{PRINTER_BRANDS}\s+(toner|ink|cartridges?)\b", t, flags=re.IGNORECASE):
        for m in re.finditer(rf"\b{PRINTER_BRANDS}\s+(toner|ink|cartridges?)\b", t, flags=re.IGNORECASE):
            before = t[max(0, m.start() - 30):m.start()].lower()
            if "compatible with" not in before and "for " not in before[-5:]:
                result.fail("claims.brand_as_product", f"{m.group(0)!r} reads as an OEM product; say 'compatible with'")
    if re.search(r"(fraction of the (price|cost)|cheaper than|costs? less|save money|saving)", low):
        if "fraction-of-oem-price" not in cited_set:
            result.fail("claims.uncited", "makes a price comparison without citing fraction-of-oem-price")


# -- copy ------------------------------------------------------------------------

def check_copy(concept: dict, caption_facebook: str, caption_instagram: str, hashtags: list[str],
               result: QCResult, stale: set[str] | None = None, product: dict | None = None) -> None:
    headline = concept["headline"].strip()
    support = (concept.get("support_line") or "").strip()
    if not headline:
        result.fail("copy.headline_empty", "no headline")
    if len(headline.split()) > 8 or len(headline) > 60:
        result.fail("copy.headline_length", f"headline too long ({len(headline.split())} words, {len(headline)} chars)")
    if len(support.split()) > 12:
        result.fail("copy.support_length", "support line over 12 words")
    if headline.endswith("!") or "!!" in caption_facebook + caption_instagram:
        result.fail("copy.exclamation", "no exclamation marks in headlines or doubled in captions")
    if not caption_facebook.strip() or not caption_instagram.strip():
        result.fail("copy.caption_empty", "a caption is empty")
    if len(caption_facebook) > 1200:
        result.fail("copy.caption_length", "Facebook caption over 1,200 characters")
    if len(caption_instagram) > 2000:
        result.fail("copy.caption_length", "Instagram caption over 2,000 characters (limit 2,200)")
    if re.search(r"https?://", caption_instagram):
        result.fail("copy.ig_link", "Instagram captions cannot carry clickable links")
    if re.search(r"[{}]", caption_facebook + caption_instagram):
        result.fail("copy.placeholder", "unreplaced placeholder in caption")
    if len(hashtags) > 2:
        result.fail("copy.hashtags", f"{len(hashtags)} hashtags; maximum is 2")
    if any("#" in c for c in (caption_facebook,)) or caption_instagram.count("#") > 2:
        result.fail("copy.hashtags", "hashtags inside caption text")
    emojis = len(EMOJI_RE.findall(caption_facebook)) + len(EMOJI_RE.findall(caption_instagram + headline))
    if emojis > 2:
        result.fail("copy.emoji", f"{emojis} emojis; at most one per caption")
    if re.search(r"\b(color|organize|favorite|center)\b", (caption_facebook + caption_instagram + headline).lower()):
        result.fail("copy.spelling", "US spelling; use South African English")
    text = " ".join([headline, support, caption_facebook, caption_instagram])
    if product:
        check_spotlight_copy(product, support, caption_facebook, caption_instagram, result)
    check_claims(text, list(concept.get("claims") or []), result, stale)


def check_spotlight_copy(product: dict, support: str, caption_facebook: str, caption_instagram: str,
                         result: QCResult) -> None:
    """Spotlight rules: the price appears only in the rendered image (so it can
    be re-rendered when the store changes it); the product is named and, when
    it is a compatible, called compatible — never passed off as the OEM item."""
    words = " ".join([support, caption_facebook, caption_instagram])
    if re.search(r"\bR\s?\d|\bZAR\s?\d|\d[\d ,.]*\s?(rand|ZAR)\b", words, flags=re.IGNORECASE):
        result.fail("spotlight.price_in_copy", "price belongs only in the rendered image, not in captions or support line")
    name = re.sub(r"(?i)^generic ", "", product["title"])
    title = re.sub(r"[^a-z0-9]", "", name.lower())
    if title not in re.sub(r"[^a-z0-9]", "", caption_facebook.lower()):
        result.fail("spotlight.unnamed", f"Facebook caption does not name {product['title']!r}")
    if product.get("compatible"):
        for name, cap in (("Facebook", caption_facebook), ("Instagram", caption_instagram)):
            if "compatible" not in cap.lower():
                result.fail("spotlight.compatible", f"{name} caption must call it a compatible cartridge")


# -- repetition ------------------------------------------------------------------

def check_repetition(headline: str, image_prompt: str, history: list[dict], result: QCResult) -> None:
    """history: rows with headline, image_prompt (may be None), from recent
    selected/published work, excluding the current assignment."""
    for row in history:
        if headline and row.get("headline") and similarity(headline, row["headline"]) >= 0.6:
            result.fail("memory.headline", f"too close to earlier headline {row['headline']!r}")
        if image_prompt and row.get("image_prompt") and similarity(image_prompt, row["image_prompt"]) >= 0.8:
            result.fail("memory.composition", f"image prompt repeats creative #{row.get('creative_id')}", "image")


# -- file + layout ----------------------------------------------------------------

def check_asset(jpeg: bytes, expected_sha256: str | None, layout_meta: dict, result: QCResult) -> None:
    if expected_sha256 and hashlib.sha256(jpeg).hexdigest() != expected_sha256:
        result.fail("asset.checksum", "stored file does not match recorded checksum", "layout")
    if len(jpeg) > 8_000_000:
        result.fail("asset.size", "JPEG over 8 MB (Instagram limit)", "layout")
    try:
        img = Image.open(io.BytesIO(jpeg))
        img.verify()
        img = Image.open(io.BytesIO(jpeg))
    except Exception as exc:  # noqa: BLE001 — any decode failure is a failed asset
        result.fail("asset.decode", f"not a readable image: {exc}", "layout")
        return
    if img.format != "JPEG":
        result.fail("asset.format", f"{img.format}; Instagram accepts JPEG only", "layout")
    if img.size != (FEED_WIDTH, FEED_HEIGHT):
        result.fail("asset.dimensions", f"{img.size}, expected {(FEED_WIDTH, FEED_HEIGHT)}", "layout")
    if img.mode != "RGB":
        result.fail("asset.mode", f"colour mode {img.mode}", "layout")
    boxes = layout_meta.get("boxes", {})
    for name in ("headline", "logo"):
        if name not in boxes:
            result.fail("layout.missing", f"no {name} placed", "layout")
    for name, b in boxes.items():
        if b["x"] < MARGIN - 1 or b["x"] + b["w"] > FEED_WIDTH - MARGIN + 1 or b["y"] < 32 or b["y"] + b["h"] > FEED_HEIGHT - 32:
            result.fail("layout.safe_area", f"{name} outside the safe area", "layout")
    contrast = layout_meta.get("contrast", {})
    if contrast.get("busy_pct", 0) > MAX_BUSY_PCT:
        result.fail("layout.busy", f"type sits on a busy part of the image ({contrast['busy_pct']}% strong edges)", "image")
    for key in ("headline", "support", "price"):
        if key in contrast and contrast[key] < MIN_CONTRAST:
            result.fail("layout.contrast", f"{key} contrast {contrast[key]} < {MIN_CONTRAST}", "image")


def stale_facts(db) -> set[str]:
    return {r["fact_id"] for r in db.query("SELECT fact_id FROM fact_checks WHERE NOT ok")}


def all_fact_ids() -> set[str]:
    return {f["id"] for f in facts()["facts"]}
