"""Wiring: build a pipeline context from the environment."""

from __future__ import annotations

from .config import Env
from .db import Database
from .imagegen import FalClient
from .llm import ClaudeLLM, LLMError
from .pipeline import Ctx
from .storage import Storage

_fake_fal = None


class UnconfiguredLLM:
    def run(self, stage, schema, user, *, images=None, ref=None):
        raise LLMError("ANTHROPIC_API_KEY is not configured")


def build_ctx(env: Env | None = None, db: Database | None = None) -> Ctx:
    global _fake_fal
    env = env or Env.load()
    db = db or Database(env.database_url)
    storage = Storage(env.media_dir, env.media_public_base_url)
    if env.use_fakes:
        from .fakes import FakeFal, FakeLLM

        _fake_fal = _fake_fal or FakeFal()
        return Ctx(db=db, env=env, llm=FakeLLM(db), fal=_fake_fal, storage=storage, poll_interval=0)
    llm = ClaudeLLM(db, env.anthropic_api_key, env.models) if env.anthropic_api_key else UnconfiguredLLM()
    fal = FalClient(env.fal_key, env.fal_queue_base) if env.fal_key else None
    return Ctx(db=db, env=env, llm=llm, fal=fal, storage=storage)
