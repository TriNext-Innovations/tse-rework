"""HTTP-level tests: auth, CSRF guard on the review form, media exposure."""

from __future__ import annotations

import base64

import httpx
import pytest

from agency import pipeline

BASIC = "Basic " + base64.b64encode(b"review:pw-for-tests").decode()


@pytest.fixture
def server(media_server, make_ctx, monkeypatch):
    monkeypatch.setenv("AGENCY_REVIEW_PASSWORD", "pw-for-tests")
    base, env = media_server
    ctx = make_ctx()
    pipeline.ensure_planned(ctx)
    for _ in range(3):
        pipeline.cycle(ctx, 8)
    cid = ctx.db.one("SELECT id FROM creatives WHERE status = 'approved' ORDER BY id LIMIT 1")["id"]
    return base, ctx, cid


def test_api_requires_bearer(server):
    base, ctx, _ = server
    assert httpx.get(f"{base}/v1/health").status_code == 401
    assert httpx.get(f"{base}/v1/health", headers={"Authorization": "Bearer nope"}).status_code == 401
    ok = httpx.get(f"{base}/v1/health", headers={"Authorization": f"Bearer {ctx.env.api_token}"})
    assert ok.status_code == 200 and ok.json()["result"]["mode"] == "dry_run"


def test_api_bad_input_is_400_and_reviewer_name_fixed(server):
    base, ctx, cid = server
    h = {"Authorization": f"Bearer {ctx.env.api_token}"}
    assert httpx.post(f"{base}/v1/settings", headers=h, json={"key": "mode", "value": "yolo"}).status_code == 400
    r = httpx.post(f"{base}/v1/review/{cid}", headers=h, json={"decision": "approved", "by": "someone-else"})
    assert r.status_code == 200
    who = ctx.db.one("SELECT findings FROM qc_reviews WHERE kind = 'human'")["findings"][0]["by"]
    assert who == "api"


def test_review_page_needs_password(server):
    base, _, _ = server
    assert httpx.get(f"{base}/review").status_code == 401
    page = httpx.get(f"{base}/review", headers={"Authorization": BASIC})
    assert page.status_code == 200 and "Approve" in page.text


def test_review_form_refuses_cross_site_post(server):
    base, ctx, cid = server
    host = base.removeprefix("http://")
    form = {"decision": "approved"}
    evil = httpx.post(f"{base}/review/{cid}", data=form, headers={"Authorization": BASIC, "Origin": "https://evil.example"})
    assert evil.status_code == 403
    missing = httpx.post(f"{base}/review/{cid}", data=form, headers={"Authorization": BASIC})
    assert missing.status_code == 403
    assert ctx.db.one("SELECT human_approval FROM creatives WHERE id = %s", (cid,))["human_approval"] is None
    ok = httpx.post(f"{base}/review/{cid}", data=form, headers={"Authorization": BASIC, "Origin": f"http://{host}"})
    assert ok.status_code == 303 and ok.headers["location"] == "../review"
    assert ctx.db.one("SELECT human_approval FROM creatives WHERE id = %s", (cid,))["human_approval"] == "approved"


@pytest.mark.parametrize("path,body", [("/review/abc", {"decision": "approved"}),
                                       ("/review/999999", {"decision": "approved"}),
                                       ("/review/1", {"decision": "maybe"})])
def test_review_form_bad_input_is_400(server, path, body):
    base, _, _ = server
    host = base.removeprefix("http://")
    r = httpx.post(f"{base}{path}", data=body, headers={"Authorization": BASIC, "Origin": f"http://{host}"})
    assert r.status_code == 400


def test_media_serves_only_final_assets(server):
    base, ctx, cid = server
    cr = ctx.db.one("SELECT final_asset, raw_asset FROM creatives WHERE id = %s", (cid,))
    r = httpx.get(f"{base}/media/{cr['final_asset']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert httpx.get(f"{base}/media/{cr['raw_asset']}").status_code == 404
    for evil in ("final/../plates/x.png", "..%2F..%2Fetc%2Fpasswd", "final/%2e%2e/%2e%2e/etc/passwd"):
        assert httpx.get(f"{base}/media/{evil}").status_code == 404


def test_non_ascii_auth_header_is_401_not_a_crash(server):
    import http.client
    base, _, _ = server
    host, port = base.removeprefix("http://").split(":")
    for path, value in (("/v1/health", "Bearer tést"), ("/review", "Basic " + base64.b64encode("review:pé".encode()).decode())):
        conn = http.client.HTTPConnection(host, int(port))
        conn.putrequest("GET", path)
        conn.putheader("Authorization", value.encode("latin-1"))
        conn.endheaders()
        assert conn.getresponse().status == 401


def test_healthz_does_not_leak_connection_details(media_server, monkeypatch):
    from agency.server import Handler
    base, _ = media_server
    monkeypatch.setattr(Handler.db, "url", "postgresql://agency:secret@127.0.0.1:1/agency")
    r = httpx.get(f"{base}/healthz")
    assert r.status_code == 503 and r.json() == {"ok": False}


def _raw_get(base: str, raw_path: str) -> int:
    """Send the path byte-for-byte (clients normalise '..' otherwise)."""
    import socket
    host, port = base.removeprefix("http://").split(":")
    with socket.create_connection((host, int(port))) as sock:
        sock.sendall(f"GET {raw_path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n".encode())
        data = b""
        while chunk := sock.recv(65536):  # read to EOF so the server isn't reset mid-write
            data += chunk
        return int(data.split()[1])


def test_media_dot_segments_cannot_reach_plates(server):
    base, ctx, cid = server
    raw = ctx.db.one("SELECT raw_asset FROM creatives WHERE id = %s", (cid,))["raw_asset"]
    assert _raw_get(base, f"/media/final/../{raw}") == 404
    assert _raw_get(base, "/media/final/../../../../etc/passwd") == 404
    final = ctx.db.one("SELECT final_asset FROM creatives WHERE id = %s", (cid,))["final_asset"]
    assert _raw_get(base, f"/media/{final}") == 200


def test_non_object_json_body_is_400(server):
    base, ctx, _ = server
    r = httpx.post(f"{base}/v1/settings", headers={"Authorization": f"Bearer {ctx.env.api_token}"}, json=[1, 2])
    assert r.status_code == 400
