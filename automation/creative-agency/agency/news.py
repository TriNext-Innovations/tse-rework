"""South African headlines for topical posts (Google News RSS, ZA edition).

Only headlines, sources and dates are read: enough for the news editor stage
to see what the country is talking about this week. Nothing here is a fact
the ads may state; a topical post only winks at the story.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

import httpx

FEEDS = {
    "top": "https://news.google.com/rss?hl=en-ZA&gl=ZA&ceid=ZA:en",
    "nation": "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-ZA&gl=ZA&ceid=ZA:en",
    "sport": "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-ZA&gl=ZA&ceid=ZA:en",
    "entertainment": "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-ZA&gl=ZA&ceid=ZA:en",
}


class NewsError(RuntimeError):
    pass


@dataclass(frozen=True)
class Headline:
    section: str
    title: str
    source: str
    published: str  # ISO 8601

    def as_dict(self) -> dict:
        return asdict(self)


def parse_rss(xml: str, section: str) -> list[Headline]:
    out = []
    for item in ET.fromstring(xml).iter("item"):
        title = (item.findtext("title") or "").strip()
        source = (item.findtext("source") or "").strip()
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3]
        try:
            published = parsedate_to_datetime(item.findtext("pubDate") or "").isoformat()
        except (TypeError, ValueError):
            published = ""
        if title:
            out.append(Headline(section, title, source, published))
    return out


class NewsFeed:
    def __init__(self, http: httpx.Client | None = None, feeds: dict[str, str] | None = None):
        self.http = http or httpx.Client(timeout=20, headers={"User-Agent": "Mozilla/5.0 (tse-agency)"},
                                         follow_redirects=True)
        self.feeds = feeds or FEEDS

    def headlines(self, now: datetime, max_age: timedelta = timedelta(days=3), per_section: int = 15) -> list[Headline]:
        """Recent headlines from every section; raises NewsError only if all feeds fail."""
        out, errors = [], []
        for section, url in self.feeds.items():
            try:
                resp = self.http.get(url)
                resp.raise_for_status()
                items = parse_rss(resp.text, section)
            except (httpx.HTTPError, ET.ParseError) as exc:
                errors.append(f"{section}: {exc}")
                continue
            fresh = [h for h in items if not h.published or datetime.fromisoformat(h.published) > now - max_age]
            out.extend(fresh[:per_section])
        if not out and errors:
            raise NewsError("; ".join(errors))
        return out
