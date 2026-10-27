"""HTTP API for n8n, the public media route Meta fetches from, and a small
review page for the controlled review period. Standard library only.

    GET  /healthz                    liveness (no auth)
    GET  /media/<key>                final assets, public (Meta must fetch them)
    *    /v1/...                     Bearer AGENCY_API_TOKEN
    GET  /review, POST /review/<id>  Basic auth, user "review", AGENCY_REVIEW_PASSWORD
"""

from __future__ import annotations

import base64
import hmac
import html
import json
import logging
import mimetypes
import os
import traceback
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import factcheck, ops, pipeline, publisher
from .app import build_ctx
from .config import Env
from .db import Database

log = logging.getLogger("agency")

ROUTES = {
    ("POST", "/v1/plan"): lambda ctx, body: {"planned": pipeline.ensure_planned(ctx)},
    ("POST", "/v1/cycle"): lambda ctx, body: pipeline.cycle(ctx, int(body.get("max_steps", 8))),
    ("POST", "/v1/publish"): lambda ctx, body: publisher.publish_due(ctx),
    ("POST", "/v1/recover"): lambda ctx, body: ops.recover(ctx),
    ("POST", "/v1/facts/verify"): lambda ctx, body: {"facts": factcheck.verify(ctx.db)},
    ("POST", "/v1/metrics/collect"): lambda ctx, body: ops.collect_metrics(ctx),
    ("POST", "/v1/report/weekly"): lambda ctx, body: ops.weekly_report(
        ctx, date.fromisoformat(body["week_start"]) if body.get("week_start") else None),
    ("GET", "/v1/health"): lambda ctx, body: ops.health(ctx),
    ("POST", "/v1/alerts/claim"): lambda ctx, body: {"alerts": ops.claim_alerts(ctx)},
    ("GET", "/v1/settings"): lambda ctx, body: ctx.db.settings(),
    ("GET", "/v1/upcoming"): lambda ctx, body: {"slots": ops.upcoming(ctx)},
}


