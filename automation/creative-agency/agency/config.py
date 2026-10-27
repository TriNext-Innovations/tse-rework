"""Configuration: secrets and infrastructure from the environment, operating
switches from the `settings` table so they change without a redeploy."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
BRAND_DIR = ROOT / "brand"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
MIGRATIONS_DIR = ROOT / "migrations"
SAST = ZoneInfo("Africa/Johannesburg")


def _bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Env:
    database_url: str
    api_token: str
    anthropic_api_key: str | None
    fal_key: str | None
    meta_page_id: str | None
    meta_ig_user_id: str | None
    meta_page_token: str | None
    meta_graph_base: str
    meta_graph_version: str
    fal_queue_base: str
    media_dir: Path
    media_public_base_url: str
    site_url: str
    # Hard gate. Even with mode=autonomous in the database, nothing reaches
    # Meta's write endpoints unless the deployment itself opts in.
    live_publishing_enabled: bool
    # Medusa Store API, for product spotlights (publishable key: public by design).
    medusa_store_url: str | None
    medusa_publishable_key: str | None
    medusa_region_id: str | None
    # Offline mode: fakes stand in for Claude and fal (demo + tests).
    use_fakes: bool
    models: dict[str, str] = field(default_factory=dict)

    @classmethod
    def load(cls) -> "Env":
        default_model = os.environ.get("AGENCY_MODEL", "claude-opus-5-5")
        return cls(
            database_url=os.environ.get("DATABASE_URL", "postgresql://agency:agency@localhost:5432/agency"),
            api_token=os.environ.get("AGENCY_API_TOKEN", ""),
            anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
            fal_key=os.environ.get("FAL_KEY"),
            meta_page_id=os.environ.get("META_PAGE_ID"),
            meta_ig_user_id=os.environ.get("META_IG_USER_ID"),
            meta_page_token=os.environ.get("META_PAGE_TOKEN"),
            meta_graph_base=os.environ.get("META_GRAPH_BASE", "https://graph.facebook.com").rstrip("/"),
            meta_graph_version=os.environ.get("META_GRAPH_VERSION", "v25.0"),
            fal_queue_base=os.environ.get("FAL_QUEUE_BASE", "https://queue.fal.run").rstrip("/"),
            media_dir=Path(os.environ.get("MEDIA_DIR", str(ROOT / "var" / "media"))),
            media_public_base_url=os.environ.get("MEDIA_PUBLIC_BASE_URL", "http://localhost:8080/media").rstrip("/"),
            site_url=os.environ.get("SITE_URL", "https://www.tse.co.za").rstrip("/"),
            live_publishing_enabled=_bool("LIVE_PUBLISHING_ENABLED", False),
            medusa_store_url=os.environ.get("MEDUSA_STORE_URL"),
            medusa_publishable_key=os.environ.get("MEDUSA_PUBLISHABLE_KEY"),
            medusa_region_id=os.environ.get("MEDUSA_REGION_ID"),
            use_fakes=_bool("AGENCY_USE_FAKES", False),
            models={
                # Per-stage model choice. All default to Opus 5.5; the
                # strategist and director are where judgment matters most.
                "strategist": os.environ.get("MODEL_STRATEGIST", default_model),
                "copywriter": os.environ.get("MODEL_COPYWRITER", default_model),
                "director": os.environ.get("MODEL_DIRECTOR", default_model),
                "art_director": os.environ.get("MODEL_ART_DIRECTOR", default_model),
                "qc_vision": os.environ.get("MODEL_QC_VISION", default_model),
                "analyst": os.environ.get("MODEL_ANALYST", default_model),
            },
        )


# Runtime defaults, written to `settings` on first migrate. Operators change
# them with `agency set <key> <json>` or the /v1/settings endpoint.
DEFAULT_SETTINGS: dict[str, object] = {
    # dry_run: never calls Meta write endpoints.
    # review: publishes only creatives a human approved on /review.
    # autonomous: publishes anything that passed QC.
    "mode": "dry_run",
    "publishing_paused": False,
    "publish_times": ["08:00", "20:00"],
    "platforms": ["facebook", "instagram"],
    "queue_days": 7,
    "visual_budget_monthly_usd": 20.0,
    "visual_budget_per_post_usd": 0.35,
    "llm_budget_monthly_usd": 40.0,
    "max_concept_rounds": 2,
    "max_production_attempts": 3,
    "max_publish_attempts": 3,
    "publish_retry_window_hours": 6,
    "qc_min_vision_score": 7.0,
    "concepts_per_round": 4,
    "image_model": "fal-ai/flux-2-pro",
    "video_enabled": False,
    "utm_campaign_prefix": "tse-agency",
    "consecutive_failure_pause": 3,
    # Product spotlights: one real product every 4–5 posts, at random.
    "spotlight_gap_min": 4,
    "spotlight_gap_max": 5,
}

# fal.ai models the art director may pick from. Prices verified on
# fal.ai model pages 2026-10-27; `est_cost_usd` is what the budget reserves
# for one 4:5 feed image before the job runs.
IMAGE_MODELS: dict[str, dict[str, object]] = {
    "fal-ai/flux-2-pro": {
        "label": "FLUX.2 [pro] — photographic still life, precise lighting",
        # $0.03 first MP + $0.015 per extra MP, rounded up; 1088x1360 = 2 MP.
        "est_cost_usd": 0.045,
        "input": lambda prompt, seed: {
            "prompt": prompt,
            "image_size": {"width": 1088, "height": 1360},
            "output_format": "png",
            "safety_tolerance": 2,
            **({"seed": seed} if seed is not None else {}),
        },
    },
    "fal-ai/nano-banana-2": {
        "label": "Nano Banana 2 — complex staged scenes, strong prompt adherence",
        # $0.12 per image at 2K resolution.
        "est_cost_usd": 0.12,
        "input": lambda prompt, seed: {
            "prompt": prompt,
            "aspect_ratio": "4:5",
            "resolution": "2K",
            "output_format": "png",
            "num_images": 1,
            **({"seed": seed} if seed is not None else {}),
        },
    },
}

# Claude prices per million tokens (input, output, cache read). Used for the
# separate LLM cost ledger; verify against anthropic.com/pricing when models change.
LLM_PRICES: dict[str, tuple[float, float, float]] = {
    "claude-opus-5-5": (4.00, 20.00, 0.20),
    "claude-sonnet-5-5": (2.00, 10.00, 0.20),
    "claude-haiku-4-5": (1.00, 5.00, 0.10),
    "claude-fable-5-1": (10.00, 50.00, 0.25),
}

FEED_WIDTH, FEED_HEIGHT = 1080, 1350
