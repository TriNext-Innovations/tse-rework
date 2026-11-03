"""Media storage. Meta fetches images by public URL, so every final asset
needs a stable HTTPS address. The default store is a persistent volume served
by this service under /media; keys carry a content hash, so URLs are
unguessable and never change meaning.

TODO(tnx): an S3/R2 backend behind the same three methods if the box's disk
or bandwidth becomes the constraint.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path


class Storage:
    def __init__(self, root: Path, public_base_url: str):
        self.root = root
        self.public_base_url = public_base_url.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, prefix: str, data: bytes, ext: str) -> tuple[str, str]:
        """Store bytes; returns (key, sha256). Writes are atomic."""
        digest = hashlib.sha256(data).hexdigest()
        key = f"{prefix}-{digest[:20]}.{ext}"
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)
        return key, digest

    def path(self, key: str) -> Path:
        resolved = (self.root / key).resolve()
        if self.root.resolve() not in resolved.parents:
            raise ValueError(f"key escapes storage root: {key}")
        return resolved

    def read(self, key: str) -> bytes:
        return self.path(key).read_bytes()

    def exists(self, key: str) -> bool:
        try:
            return self.path(key).is_file()
        except ValueError:
            return False

    def url(self, key: str) -> str:
        return f"{self.public_base_url}/{key}"