class Handler(BaseHTTPRequestHandler):
    server_version = "tse-agency/1.0"
    env: Env
    db: Database

    # -- plumbing ---------------------------------------------------------------

    def _send(self, status: int, payload, content_type: str = "application/json") -> None:
        data = payload if isinstance(payload, bytes) else (
            payload.encode() if isinstance(payload, str) else json.dumps(payload, default=str).encode())
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        raw = self.rfile.read(min(n, 1_000_000))
        ctype = self.headers.get("Content-Type", "")
        if "application/x-www-form-urlencoded" in ctype:
            return {k: v[0] for k, v in parse_qs(raw.decode()).items()}
        return json.loads(raw or b"{}")

    def _bearer_ok(self) -> bool:
        token = self.env.api_token
        got = self.headers.get("Authorization", "")
        return bool(token) and hmac.compare_digest(got, f"Bearer {token}")

    def _basic_ok(self) -> bool:
        password = os.environ.get("AGENCY_REVIEW_PASSWORD", "")
        got = self.headers.get("Authorization", "")
        if not password or not got.startswith("Basic "):
            return False
        try:
            user, _, pw = base64.b64decode(got[6:]).decode().partition(":")
        except ValueError:
            return False
        return user == "review" and hmac.compare_digest(pw, password)

    def log_message(self, fmt, *args):  # route access logs through logging
        log.info("%s %s", self.address_string(), fmt % args)

    # -- verbs ------------------------------------------------------------------

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            try:
                self.db.one("SELECT 1")
                return self._send(200, {"ok": True})
            except Exception as exc:  # noqa: BLE001
                return self._send(503, {"ok": False, "error": str(exc)})
        if path.startswith("/media/"):
            return self._media(path[len("/media/"):])
        if path == "/review":
            if not self._basic_ok():
                return self._challenge()
            return self._send(200, review_page(build_ctx(self.env, self.db)), "text/html; charset=utf-8")
        return self._api("GET", path)

    def do_POST(self):
        path = urlparse(self.path).path
        if path.startswith("/review/"):
            if not self._basic_ok():
                return self._challenge()
            body = self._body()
            ctx = build_ctx(self.env, self.db)
            ops.review(ctx, int(path.rsplit("/", 1)[1]), body.get("decision", ""), body.get("note"), by="review-page")
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "../review")  # relative: works behind a path prefix
            self.end_headers()
            return
        return self._api("POST", path)

    def _challenge(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="TSE agency review"')
        self.end_headers()

    def _media(self, key: str):
        ctx_storage = build_ctx(self.env, self.db).storage
        try:
            path = ctx_storage.path(key)
        except ValueError:
            return self._send(404, {"error": "not found"})
        if not path.is_file() or not key.startswith("final/"):
            return self._send(404, {"error": "not found"})
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return self._send(200, path.read_bytes(), ctype)

    def _api(self, method: str, path: str):
        if not path.startswith("/v1/"):
            return self._send(404, {"error": "not found"})
        if not self._bearer_ok():
            return self._send(401, {"error": "unauthorised"})
        try:
            body = self._body() if method == "POST" else {}
            ctx = build_ctx(self.env, self.db)
            if method == "POST" and path == "/v1/settings":
                self.db.set_setting(body["key"], body["value"], by=body.get("by", "api"))
                return self._send(200, self.db.settings())
            if method == "POST" and path.startswith("/v1/review/"):
                return self._send(200, ops.review(ctx, int(path.rsplit("/", 1)[1]), body.get("decision", ""),
                                                  body.get("note"), by=body.get("by", "api")))
            handler = ROUTES.get((method, path))
            if handler is None:
                return self._send(404, {"error": "not found"})
            result = handler(ctx, body)
            return self._send(200, {"run_id": ctx.run_id, "result": result})
        except (KeyError, ValueError, LookupError) as exc:
            return self._send(400, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001 — surface to n8n as a failed request
            log.error("request failed: %s\n%s", exc, traceback.format_exc())
            try:
                self.db.event("api", "error", f"{method} {path} failed: {exc}")
            except Exception:  # noqa: BLE001
                pass
            return self._send(500, {"error": str(exc)})


def review_page(ctx) -> str:
    rows = ops.upcoming(ctx)
    h = ops.health(ctx)
    cards = []
    for r in rows:
        if not r["creative_id"]:
            cards.append(f"<article class='empty'><h3>{r['slot_at']:%a %d %b %H:%M}</h3><p>No approved creative yet "
                         f"({html.escape(r['slot_status'])}).</p></article>")
            continue
        img = ctx.storage.url(r["final_asset"]) if r["final_asset"] else ""
        pubs = ", ".join(f"{p['platform']}: {p['status']}" for p in (r["publications"] or [])) or "not yet published"
        decision = r["human_approval"] or "pending review"
        cards.append(f"""<article>
<h3>{r['slot_at']:%a %d %b %H:%M} · {html.escape(r['pillar'] or '')} · <span class="d {decision.split()[0]}">{decision}</span></h3>
<img src="{html.escape(img)}" alt="{html.escape(r['headline'] or '')}" loading="lazy">
<p class="meta">#{r['creative_id']} · {html.escape(r['territory'] or '')} · {r['layout']} · {r['model']} · vision {r['vision_score']} · {html.escape(pubs)}</p>
<details><summary>Captions</summary><h4>Facebook</h4><pre>{html.escape(r['caption_facebook'] or '')}</pre>
<h4>Instagram</h4><pre>{html.escape(r['caption_instagram'] or '')}</pre></details>
<form method="post" action="review/{r['creative_id']}"><input name="note" placeholder="Note (optional)">
<button name="decision" value="approved">Approve</button><button name="decision" value="rejected">Reject</button></form>
</article>""")
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TSE agency review</title><style>
body{{font:15px/1.5 system-ui,sans-serif;margin:0;background:#0a0a0a;color:#ededed}}
header{{padding:16px 20px;border-bottom:1px solid #2a2a2a}} main{{display:grid;gap:20px;padding:20px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}}
article{{background:#151515;border:1px solid #2a2a2a;border-radius:10px;padding:14px}} img{{width:100%;border-radius:6px}}
h3{{font-size:15px;margin:0 0 10px}} .meta{{color:#9a9a9a;font-size:13px}} pre{{white-space:pre-wrap;font:13px/1.45 system-ui}}
.d.approved{{color:#dfe344}} .d.rejected{{color:#f57272}} .d.pending{{color:#41e0f5}} .empty{{opacity:.6}}
form{{display:flex;gap:8px;flex-wrap:wrap}} input{{flex:1;min-width:120px;background:#0a0a0a;color:#ededed;border:1px solid #333;border-radius:6px;padding:6px}}
button{{background:#41e0f5;border:0;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer}} button[value=rejected]{{background:#333;color:#ededed}}
</style></head><body><header><strong>TSE creative agency</strong> · mode <b>{h['mode']}</b> (effective {h['effective_mode']})
{' · <b style="color:#f57272">PAUSED</b>' if h['paused'] else ''} · queue {h['queue']['days_covered']} days ·
visual ${h['spend_month_usd']['visual']}/{h['spend_month_usd']['visual_limit']} · Claude ${h['spend_month_usd']['claude']}</header>
<main>{''.join(cards) or '<p>Nothing scheduled.</p>'}</main></body></html>"""


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    env = Env.load()
    if not env.api_token or len(env.api_token) < 24:
        raise SystemExit("AGENCY_API_TOKEN must be set (24+ characters)")
    db = Database(env.database_url)
    db.migrate()
    Handler.env, Handler.db = env, db
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log.info("agency listening on %s:%s (live publishing %s)", host, port,
             "ENABLED" if env.live_publishing_enabled else "disabled")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
