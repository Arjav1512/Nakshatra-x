"""
Async TTL cache for upstream fetches.

PRD N-1 targets "< 2 s p95 **on cached results**". The telemetry endpoint was
measured at 4.0 s warm because it re-queried NASA POWER and Earth Search STAC on
every single request — there were no cached results to be fast on.

Caching these is correct on the data's own terms, not a latency trick:

  * NASA POWER daily point data changes once a day, and the client already
    requests a window ending two days ago.
  * A Sentinel-2 revisit is ~5 days.

So a one-hour TTL cannot hide a change that has actually happened. The cached
value keeps its original `vintage`, so the UI still reports the true age of the
observation rather than the age of the cache entry (PRD N-3, N-6).

A failed upstream call is cached briefly too — otherwise an outage turns every
request into a fresh timeout and the degraded path becomes slower than the
healthy one.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable

#: Successful upstream responses.
DEFAULT_TTL_SECONDS = 3600.0
#: Failures, so an outage does not cost a full timeout per request.
FAILURE_TTL_SECONDS = 60.0

_store: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}
_global_lock = asyncio.Lock()


async def _lock_for(key: str) -> asyncio.Lock:
    async with _global_lock:
        lock = _locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            _locks[key] = lock
        return lock


async def cached(
    key: str,
    producer: Callable[[], Awaitable[Any]],
    ttl: float = DEFAULT_TTL_SECONDS,
    is_failure: Callable[[Any], bool] | None = None,
) -> Any:
    """
    Return a cached value for `key`, producing it if absent or expired.

    Single-flight: concurrent callers for the same key await one producer run
    rather than all stampeding the upstream.
    """
    now = time.monotonic()
    hit = _store.get(key)
    if hit and hit[0] > now:
        return hit[1]

    lock = await _lock_for(key)
    async with lock:
        # Another waiter may have filled it while we queued.
        hit = _store.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        value = await producer()
        effective = FAILURE_TTL_SECONDS if (is_failure and is_failure(value)) else ttl
        _store[key] = (time.monotonic() + effective, value)
        return value


def clear() -> None:
    """Drop every entry. Used by tests and by an on-demand refresh."""
    _store.clear()


def stats() -> dict:
    now = time.monotonic()
    return {
        "entries": len(_store),
        "live": sum(1 for exp, _ in _store.values() if exp > now),
        "ttl_seconds": DEFAULT_TTL_SECONDS,
        "failure_ttl_seconds": FAILURE_TTL_SECONDS,
    }
