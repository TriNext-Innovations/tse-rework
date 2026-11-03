"""Live re-verification of the fact sheet against www.tse.co.za.

Each fact names the page and the exact words that prove it. If the words are
gone (the client changed a delivery fee, dropped a guarantee), the fact is
marked stale and any creative citing it is held back from publication.
A network failure never marks a fact stale — it leaves the last result.
"""

from __future__ import annotations

import html
import re
from collections.abc import Callable, Iterable

import httpx

from .db import Database
from .prompts import facts


def page_text(raw_html: str) -> str:
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw_html, flags=re.S | re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).replace("’", "'")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("’", "'")).strip().lower()


def verify(db: Database, only: Iterable[str] | None = None,
           fetch: Callable[[str], str] | None = None) -> dict[str, bool]:
    wanted = set(only) if only else None
    fetch = fetch or (lambda url: httpx.get(url, timeout=30, follow_redirects=True,
                                            headers={"User-Agent": "TSE-creative-agency/1.0"}).raise_for_status().text)
    pages: dict[str, str | None] = {}
    results: dict[str, bool] = {}
    for fact in facts()["facts"]:
        if wanted is not None and fact["id"] not in wanted:
            continue
        url = fact["source_url"]
        if url not in pages:
            try:
                pages[url] = _norm(page_text(fetch(url)))
            except Exception as exc:  # noqa: BLE001 — leave previous verdict in place
                pages[url] = None
                db.event("factcheck", "warn", f"could not fetch {url}: {exc}")
        text = pages[url]
        if text is None:
            continue
        ok = _norm(fact["evidence"]) in text
        results[fact["id"]] = ok
        db.execute(
            """INSERT INTO fact_checks (fact_id, ok, detail, checked_at) VALUES (%s, %s, %s, now())
               ON CONFLICT (fact_id) DO UPDATE SET ok = EXCLUDED.ok, detail = EXCLUDED.detail, checked_at = now()""",
            (fact["id"], ok, None if ok else f"evidence not found on {url}"),
        )
        if not ok and fact["status"] == "usable":
            db.event("factcheck", "alert", f"fact {fact['id']} no longer verifiable on {url}; creatives citing it are held",
                     {"fact": fact["id"]})
    return results


def unverified_recently(db: Database, fact_ids: Iterable[str], hours: int = 24) -> set[str]:
    ids = list(fact_ids)
    if not ids:
        return set()
    fresh = {r["fact_id"] for r in db.query(
        "SELECT fact_id FROM fact_checks WHERE fact_id = ANY(%s) AND ok AND checked_at > now() - make_interval(hours => %s)",
        (ids, hours))}
    return set(ids) - fresh
