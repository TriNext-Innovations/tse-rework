"""fal.ai queue client.

Submit → poll → fetch, with the queue's own status/response URLs stored on
the job row, so a production tick that dies after submitting picks the same
request back up instead of paying for a second image.
"""

from __future__ import annotations

import httpx


class GenerationError(RuntimeError):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class FalClient:
    def __init__(self, key: str, base_url: str = "https://queue.fal.run", timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.http = httpx.Client(timeout=timeout, headers={
            "Authorization": f"Key {key}", "Content-Type": "application/json"})

    def _check(self, resp: httpx.Response, what: str) -> dict:
        if resp.status_code == 429 or resp.status_code >= 500:
            raise GenerationError(f"{what}: HTTP {resp.status_code} {resp.text[:300]}", retryable=True)
        if resp.status_code >= 400:
            raise GenerationError(f"{what}: HTTP {resp.status_code} {resp.text[:300]}")
        try:
            return resp.json()
        except ValueError as exc:
            raise GenerationError(f"{what}: non-JSON response", retryable=True) from exc

    def submit(self, model: str, payload: dict) -> dict:
        try:
            resp = self.http.post(f"{self.base_url}/{model}", json=payload)
        except httpx.HTTPError as exc:
            raise GenerationError(f"submit {model}: {exc}", retryable=True) from exc
        data = self._check(resp, f"submit {model}")
        for field in ("request_id", "status_url", "response_url"):
            if not data.get(field):
                raise GenerationError(f"submit {model}: response missing {field}")
        return data

    def status(self, status_url: str) -> str:
        try:
            resp = self.http.get(status_url)
        except httpx.HTTPError as exc:
            raise GenerationError(f"status: {exc}", retryable=True) from exc
        return self._check(resp, "status").get("status", "UNKNOWN")

    def result(self, response_url: str) -> dict:
        try:
            resp = self.http.get(response_url)
        except httpx.HTTPError as exc:
            raise GenerationError(f"result: {exc}", retryable=True) from exc
        data = self._check(resp, "result")
        images = data.get("images") or []
        if not images or not images[0].get("url"):
            raise GenerationError(f"result has no image: {str(data)[:300]}")
        return data

    def download(self, url: str, max_bytes: int = 30_000_000) -> bytes:
        try:
            resp = self.http.get(url, headers={"Authorization": ""}, follow_redirects=True)
        except httpx.HTTPError as exc:
            raise GenerationError(f"download: {exc}", retryable=True) from exc
        if resp.status_code != 200:
            raise GenerationError(f"download: HTTP {resp.status_code}", retryable=resp.status_code >= 500)
        if len(resp.content) > max_bytes:
            raise GenerationError("download: image too large")
        return resp.content
