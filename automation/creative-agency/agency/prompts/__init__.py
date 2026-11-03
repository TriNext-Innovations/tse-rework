"""Versioned agent instructions. Bump PROMPT_VERSION on any edit to a stage
file, the brand book or the facts: every concept and campaign records the
version that produced it, so performance can be compared across versions."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from ..config import BRAND_DIR

PROMPT_VERSION = "2026-10-27.2"
_HERE = Path(__file__).resolve().parent

# Stages that need the full fact sheet; QC and the analyst get it too, so
# they can catch a claim the copywriter should not have made.
_STAGES = {"strategist", "copywriter", "director", "art_director", "qc_vision", "analyst"}


def facts() -> dict:
    return json.loads((BRAND_DIR / "verified_facts.json").read_text())


def usable_fact_ids() -> set[str]:
    return {f["id"] for f in facts()["facts"] if f["status"] == "usable"}


def facts_block() -> str:
    data = facts()
    lines = ["## Verified facts (the only claims you may make)", ""]
    for f in data["facts"]:
        if f["status"] != "usable":
            continue
        line = f"- `{f['id']}`: {f['statement']}"
        if f.get("rule"):
            line += f" RULE: {f['rule']}"
        lines.append(line)
    lines += ["", "## Restricted — never state these", ""]
    lines += [f"- {f['statement']} ({f['rule']})" for f in data["facts"] if f["status"] != "usable"]
    lines += ["", "## Never", ""] + [f"- {n}" for n in data["never"]]
    return "\n".join(lines)


@cache
def system_prompt(stage: str) -> str:
    if stage not in _STAGES:
        raise KeyError(stage)
    stage_text = (_HERE / f"{stage}.md").read_text()
    brand = (BRAND_DIR / "brand_book.md").read_text()
    return f"{stage_text}\n\n---\n\n{brand}\n\n---\n\n{facts_block()}\n"
