"""Test fixtures: a clean Postgres schema per test, the agency HTTP server for
/media, and fake fal/Graph servers. Needs a Postgres at TEST_DATABASE_URL
(default: the docker container from docs/OPERATIONS.md › Running the tests)."""

from __future__ import annotations

import os
import threading
from dataclasses import replace
from datetime import datetime, timedelta
from http.server import ThreadingHTTPServer
from pathlib import Path

import psycopg
import pytest

from agency.config import SAST, Env
from agency.db import Database
from agency.fakes import FakeFal, FakeLLM
from agency.imagegen import FalClient
from agency.pipeline import Ctx
from agency.server import Handler
from agency.storage import Storage
from tests.fakeservers import FalServer, GraphServer

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql://agency:agency@127.0.0.1:55432/agency")


@pytest.fixture
def db() -> Database:
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    d = Database(TEST_DB)
    d.migrate()
    return d


class Clock:
    def __init__(self, start: datetime):
        self.t = start

    def __call__(self) -> datetime:
        return self.t

    def advance(self, **kw) -> None:
        self.t += timedelta(**kw)


@pytest.fixture
def clock() -> Clock:
    # Wednesday 28 Oct 2026, 06:00 SAST — mid-week, so the current week has future slots.
    return Clock(datetime(2026, 10, 28, 6, 0, tzinfo=SAST))


@pytest.fixture
def media_server(tmp_path: Path, db: Database):
    env = replace(Env.load(), database_url=TEST_DB, media_dir=tmp_path / "media", api_token="t" * 32)
    Handler.env, Handler.db = env, db
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    yield base, env
    httpd.shutdown()
    httpd.server_close()


@pytest.fixture
def fal_server():
    s = FalServer()
    yield s
    s.close()


@pytest.fixture
def graph_server():
    s = GraphServer()
    yield s
    s.close()


@pytest.fixture
def make_ctx(db, clock, media_server, tmp_path):
    base, env = media_server

    def _make(*, llm=None, fal=None, live=False, graph: GraphServer | None = None, catalogue=None,
              **env_over) -> Ctx:
        e = replace(env, media_public_base_url=f"{base}/media", live_publishing_enabled=live,
                    meta_graph_base=graph.url if graph else env.meta_graph_base,
                    meta_page_id=graph.page_id if graph else None, meta_ig_user_id=graph.ig_id if graph else None,
                    meta_page_token="test-token" if graph else None, **env_over)
        Handler.env = e
        return Ctx(db=db, env=e, llm=llm or FakeLLM(db), fal=fal if fal is not None else FakeFal(),
                   storage=Storage(e.media_dir, e.media_public_base_url), now=clock, poll_seconds=2,
                   poll_interval=0.01, catalogue=catalogue)
    return _make


def fal_client(server: FalServer) -> FalClient:
    return FalClient("test-key", server.url)


def mark_facts_verified(db: Database) -> None:
    from agency.prompts import facts
    for f in facts()["facts"]:
        db.execute("INSERT INTO fact_checks (fact_id, ok) VALUES (%s, true) ON CONFLICT (fact_id) DO UPDATE SET ok = true, checked_at = now()",
                   (f["id"],))
