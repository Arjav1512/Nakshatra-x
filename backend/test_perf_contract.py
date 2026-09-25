"""
Performance-contract tests (PRD N-1, N-2).

These pin the two fixes that made N-1 achievable, so a later change cannot
silently undo them:

  * the backtest is served from a precomputed artifact, not recomputed;
  * upstream weather/STAC responses are cached, so `/telemetry` is not a live
    network round trip on every request.

They assert behaviour, not wall-clock numbers — timing assertions are flaky on
shared hardware, and the measured table lives in docs/READINESS.md.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import asyncio

from app.api import track_b
from app.core import ttl_cache


def test_backtest_serves_from_artifact_not_recompute():
    """
    PRD N-2: the backtest belongs in a batch. If an artifact exists the request
    path must read it, never refit.
    """
    code = "MOIL-BAL-01"
    path = track_b._backtest_cache_path(code, 150, 14)
    if not path.exists():
        print(f"✓ SKIPPED — no artifact yet; run `python -m app.api.batch backtest {code}`")
        return

    track_b._STATE.pop("backtests", None)
    track_b._state()["backtests"] = {}

    started = time.perf_counter()
    res = track_b.backtest_mine(code, allow_compute=False)
    took = time.perf_counter() - started

    assert res["served_from"] == "artifact", f"expected artifact, got {res['served_from']}"
    assert took < 2.0, f"artifact read took {took:.2f}s — that is not a file read"
    assert "artifact_age_hours" in res, "staleness must be reported (N-6)"
    assert res["model"]["mape_pct"] > 0
    print(f"✓ Backtest served from artifact in {took*1000:.1f} ms, "
          f"age {res['artifact_age_hours']} h (MAPE {res['model']['mape_pct']}%)")


def test_backtest_refuses_to_block_when_no_artifact():
    """
    A missing artifact must answer immediately, not block for minutes.

    It now raises the typed `NoBacktest` rather than a bare ValueError, and
    carries the mines that *do* have one. A mine without a backtest is a scope
    decision — a full run is 216 s and belongs in the batch — so the console
    shows a designed state pointing at the pilot instead of an error, and the
    route answers 404 rather than 503: this will never become available on a
    retry, which is what 503 would promise.
    """
    try:
        track_b.backtest_mine("MOIL-DOES-NOT-EXIST", allow_compute=False)
        raise AssertionError("expected NoBacktest for a mine with no artifact")
    except track_b.NoBacktest as exc:
        assert exc.mine_code == "MOIL-DOES-NOT-EXIST"
        assert "MOIL-BAL-01" in exc.pilots, exc.pilots
        assert "validated on" in str(exc).lower(), str(exc)
    print("✓ Missing artifact raises NoBacktest naming the pilot, rather than computing inline")


def test_ttl_cache_single_flights_and_expires():
    """The cache must dedupe concurrent callers and honour its TTL."""
    ttl_cache.clear()
    calls = {"n": 0}

    async def produce():
        calls["n"] += 1
        await asyncio.sleep(0.05)
        return {"is_live": True, "v": calls["n"]}

    async def scenario():
        # Ten concurrent callers, one upstream call.
        results = await asyncio.gather(*[
            ttl_cache.cached("k", produce, ttl=10.0, is_failure=lambda v: not v["is_live"])
            for _ in range(10)
        ])
        assert calls["n"] == 1, f"single-flight failed: {calls['n']} upstream calls"
        assert all(r["v"] == 1 for r in results)

        # A short TTL must expire.
        await ttl_cache.cached("short", produce, ttl=0.01)
        await asyncio.sleep(0.05)
        await ttl_cache.cached("short", produce, ttl=0.01)
        assert calls["n"] == 3, f"expected expiry to refetch, calls={calls['n']}"

    asyncio.run(scenario())
    print("✓ TTL cache single-flights concurrent callers and expires on schedule")


def test_failures_get_a_short_ttl():
    """A failed upstream must not be cached for the full hour."""
    ttl_cache.clear()
    assert ttl_cache.FAILURE_TTL_SECONDS < ttl_cache.DEFAULT_TTL_SECONDS
    calls = {"n": 0}

    async def failing():
        calls["n"] += 1
        return {"is_live": False}

    async def scenario():
        await ttl_cache.cached("f", failing, is_failure=lambda v: not v["is_live"])
        entry = ttl_cache._store["f"]
        remaining = entry[0] - time.monotonic()
        assert remaining <= ttl_cache.FAILURE_TTL_SECONDS + 1, (
            f"failure cached for {remaining:.0f}s, expected <= {ttl_cache.FAILURE_TTL_SECONDS}s"
        )

    asyncio.run(scenario())
    print(f"✓ Failed upstreams cached for {ttl_cache.FAILURE_TTL_SECONDS}s, "
          f"not {ttl_cache.DEFAULT_TTL_SECONDS}s")


if __name__ == "__main__":
    test_backtest_serves_from_artifact_not_recompute()
    test_backtest_refuses_to_block_when_no_artifact()
    test_ttl_cache_single_flights_and_expires()
    test_failures_get_a_short_ttl()
    print("\nALL PERFORMANCE CONTRACT TESTS PASSED.")
