"""Brand renderer: composites a generated plate with real TSE type and logo.

The image model never draws words or the logo. This module sets the headline
in Fraunces and the support line in Inter (the storefront's faces), places the
rasterised official logo, and guarantees legibility by measuring the ground
under the type and darkening or lightening it until the contrast holds.

Four layouts share one grid (72 px margins, 4:5 feed frame) so the feed reads
as a system without every post looking the same.
"""

from __future__ import annotations

import io
from dataclasses import asdict, dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat

from .config import BRAND_DIR, FEED_HEIGHT, FEED_WIDTH

W, H = FEED_WIDTH, FEED_HEIGHT
MARGIN = 72
INK = (10, 10, 10)
PAPER = (237, 237, 237)
ACCENTS = {"cyan": (65, 224, 245), "lime": (223, 227, 68)}
FONTS = BRAND_DIR / "fonts"
LOGOS = BRAND_DIR / "logo"
MIN_CONTRAST = 4.5


@dataclass
class Box:
    x: int
    y: int
    w: int
    h: int

    @property
    def xyxy(self) -> tuple[int, int, int, int]:
        return self.x, self.y, self.x + self.w, self.y + self.h


@dataclass
class RenderResult:
    jpeg: bytes
    width: int
    height: int
    layout: str
    headline_lines: list[str]
    headline_size: int
    support_lines: list[str]
    boxes: dict[str, Box] = field(default_factory=dict)
    contrast: dict[str, float] = field(default_factory=dict)

    def meta(self) -> dict:
        return {
            "layout": self.layout, "width": self.width, "height": self.height,
            "headline_lines": self.headline_lines, "headline_size": self.headline_size,
            "support_lines": self.support_lines,
            "boxes": {k: asdict(v) for k, v in self.boxes.items()},
            "contrast": self.contrast,
        }


class RenderError(ValueError):
    pass


# -- fonts -----------------------------------------------------------------------

def _variable(path: Path, size: int, **axes: float) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(path), size)
    values = []
    for axis in font.get_variation_axes():
        name = axis["name"].decode() if isinstance(axis["name"], bytes) else axis["name"]
        key = {"Optical Size": "opsz", "Weight": "wght", "Softness": "SOFT", "Wonky": "WONK"}.get(name, name)
        values.append(axes.get(key, axis["default"]))
    font.set_variation_by_axes(values)
    return font


def headline_font(size: int) -> ImageFont.FreeTypeFont:
    return _variable(FONTS / "Fraunces.ttf", size, opsz=144, wght=560, SOFT=30, WONK=0)


def sans_font(size: int, weight: int = 500) -> ImageFont.FreeTypeFont:
    return _variable(FONTS / "Inter.ttf", size, opsz=min(32, max(14, size)), wght=weight)


# -- colour maths ------------------------------------------------------------------

