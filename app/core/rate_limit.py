"""Tiny in-memory sliding-window rate limiter (per process)."""
import time
from collections import defaultdict, deque

from app.core.exceptions import RateLimitError

_buckets: dict[str, deque] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> None:
    now = time.monotonic()
    bucket = _buckets[key]
    while bucket and bucket[0] <= now - window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise RateLimitError("Too many requests, slow down")
    bucket.append(now)


def reset_rate_limits() -> None:  # tests
    _buckets.clear()
