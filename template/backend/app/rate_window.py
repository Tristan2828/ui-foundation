"""A per-key request counter over a sliding window, kept in this process's
memory (the same trade-off as routers/client_errors.py: a restart forgets
it, and with several workers each counts its own). Used by the MCP and
OAuth routes, whose callers have no sign-in to count failures against.
"""

import math
import time
from collections import deque

_buckets: dict[tuple[str, str], deque[float]] = {}


def reset() -> None:
    """Forgets every count (tests)."""
    _buckets.clear()


def hit(bucket: str, key: str, limit: int, window_seconds: float) -> int | None:
    """Counts one request. None if it is allowed, else the seconds to wait."""
    now = time.monotonic()
    times = _buckets.setdefault((bucket, key), deque())
    while times and now - times[0] >= window_seconds:
        times.popleft()
    if len(times) >= limit:
        return max(1, math.ceil(window_seconds - (now - times[0])))
    times.append(now)
    # Keys that went quiet would otherwise stay forever.
    if len(_buckets) > 10_000:
        for stale in [k for k, v in _buckets.items() if not v or now - v[-1] >= window_seconds]:
            del _buckets[stale]
    return None
