"""`python -m agency demo` — an offline, end-to-end dry run.

Uses the fixture copywriter and a synthetic image provider, so it spends
nothing and needs no keys — only DATABASE_URL pointing at a *scratch*
database (it is reset). Runs: plan → develop → produce → QC → dry-run
publish of the first slots → a duplicate publish attempt, and writes a
contact sheet to var/demo/index.html.
"""

from __future__ import annotations

import html
import json
import os
import threading
from dataclasses import replace
from http.server import ThreadingHTTPServer
from pathlib import Path

import psycopg

from . import ops, pipeline, publisher
from .app import build_ctx
from .config import ROOT, Env
from .db import Database
from .server import Handler


def run_demo(slots: int) -> int:
    if os.environ.get("AGENCY_DEMO_RESET") != "yes":
        print("The demo RESETS the database at DATABASE_URL. Re-run with AGENCY_DEMO_RESET=yes on a scratch database.")
        return 2
    env = Env.load()
    with psycopg.connect(env.database_url, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    db = Database(env.database_url)
    db.migrate()
    out_dir = ROOT / "var" / "demo"
    env = replace(env, use_fakes=True, media_dir=out_dir / "media", api_token="demo" * 8,
                  live_publishing_enabled=False)

    Handler.env, Handler.db = env, db
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    env = replace(env, media_public_base_url=f"http://127.0.0.1:{httpd.server_address[1]}/media")
    Handler.env = env
    ctx = build_ctx(env, db)

    log = []
    print("1. planning")
    log.append({"plan": pipeline.ensure_planned(ctx)})
    print("2-4. develop → produce → QC")
    for _ in range(slots * 3):
        log.append(pipeline.cycle(ctx, 8))
        if db.one("SELECT count(*) AS n FROM creatives WHERE status = 'approved'")["n"] >= slots:
            break
    db.execute("INSERT INTO fact_checks (fact_id, ok) SELECT DISTINCT jsonb_array_elements_text(claims), true "
               "FROM concepts ON CONFLICT (fact_id) DO UPDATE SET ok = true, checked_at = now()")
    print("5. dry-run publish at each slot, then a duplicate attempt")
    for s in db.query("SELECT slot_at FROM schedule WHERE status = 'filled' ORDER BY slot_at LIMIT %s", (slots,)):
        ctx.now = lambda t=s["slot_at"]: t
        log.append({"publish": publisher.publish_due(ctx), "duplicate": publisher.publish_due(ctx)})
    httpd.shutdown()

    rows = db.query(
        """SELECT c.id, c.final_asset, c.caption_facebook, c.caption_instagram, c.layout, k.headline, k.territory,
                  a.slot_at, (SELECT json_agg(p.platform || ':' || p.status) FROM publications p WHERE p.creative_id = c.id) AS pubs
           FROM creatives c JOIN concepts k ON k.id = c.concept_id JOIN assignments a ON a.id = c.assignment_id
           WHERE c.status = 'approved' ORDER BY a.slot_at""")
    cards = "".join(
        f"<figure><img src='media/{html.escape(r['final_asset'])}'><figcaption><b>{html.escape(r['headline'])}</b>"
        f"<br>{r['slot_at']:%a %d %b %H:%M} · {r['layout']} · {html.escape(r['territory'])} · {r['pubs']}"
        f"<pre>{html.escape(r['caption_facebook'])}</pre></figcaption></figure>" for r in rows)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Agency demo (fixtures)</title><style>body{font:14px system-ui;"
        "background:#111;color:#eee;margin:20px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}"
        "img{width:100%}pre{white-space:pre-wrap;font:12px system-ui;color:#aaa}</style>"
        "<h1>TSE agency — offline demo</h1><p>Fixture copy and synthetic plates: this shows the machinery, not the "
        "creative quality. Dry run: nothing was sent to Meta.</p><main>" + cards + "</main>")
    (out_dir / "run.json").write_text(json.dumps(log, indent=2, default=str))
    pubs = db.query("SELECT platform, status, count(*) AS n FROM publications GROUP BY 1, 2 ORDER BY 1")
    print(json.dumps({"approved": len(rows), "publications": pubs, "health": ops.health(ctx)}, indent=2, default=str))
    print(f"contact sheet: {out_dir / 'index.html'}")
    return 0
