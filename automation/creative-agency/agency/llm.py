"""Claude access for the agent stages.

Each call is one structured-output request, recorded in the spend ledger
with its token usage. The system prompt (stage instructions + brand book +
facts) is cached; per-call context goes in the user turn.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel

from .budget import check_llm_budget, record_llm
from .db import Database
from .prompts import PROMPT_VERSION, system_prompt

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    pass


@dataclass
class Image:
    data: bytes
    media_type: str = "image/jpeg"


class LLM(Protocol):
    def run(self, stage: str, schema: type[T], user: str, *, images: list[Image] | None = None,
            ref: str | None = None) -> T: ...


class ClaudeLLM:
    def __init__(self, db: Database, api_key: str, models: dict[str, str], effort: dict[str, str] | None = None):
        import anthropic

        self._anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=api_key, max_retries=3, timeout=600)
        self.db = db
        self.models = models
        # Effort per stage. Ideas and judgment get high; mechanical stages medium.
        self.effort = effort or {
            "strategist": "high", "copywriter": "high", "director": "high",
            "art_director": "medium", "qc_vision": "medium", "analyst": "medium",
        }

    def run(self, stage: str, schema: type[T], user: str, *, images: list[Image] | None = None,
            ref: str | None = None) -> T:
        settings = self.db.settings()
        with self.db.tx() as conn:
            check_llm_budget(conn, settings)
        model = self.models[stage]
        content: list[dict[str, Any]] = []
        for img in images or []:
            content.append({"type": "image", "source": {
                "type": "base64", "media_type": img.media_type,
                "data": base64.b64encode(img.data).decode()}})
        content.append({"type": "text", "text": user})
        try:
            response = self.client.beta.messages.parse(
                model=model,
                max_tokens=16000,
                system=[{"type": "text", "text": system_prompt(stage),
                         "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": content}],
                thinking={"type": "adaptive"},
                output_config={"effort": self.effort.get(stage, "medium")},
                output_format=schema,
                # A refused request re-runs server-side on Anthropic's
                # recommended fallback instead of failing the stage.
                fallbacks="default",
                betas=["server-side-fallback-2026-07-01"],
                metadata={"user_id": "tse-creative-agency"},
            )
        except self._anthropic.RateLimitError as exc:
            raise LLMError(f"{stage}: rate limited ({exc})") from exc
        except self._anthropic.APIStatusError as exc:
            raise LLMError(f"{stage}: API {exc.status_code}: {exc.message}") from exc
        except self._anthropic.APIConnectionError as exc:
            raise LLMError(f"{stage}: connection error ({exc})") from exc

        usage = response.usage.model_dump() if response.usage else {}
        with self.db.tx() as conn:
            record_llm(conn, model=model, stage=stage, ref=ref, usage={
                k: usage.get(k) or 0 for k in
                ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")})
        if response.stop_reason == "refusal":
            raise LLMError(f"{stage}: refused ({getattr(response, 'stop_details', None)})")
        if response.stop_reason == "max_tokens":
            raise LLMError(f"{stage}: hit max_tokens before finishing")
        parsed = response.parsed_output
        if parsed is None:
            raise LLMError(f"{stage}: no structured output returned")
        return parsed


__all__ = ["LLM", "ClaudeLLM", "Image", "LLMError", "PROMPT_VERSION"]
