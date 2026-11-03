"""Meta Graph API: Facebook Page photo posts and Instagram content publishing.

Endpoints as documented (Graph API v25/v26, checked 2026-10-27):
- Facebook:  POST /{page-id}/photos  url, caption, published  -> {id, post_id}
             (shape already proven live by the existing TSE workflows)
- Instagram: POST /{ig-user-id}/media  image_url, caption      -> {id}  (container)
             GET  /{container-id}?fields=status_code           -> FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED
             POST /{ig-user-id}/media_publish  creation_id     -> {id}  (media id)
Instagram accepts JPEG only and allows 100 API posts per rolling 24 h.
"""

from __future__ import annotations

import time

import httpx

# Graph error codes that mean "try again later" rather than "this will never work".
TRANSIENT_CODES = {1, 2, 4, 17, 32, 341, 368, 613, 80001, 80002}
AUTH_CODES = {102, 190, 200, 10}


class MetaError(RuntimeError):
    def __init__(self, message: str, *, code: int | None = None, retryable: bool = False,
                 auth: bool = False, payload: dict | None = None):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.auth = auth
        self.payload = payload or {}


class GraphClient:
    def __init__(self, *, base_url: str, version: str, page_id: str, ig_user_id: str | None,
                 token: str, timeout: float = 60.0):
        self.base = f"{base_url.rstrip('/')}/{version}"
        self.page_id = page_id
        self.ig_user_id = ig_user_id
        self.token = token
        # The token travels in a header, never the URL: request lines get logged.
        self.http = httpx.Client(timeout=timeout, headers={"Authorization": f"Bearer {token}"})

    # -- transport -------------------------------------------------------------

    def _call(self, method: str, path: str, data: dict | None = None, params: dict | None = None) -> dict:
        url = f"{self.base}/{path.lstrip('/')}"
        try:
            if method == "POST":
                resp = self.http.post(url, data=data or {})
            else:
                resp = self.http.get(url, params=params or {})
        except httpx.HTTPError as exc:
            # The request may or may not have reached Meta: callers treat a
            # write that fails this way as "unknown", never as "not posted".
            raise MetaError(f"{method} {path}: transport error {exc}", retryable=True) from exc
        try:
            body = resp.json()
        except ValueError:
            body = {"raw": resp.text[:500]}
        if resp.status_code >= 400 or "error" in body:
            err = body.get("error", {}) if isinstance(body, dict) else {}
            code = err.get("code")
            transient = bool(err.get("is_transient")) or code in TRANSIENT_CODES or resp.status_code >= 500
            raise MetaError(
                f"{method} {path}: {resp.status_code} code={code} {err.get('message') or body}",
                code=code, retryable=transient, auth=code in AUTH_CODES, payload=body)
        return body

    # -- Facebook ----------------------------------------------------------------

    def facebook_photo(self, image_url: str, caption: str) -> dict:
        body = self._call("POST", f"{self.page_id}/photos",
                          {"url": image_url, "caption": caption, "published": "true"})
        if not body.get("post_id") and not body.get("id"):
            raise MetaError(f"facebook photo: no id in response {body}", payload=body)
        return body

    def facebook_post(self, post_id: str) -> dict:
        return self._call("GET", post_id, params={"fields": "id,permalink_url,created_time,is_published"})

    def facebook_recent(self, limit: int = 15) -> list[dict]:
        body = self._call("GET", f"{self.page_id}/published_posts",
                          params={"fields": "id,message,created_time,permalink_url", "limit": limit})
        return body.get("data", [])

    # -- Instagram ---------------------------------------------------------------

    def _ig(self) -> str:
        if not self.ig_user_id:
            raise MetaError("Instagram user id not configured")
        return self.ig_user_id

    def instagram_container(self, image_url: str, caption: str) -> str:
        body = self._call("POST", f"{self._ig()}/media", {"image_url": image_url, "caption": caption})
        if not body.get("id"):
            raise MetaError(f"instagram container: no id {body}", payload=body)
        return body["id"]

    def instagram_container_status(self, container_id: str) -> str:
        return self._call("GET", container_id, params={"fields": "status_code"}).get("status_code", "UNKNOWN")

    def wait_for_container(self, container_id: str, timeout_s: float = 90, interval_s: float = 3) -> str:
        deadline = time.monotonic() + timeout_s
        status = "UNKNOWN"
        while time.monotonic() < deadline:
            status = self.instagram_container_status(container_id)
            if status in {"FINISHED", "PUBLISHED", "ERROR", "EXPIRED"}:
                return status
            time.sleep(interval_s)
        return status

    def instagram_publish(self, container_id: str) -> str:
        body = self._call("POST", f"{self._ig()}/media_publish", {"creation_id": container_id})
        if not body.get("id"):
            raise MetaError(f"instagram publish: no id {body}", payload=body)
        return body["id"]

    def instagram_media(self, media_id: str) -> dict:
        return self._call("GET", media_id, params={"fields": "id,permalink,timestamp,caption"})

    def instagram_recent(self, limit: int = 15) -> list[dict]:
        body = self._call("GET", f"{self._ig()}/media", params={"fields": "id,caption,timestamp,permalink", "limit": limit})
        return body.get("data", [])

    # -- insights (best effort: metric names change between Graph versions) ------

    def facebook_metrics(self, post_id: str) -> dict:
        out: dict = {}
        out["post"] = self._call("GET", post_id, params={
            "fields": "shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)"})
        try:
            out["insights"] = self._call("GET", f"{post_id}/insights", params={
                "metric": "post_impressions_unique,post_clicks_by_type"})
        except MetaError as exc:
            out["insights_error"] = str(exc)
        return out

    def instagram_metrics(self, media_id: str) -> dict:
        try:
            return {"insights": self._call("GET", f"{media_id}/insights", params={
                "metric": "reach,likes,comments,shares,saved,total_interactions"})}
        except MetaError as exc:
            return {"insights_error": str(exc)}
