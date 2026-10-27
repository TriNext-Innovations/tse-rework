"""Spend ledger and budget enforcement.

Visual generation reserves its estimated cost *before* the provider call, in
the same transaction that checks the limit, under an advisory lock — so two
concurrent producers can never jointly overspend. Claude usage is recorded
after each call (the cost is only known then) and checked before the next.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import psycopg
from psycopg.types.json import Jsonb

from .config import LLM_PRICES, SAST


class BudgetExceeded(RuntimeError):
    pass


def month_start(now: datetime | None = None) -> datetime:
    now = (now or datetime.now(SAST)).astimezone(SAST)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_spend(conn: psycopg.Connection, category: str, now: datetime | None = None) -> Decimal:
    """Committed spend this SAST calendar month: actuals plus open reservations."""
    row = conn.execute(
        "SELECT coalesce(sum(amount_usd), 0) AS total FROM spend_ledger WHERE category = %s AND created_at >= %s",
        (category, month_start(now)),
    ).fetchone()
    return Decimal(row["total"])


def creative_visual_spend(conn: psycopg.Connection, assignment_id: int) -> Decimal:
    row = conn.execute(
        """SELECT coalesce(sum(l.amount_usd), 0) AS total FROM spend_ledger l
           WHERE l.category = 'visual' AND l.ref LIKE %s""",
        (f"assignment:{assignment_id}:%",),
    ).fetchone()
    return Decimal(row["total"])


def reserve_visual(conn: psycopg.Connection, *, settings: dict, assignment_id: int, job_ref: str,
                   provider: str, model: str, amount: float) -> None:
    """Reserve `amount` or raise BudgetExceeded. Call inside a transaction."""
    conn.execute("SELECT pg_advisory_xact_lock(hashtext('agency-budget-visual'))")
    amount_d = Decimal(str(amount))
    monthly = Decimal(str(settings["visual_budget_monthly_usd"]))
    per_post = Decimal(str(settings["visual_budget_per_post_usd"]))
    spent = month_spend(conn, "visual")
    if spent + amount_d > monthly:
        raise BudgetExceeded(f"monthly visual budget: spent/reserved ${spent:.2f} + ${amount_d:.3f} > ${monthly:.2f}")
    post_spent = creative_visual_spend(conn, assignment_id)
    if post_spent + amount_d > per_post:
        raise BudgetExceeded(f"per-post visual budget: ${post_spent:.3f} + ${amount_d:.3f} > ${per_post:.2f}")
    conn.execute(
        """INSERT INTO spend_ledger (category, provider, model, amount_usd, kind, ref)
           VALUES ('visual', %s, %s, %s, 'reservation', %s)""",
        (provider, model, amount_d, f"assignment:{assignment_id}:{job_ref}"),
    )


def release_visual(conn: psycopg.Connection, *, assignment_id: int, job_ref: str, provider: str,
                   model: str, amount: float, reason: str) -> None:
    """Return a reservation for a job that never ran (submit failed outright)."""
    conn.execute(
        """INSERT INTO spend_ledger (category, provider, model, amount_usd, kind, ref, detail)
           VALUES ('visual', %s, %s, %s, 'release', %s, %s)""",
        (provider, model, -Decimal(str(amount)), f"assignment:{assignment_id}:{job_ref}", Jsonb({"reason": reason})),
    )


def llm_cost(model: str, usage: dict) -> Decimal:
    inp, out, cache_read = LLM_PRICES.get(model, LLM_PRICES["claude-opus-5-5"])
    cost = (
        usage.get("input_tokens", 0) * inp
        + usage.get("cache_creation_input_tokens", 0) * inp * 1.25
        + usage.get("cache_read_input_tokens", 0) * cache_read
        + usage.get("output_tokens", 0) * out
    ) / 1_000_000
    return Decimal(str(round(cost, 5)))


def record_llm(conn: psycopg.Connection, *, model: str, stage: str, usage: dict, ref: str | None) -> Decimal:
    cost = llm_cost(model, usage)
    conn.execute(
        """INSERT INTO spend_ledger (category, provider, model, amount_usd, kind, ref, detail)
           VALUES ('llm', 'anthropic', %s, %s, 'actual', %s, %s)""",
        (model, cost, ref, Jsonb({"stage": stage, "usage": usage})),
    )
    return cost


def check_llm_budget(conn: psycopg.Connection, settings: dict) -> None:
    spent = month_spend(conn, "llm")
    limit = Decimal(str(settings["llm_budget_monthly_usd"]))
    if spent >= limit:
        raise BudgetExceeded(f"monthly Claude budget exhausted: ${spent:.2f} of ${limit:.2f}")
