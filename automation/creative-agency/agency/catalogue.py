"""TSE's live product catalogue (Medusa Store API) — the only source of
product names, SKUs and prices a spotlight ad may show.

Prices are read when the ad is planned and read again just before it
publishes; a spotlight never goes out with a price the store doesn't show.
"""

from __future__ import annotations

import random
from dataclasses import asdict, dataclass

import httpx



class CatalogueError(RuntimeError):
    pass


@dataclass(frozen=True)
class Product:
    handle: str
    title: str
    sku: str
    brand: str
    cartridge_type: str  # laser | inkjet | ink (as the store records it)
    compatible: bool
    price_zar: float  # exact, incl. cents; never rounded for display or comparison

    def as_dict(self) -> dict:
        return asdict(self)

    @property
    def display_title(self) -> str:
        """Store titles of compatibles often lead with "Generic"; the eyebrow
        already says "Compatible", so the headline drops it."""
        t = self.title
        return t[len("Generic "):] if t.lower().startswith("generic ") else t

    @property
    def headline(self) -> str:
        return f"{self.display_title}."

    @property
    def price_label(self) -> str:
        cents = round(self.price_zar * 100)
        text = f"{cents // 100:,}".replace(",", " ")
        return f"R{text}" if cents % 100 == 0 else f"R{text}.{cents % 100:02d}"

    @property
    def eyebrow(self) -> str:
        kind = {"laser": "laser toner", "inkjet": "ink cartridge", "ink": "refill ink"}.get(self.cartridge_type, "cartridge")
        return f"{'Compatible' if self.compatible else 'Original'} {kind}"


class Catalogue:
    def __init__(self, base_url: str, publishable_key: str, region_id: str | None = None,
                 http: httpx.Client | None = None):
        self.base = base_url.rstrip("/")
        self.http = http or httpx.Client(timeout=30, headers={"x-publishable-api-key": publishable_key})
        self.region_id = region_id

    def _get(self, path: str, params: dict) -> dict:
        try:
            resp = self.http.get(f"{self.base}{path}", params=params)
        except httpx.HTTPError as exc:
            raise CatalogueError(f"store API unreachable: {exc}") from exc
        if resp.status_code != 200:
            raise CatalogueError(f"store API {path}: HTTP {resp.status_code} {resp.text[:200]}")
        return resp.json()

    def _region(self) -> str:
        if not self.region_id:
            regions = self._get("/store/regions", {}).get("regions", [])
            za = next((r for r in regions if r.get("currency_code") == "zar"), None)
            if not za:
                raise CatalogueError("no ZAR region in the store")
            self.region_id = za["id"]
        return self.region_id

    def _params(self, **extra) -> dict:
        return {"region_id": self._region(),
                "fields": "title,handle,metadata,variants.sku,*variants.calculated_price", **extra}

    @staticmethod
    def _product(p: dict) -> Product | None:
        variants = p.get("variants") or []
        if not variants:
            return None
        v = variants[0]
        price = (v.get("calculated_price") or {}).get("calculated_amount")
        meta = p.get("metadata") or {}
        if price is None or not v.get("sku") or not p.get("handle"):
            return None
        return Product(handle=p["handle"], title=p["title"].strip(), sku=v["sku"], brand=meta.get("brand") or "",
                       cartridge_type=meta.get("cartridge_type") or "", compatible=bool(meta.get("compatible")),
                       price_zar=round(float(price), 2))

    def all(self) -> list[Product]:
        out: list[Product] = []
        offset = 0
        while True:
            data = self._get("/store/products", self._params(limit=100, offset=offset))
            batch = data.get("products", [])
            out += [p for p in (self._product(x) for x in batch) if p]
            offset += len(batch)
            if not batch or offset >= data.get("count", 0):
                return out

    def get(self, handle: str) -> Product | None:
        data = self._get("/store/products", self._params(handle=handle))
        found = [p for p in (self._product(x) for x in data.get("products", [])) if p and p.handle == handle]
        return found[0] if found else None


def choose_products(candidates: list[Product], n: int, recent_handles: set[str], rng: random.Random,
                    recent_brands: list[str] | None = None) -> list[Product]:
    """Pick n spotlight products: compatibles with a price, not spotlighted
    recently, one brand at a time so a week never shows two of one brand."""
    pool = [p for p in candidates if p.compatible and p.price_zar > 0 and p.brand
            and p.handle not in recent_handles and p.cartridge_type in ("laser", "inkjet", "ink")]
    rng.shuffle(pool)
    chosen: list[Product] = []
    used_brands = set((recent_brands or [])[-2:])
    for p in pool:
        if len(chosen) == n:
            break
        if p.brand in used_brands:
            continue
        chosen.append(p)
        used_brands.add(p.brand)
    for p in pool:  # fewer brands than slots: relax the brand rule
        if len(chosen) == n:
            break
        if p not in chosen:
            chosen.append(p)
    return chosen


def spotlight_indexes(n_slots: int, slots_since_last: int, rng: random.Random, gap_min: int, gap_max: int) -> list[int]:
    """Which of this week's slots are product spotlights: one every gap_min..gap_max
    posts at random, continuing the rhythm from the previous week."""
    out = []
    pos = rng.randint(gap_min, gap_max) - slots_since_last - 1
    pos = max(pos, 0)
    while pos < n_slots:
        out.append(pos)
        pos += rng.randint(gap_min, gap_max)
    return out