def _lum(rgb: tuple[float, float, float]) -> float:
    def ch(c: float) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast_ratio(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def _pixels(img: Image.Image) -> list:
    getter = getattr(img, "get_flattened_data", None) or img.getdata
    return list(getter())


def region_worst_contrast(img: Image.Image, box: Box, text_rgb: tuple[int, int, int]) -> float:
    """Contrast against the *worst* part of the ground, not its average:
    light type is judged against the 90th-percentile brightness of the region."""
    region = img.crop(box.xyxy).convert("RGB").resize((max(1, box.w // 8), max(1, box.h // 8)))
    pixels = sorted(_pixels(region), key=_lum)
    if not pixels:
        return 21.0
    text_is_light = _lum(text_rgb) > 0.5
    idx = int(len(pixels) * (0.9 if text_is_light else 0.1))
    return contrast_ratio(text_rgb, pixels[min(idx, len(pixels) - 1)])


# -- text layout -------------------------------------------------------------------

def _smart_quotes(text: str) -> str:
    out, open_double = [], True
    for i, ch in enumerate(text):
        if ch == '"':
            out.append("“" if open_double else "”")
            open_double = not open_double
        elif ch == "'":
            prev = text[i - 1] if i else " "
            out.append("‘" if prev.isspace() else "’")
        else:
            out.append(ch)
    return "".join(out)


def _wrap(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if font.getlength(trial) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def balanced_wrap(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    """Greedy wrap, then narrow the measure while the line count holds, so
    the last line is never a lonely word."""
    best = _wrap(text, font, width)
    if len(best) < 2:
        return best
    for w in range(width, int(width * 0.55), -12):
        trial = _wrap(text, font, w)
        if len(trial) != len(best):
            break
        best = trial
    return best


def fit_headline(text: str, width: int, max_height: int, max_lines: int,
                 size_range: tuple[int, int]) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    lo, hi = size_range
    # First pass refuses a short orphaned last word; the second accepts it.
    for avoid_orphan in (True, False):
        for size in range(hi, lo - 1, -4):
            font = headline_font(size)
            lines = balanced_wrap(text, font, width)
            if any(font.getlength(line) > width for line in lines):
                continue  # a single word wider than the measure
            if avoid_orphan and len(lines) > 1 and len(lines[-1].split()) == 1 and len(lines[-1]) <= 8:
                continue
            height = int(len(lines) * size * 1.02)
            if len(lines) <= max_lines and height <= max_height:
                return font, lines, size
    raise RenderError(f"headline does not fit: {text!r}")


def _draw_lines(draw: ImageDraw.ImageDraw, lines: list[str], font: ImageFont.FreeTypeFont,
                x: int, y: int, leading: float, fill: tuple[int, int, int]) -> Box:
    size = font.size
    top = y
    widest = 0
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        widest = max(widest, int(font.getlength(line)))
        y += int(size * leading)
    return Box(x, top, widest, y - top)


# -- plate handling ----------------------------------------------------------------

def cover(plate: Image.Image, w: int, h: int, focus: str = "center") -> Image.Image:
    centering = {"center": (0.5, 0.5), "top": (0.5, 0.35), "bottom": (0.5, 0.65)}[focus]
    return ImageOps.fit(plate.convert("RGB"), (w, h), method=Image.Resampling.LANCZOS, centering=centering)


def _scrim(img: Image.Image, zone: Box, tone: str, strength: float, fade: int) -> Image.Image:
    """Gradient wash over the text zone, fading out into the image."""
    colour = INK if tone == "dark" else PAPER
    overlay = Image.new("RGB", img.size, colour)
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    alpha = int(255 * strength)
    md.rectangle(zone.xyxy, fill=alpha)
    top_edge = zone.y == 0
    for i in range(fade):
        a = int(alpha * (1 - i / fade))
        y = zone.y + zone.h + i if top_edge else zone.y - i - 1
        if 0 <= y < img.height:
            md.line([(0, y), (img.width, y)], fill=a)
    return Image.composite(overlay, img, mask)


def _logo(tone: str, width: int) -> Image.Image:
    name = "tse-logo-dark.png" if tone == "dark" else "tse-logo.png"
    logo = Image.open(LOGOS / name).convert("RGBA")
    ratio = width / logo.width
    return logo.resize((width, int(logo.height * ratio)), Image.Resampling.LANCZOS)


# -- layouts -------------------------------------------------------------------------

def render(plate_bytes: bytes, *, layout: str, headline: str, support_line: str = "",
           text_zone: str = "bottom", tone: str = "dark", accent: str = "none",
           cta: str = "tse.co.za") -> RenderResult:
    if layout not in {"gallery", "poster", "editorial", "caption_band"}:
        raise RenderError(f"unknown layout {layout}")
    if not headline.strip():
        raise RenderError("empty headline")
    headline = _smart_quotes(headline.strip())
    support_line = _smart_quotes(support_line.strip())
    plate = Image.open(io.BytesIO(plate_bytes))
    plate.load()

    text_rgb = PAPER if tone == "dark" else INK
    ground_rgb = INK if tone == "dark" else PAPER
    measure = W - 2 * MARGIN
    logo_w = 168

    if layout == "editorial":
        img_h = int(H * 0.68)
        canvas = Image.new("RGB", (W, H), ground_rgb)
        canvas.paste(cover(plate, W, img_h), (0, 0) if text_zone == "bottom" else (0, H - img_h))
        zone = Box(0, img_h, W, H - img_h) if text_zone == "bottom" else Box(0, 0, W, H - img_h)
        size_range, max_lines = (52, 92), 3
    elif layout == "poster":
        canvas = cover(plate, W, H)
        zone = Box(0, 0, W, int(H * 0.58)) if text_zone == "top" else Box(0, int(H * 0.42), W, int(H * 0.58))
        size_range, max_lines = (80, 150), 4
    elif layout == "caption_band":
        canvas = cover(plate, W, H, "top" if text_zone == "bottom" else "bottom")
        band_h = 420
        zone = Box(0, H - band_h, W, band_h) if text_zone == "bottom" else Box(0, 0, W, band_h)
        size_range, max_lines = (44, 64), 2
    else:  # gallery
        canvas = cover(plate, W, H, "top" if text_zone == "bottom" else "bottom")
        zone = Box(0, int(H * 0.62), W, H - int(H * 0.62)) if text_zone == "bottom" else Box(0, 0, W, int(H * 0.38))
        size_range, max_lines = (56, 104), 3

    # Inner text area: margins, plus a logo row reserved at the zone's outer edge.
    support_font = sans_font(34, 500)
    cta_font = sans_font(24, 600)
    logo = _logo(tone, logo_w)
    support_lines = balanced_wrap(support_line, support_font, measure - logo_w - 40) if support_line else []
    support_h = int(len(support_lines) * 34 * 1.3)
    logo_row_h = max(logo.height + 34, support_h)
    gap = 28
    available = zone.h - 2 * 56 - logo_row_h - gap
    font, lines, size = fit_headline(headline, measure, available, max_lines, size_range)
    headline_h = int(len(lines) * size * 1.02)

    # Ensure the ground under the type is calm enough: scrim until contrast holds.
    text_block_top = zone.y + 56 if text_zone == "top" else zone.y + zone.h - 56 - logo_row_h - gap - headline_h
    text_area = Box(MARGIN - 8, max(0, text_block_top - 8), measure + 16,
                    min(H, headline_h + gap + logo_row_h + 16))
    if layout != "editorial":
        strength = 0.0
        while region_worst_contrast(canvas, text_area, text_rgb) < MIN_CONTRAST and strength < 0.92:
            strength += 0.12
            canvas = _scrim(canvas, zone, tone, min(strength, 0.92), fade=160)
        if layout == "caption_band":
            canvas = _scrim(canvas, zone, tone, 0.94, fade=0)

    ground = canvas.copy()  # contrast is measured against the ground, before type
    draw = ImageDraw.Draw(canvas)
    boxes: dict[str, Box] = {}
    if accent != "none":
        bar_y = text_block_top - 22
        if bar_y > zone.y + 8:
            draw.rectangle((MARGIN, bar_y, MARGIN + 64, bar_y + 6), fill=ACCENTS[accent])

    boxes["headline"] = _draw_lines(draw, lines, font, MARGIN, text_block_top, 1.02, text_rgb)
    row_y = text_block_top + headline_h + gap

    support_rgb = ACCENTS[accent] if (accent != "none" and tone == "dark") else (
        (200, 200, 200) if tone == "dark" else (42, 42, 42))
    if support_lines:
        boxes["support"] = _draw_lines(draw, support_lines, support_font, MARGIN, row_y, 1.3, support_rgb)
    logo_x, logo_y = W - MARGIN - logo.width, row_y
    canvas.paste(logo, (logo_x, logo_y), logo)
    boxes["logo"] = Box(logo_x, logo_y, logo.width, logo.height)
    cta_w = int(cta_font.getlength(cta))
    draw.text((W - MARGIN - cta_w, logo_y + logo.height + 6), cta, font=cta_font, fill=support_rgb)
    boxes["cta"] = Box(W - MARGIN - cta_w, logo_y + logo.height + 6, cta_w, 26)

    contrast = {"headline": round(region_worst_contrast(ground, boxes["headline"], text_rgb), 2)}
    if "support" in boxes:
        contrast["support"] = round(region_worst_contrast(ground, boxes["support"], support_rgb), 2)
    contrast["logo_ground_luma"] = round(_lum(_mean(ground, boxes["logo"])), 3)

    out = io.BytesIO()
    canvas.convert("RGB").save(out, "JPEG", quality=92, optimize=True, subsampling=0)
    return RenderResult(jpeg=out.getvalue(), width=W, height=H, layout=layout, headline_lines=lines,
                        headline_size=size, support_lines=support_lines, boxes=boxes, contrast=contrast)


def _mean(img: Image.Image, box: Box) -> tuple[float, float, float]:
    stat = ImageStat.Stat(img.crop(box.xyxy).convert("RGB"))
    return tuple(stat.mean[:3])  # type: ignore[return-value]

