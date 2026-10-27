"""Postgres access: connections, migrations, settings and the event log."""

from __future__ import annotations

import contextlib
import json
from collections.abc import Iterator
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .config import DEFAULT_SETTINGS, MIGRATIONS_DIR


class Database:
    def __init__(self, url: str):
        self.url = url

    def connect(self) -> psycopg.Connection:
        return psycopg.connect(self.url, row_factory=dict_row, autocommit=False)

    @contextlib.contextmanager
    def tx(self) -> Iterator[psycopg.Connection]:
        """One transaction: commit on success, roll back on any exception."""
        conn = self.connect()
        try:
            with conn.transaction():
                yield conn
        finally:
            conn.close()

    def query(self, sql: str, params: tuple | dict | None = None) -> list[dict[str, Any]]:
        with self.tx() as conn:
            return conn.execute(sql, params).fetchall()

    def one(self, sql: str, params: tuple | dict | None = None) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def execute(self, sql: str, params: tuple | dict | None = None) -> None:
        with self.tx() as conn:
            conn.execute(sql, params)

    # -- migrations -----------------------------------------------------------

    def migrate(self) -> list[str]:
        applied: list[str] = []
        with self.tx() as conn:
            # Serialise concurrent migrators (two containers starting at once).
            conn.execute("SELECT pg_advisory_xact_lock(hashtext('agency-migrate'))")
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
            )
            done = {r["version"] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
            for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
                if path.stem in done:
                    continue
                conn.execute(path.read_text())
                conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (path.stem,))
                applied.append(path.stem)
            for key, value in DEFAULT_SETTINGS.items():
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING",
                    (key, Jsonb(value)),
                )
        return applied

    # -- settings ---------------------------------------------------------------

    def settings(self) -> dict[str, Any]:
        rows = self.query("SELECT key, value FROM settings")
        merged = dict(DEFAULT_SETTINGS)
        merged.update({r["key"]: r["value"] for r in rows})
        return merged

    def setting(self, key: str) -> Any:
        return self.settings()[key]

    def set_setting(self, key: str, value: Any, by: str = "operator") -> None:
        if key not in DEFAULT_SETTINGS:
            raise KeyError(f"unknown setting {key!r}")
        validate_setting(key, value)
        self.execute(
            """INSERT INTO settings (key, value, updated_by) VALUES (%s, %s, %s)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by""",
            (key, Jsonb(value), by),
        )
        self.event("settings", "warn" if key in {"mode", "publishing_paused"} else "info",
                   f"setting {key} = {json.dumps(value)}", {"by": by})

    # -- events -----------------------------------------------------------------

    def event(self, stage: str, level: str, message: str, data: dict | None = None,
              run_id: str | None = None, conn: psycopg.Connection | None = None) -> None:
        sql = "INSERT INTO events (run_id, stage, level, message, data) VALUES (%s, %s, %s, %s, %s)"
        params = (run_id, stage, level, message, Jsonb(data) if data is not None else None)
        if conn is not None:
            conn.execute(sql, params)
        else:
            self.execute(sql, params)


def validate_setting(key: str, value: Any) -> None:
    default = DEFAULT_SETTINGS[key]
    if key == "mode" and value not in {"dry_run", "review", "autonomous"}:
        raise ValueError("mode must be dry_run, review or autonomous")
    if key == "platforms" and (not isinstance(value, list) or not set(value) <= {"facebook", "instagram"} or not value):
        raise ValueError("platforms must be a non-empty subset of [facebook, instagram]")
    if key == "publish_times":
        if not isinstance(value, list) or not value:
            raise ValueError("publish_times must be a non-empty list of HH:MM")
        for t in value:
            hh, mm = str(t).split(":")
            if not (0 <= int(hh) < 24 and 0 <= int(mm) < 60):
                raise ValueError(f"bad time {t}")
    if key in ("spotlight_gap_min", "spotlight_gap_max") and (not isinstance(value, int) or value < 2):
        raise ValueError(f"{key} must be a whole number of posts, 2 or more")
    if isinstance(default, bool) and not isinstance(value, bool):
        raise ValueError(f"{key} must be true/false")
    if isinstance(default, (int, float)) and not isinstance(default, bool):
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{key} must be a non-negative number")
