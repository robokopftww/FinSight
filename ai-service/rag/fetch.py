from __future__ import annotations

import hashlib
import time

import httpx

_UA = "WealthLensBot/0.1 (+https://wealthlens.local)"
_last_request = 0.0


def _throttle(min_interval: float = 2.0) -> None:
    global _last_request
    delta = time.monotonic() - _last_request
    if delta < min_interval:
        time.sleep(min_interval - delta)
    _last_request = time.monotonic()


def fetch_bytes(url: str) -> tuple[bytes, str]:
    _throttle()
    with httpx.Client(timeout=30, headers={"User-Agent": _UA}, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content, hashlib.sha256(resp.content).hexdigest()
