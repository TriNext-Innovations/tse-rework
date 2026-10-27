"""Local HTTP servers that mimic fal.ai's queue API and Meta's Graph API
closely enough to exercise the real HTTP clients, including failure modes."""

from __future__ import annotations

import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from agency.fakes import synthetic_plate


class _Server:
    def __init__(self, handler_cls):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
        self.httpd.owner = self  # type: ignore[attr-defined]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class _Base(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    @property
    def owner(self):
        return self.server.owner  # type: ignore[attr-defined]

    def _json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


# -- fal ------------------------------------------------------------------------

class FalServer(_Server):
    def __init__(self, polls_until_done: int = 2, submit_status: int = 200, result_status: int = 200):
        self.polls_until_done = polls_until_done
        self.submit_status = submit_status
        self.result_status = result_status
        self.jobs: dict[str, dict] = {}
        self.submits: list[dict] = []
        self.auth_headers: list[str] = []
        super().__init__(FalHandler)


class FalHandler(_Base):
    def do_POST(self):
        o = self.owner
        o.auth_headers.append(self.headers.get("Authorization", ""))
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        model = urlparse(self.path).path.strip("/")
        if o.submit_status != 200:
            return self._json(o.submit_status, {"detail": "fake failure"})
        rid = uuid.uuid4().hex
        o.jobs[rid] = {"polls": 0, "model": model, "input": body}
        o.submits.append({"model": model, "input": body})
        base = f"{o.url}/{model}/requests/{rid}"
        return self._json(200, {"request_id": rid, "status_url": f"{base}/status", "response_url": base,
                                "cancel_url": f"{base}/cancel", "queue_position": 0})

    def do_GET(self):
        o = self.owner
        path = urlparse(self.path).path
        if path.startswith("/images/"):
            data = synthetic_plate(7)
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        rid = path.split("/requests/")[1].split("/")[0]
        job = o.jobs[rid]
        if path.endswith("/status"):
            job["polls"] += 1
            status = "COMPLETED" if job["polls"] >= o.polls_until_done else "IN_PROGRESS"
            return self._json(200, {"status": status, "request_id": rid})
        if o.result_status != 200:
            return self._json(o.result_status, {"detail": "fake result failure"})
        return self._json(200, {"images": [{"url": f"{o.url}/images/{rid}.png", "width": 1088, "height": 1360}],
                                "seed": 1})


# -- Meta Graph -------------------------------------------------------------------

class GraphServer(_Server):
    """Behaviour switches:
    ig_error: return a permanent error on IG container creation.
    fb_transient: return a transient (code 2) error on the next N FB posts.
    fb_drop_after_post: create the FB post, then close the socket without
                        replying — the classic "did it post?" crash.
    """

    def __init__(self, version: str = "v25.0", page_id: str = "PAGE1", ig_id: str = "IG1"):
        self.version, self.page_id, self.ig_id = version, page_id, ig_id
        self.fb_posts: list[dict] = []
        self.ig_containers: dict[str, dict] = {}
        self.ig_media: list[dict] = []
        self.ig_error = False
        self.fb_transient = 0
        self.fb_drop_after_post = False
        self.tokens: set[str] = set()
        super().__init__(GraphHandler)


class GraphHandler(_Base):
    def _parts(self):
        u = urlparse(self.path)
        parts = u.path.strip("/").split("/")
        assert parts[0] == self.owner.version, parts
        return parts[1:], parse_qs(u.query)

    def do_POST(self):
        o = self.owner
        parts, _ = self._parts()
        form = {k: v[0] for k, v in parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode()).items()}
        o.tokens.add(form.get("access_token", ""))
        if parts == [o.page_id, "photos"]:
            if o.fb_transient:
                o.fb_transient -= 1
                return self._json(500, {"error": {"message": "temporary", "code": 2, "is_transient": True}})
            pid = f"{o.page_id}_{len(o.fb_posts) + 1}"
            o.fb_posts.append({"id": pid, "message": form["caption"], "url": form["url"]})
            if o.fb_drop_after_post:
                o.fb_drop_after_post = False
                self.close_connection = True
                self.connection.shutdown(2)
                return
            return self._json(200, {"id": f"photo{len(o.fb_posts)}", "post_id": pid})
        if parts == [o.ig_id, "media"]:
            if o.ig_error:
                return self._json(400, {"error": {"message": "Media download failed", "code": 9004,
                                                  "error_subcode": 2207052}})
            cid = f"C{len(o.ig_containers) + 1}"
            o.ig_containers[cid] = {"status": "FINISHED", "caption": form["caption"], "image_url": form["image_url"]}
            return self._json(200, {"id": cid})
        if parts == [o.ig_id, "media_publish"]:
            c = o.ig_containers.get(form["creation_id"])
            if not c or c["status"] == "PUBLISHED":
                return self._json(400, {"error": {"message": "container already published or unknown", "code": 100}})
            c["status"] = "PUBLISHED"
            mid = f"M{len(o.ig_media) + 1}"
            o.ig_media.append({"id": mid, "caption": c["caption"]})
            return self._json(200, {"id": mid})
        return self._json(404, {"error": {"message": f"unknown {parts}", "code": 803}})

    def do_GET(self):
        o = self.owner
        parts, q = self._parts()
        if parts == [o.page_id, "published_posts"]:
            return self._json(200, {"data": list(reversed(o.fb_posts))})
        if parts == [o.ig_id, "media"]:
            return self._json(200, {"data": list(reversed(o.ig_media))})
        if len(parts) == 1 and parts[0] in o.ig_containers:
            return self._json(200, {"status_code": o.ig_containers[parts[0]]["status"], "id": parts[0]})
        if len(parts) == 1 and parts[0].startswith(o.page_id + "_"):
            return self._json(200, {"id": parts[0], "permalink_url": f"https://facebook.example/{parts[0]}"})
        if len(parts) == 1 and parts[0].startswith("M"):
            return self._json(200, {"id": parts[0], "permalink": f"https://instagram.example/p/{parts[0]}"})
        return self._json(404, {"error": {"message": "not found", "code": 803}})
