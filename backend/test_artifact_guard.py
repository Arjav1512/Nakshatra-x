"""
A test client booted with startup warming ON never writes the committed artifacts.

This is the revert-proof for conftest.py's `_artifact_writes_go_to_a_session_copy`.
Every committed forecast is made stale (a different model version), so the real
startup warmer has all ten mines to write; the forecast itself is stubbed so the
test takes a second rather than four minutes. With the session copy in place the
writes land there. Without it they land on the committed set — which is what
happened, unnoticed, during the staleness change (conftest.py, WHY THIS EXISTS).
"""
from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.api import forecast_store as fs
from app.main import app


def test_a_test_client_with_warming_on_never_writes_committed_artifacts(monkeypatch, artifact_digest):
    from app.api import track_b

    before = artifact_digest()
    target = fs.FORECAST_DIR
    saved = {f: f.read_bytes() for f in target.glob("*.json")}

    monkeypatch.setattr("app.ml.forecaster.MODEL_VERSION", "artifact-guard-test-v0")
    monkeypatch.setattr(track_b, "compute_forecast", lambda code, horizon_days=14, **_k: {
        "mine_code": code, "grades": [], "note": "artifact-guard stub",
    })
    monkeypatch.setattr("app.ml.map_layers.warm_tile_layers", lambda: None)

    try:
        with TestClient(app) as c:
            # The warmer runs off the request path; wait until it has written
            # every mine, so the check below sees everything it will ever write.
            deadline = time.time() + 30
            while c.get("/api/v1/readyz").status_code != 200:
                assert time.time() < deadline, "the startup warmer did not finish"
                time.sleep(0.1)
        after = artifact_digest()
        changed = [k for k in sorted(set(before) | set(after)) if before.get(k) != after.get(k)]
        assert not changed, (
            f"a test client's startup warmer wrote {len(changed)} committed artifact(s): "
            + ", ".join(changed)
        )
    finally:
        # Leave whatever directory the store pointed at as it was found: the
        # session copy normally, the committed set if the fix is reverted.
        for f, data in saved.items():
            f.write_bytes(data)


def test_the_guard_waits_for_flights_a_closed_client_left_running(monkeypatch, drain_flights):
    """
    The other half of the failure: the PR #16 guard hashed before the writes.

    A client that closes while fits are running leaves them running — the app's
    lifespan drops queued flights and detaches the pool without waiting. The
    guard must not take its final hash until those fits have written. Here they
    write into the session copy; what is asserted is that the drain does not
    return before they have.
    """
    import json
    import threading

    from app.api import track_b

    target = fs.FORECAST_DIR
    saved = {f: f.read_bytes() for f in target.glob("*.json")}

    def slow(code, horizon_days=14, **_k):
        time.sleep(1.0)
        return {"mine_code": code, "grades": [], "note": "late-flight stub"}

    monkeypatch.setattr("app.ml.forecaster.MODEL_VERSION", "late-flight-test-v0")
    monkeypatch.setattr(track_b, "compute_forecast", slow)
    monkeypatch.setattr("app.ml.map_layers.warm_tile_layers", lambda: None)

    def late_stubs() -> list[str]:
        return sorted(f.name for f in target.glob("*.json")
                      if json.loads(f.read_text()).get("note") == "late-flight stub")

    try:
        with TestClient(app):
            time.sleep(0.3)  # the first flights are running; the rest are queued
        assert late_stubs() == [], "precondition: nothing written yet when the client closes"

        drain_flights()

        assert not [t.name for t in threading.enumerate() if t.name.startswith("forecast-warm")]
        assert late_stubs(), "the drain returned before the running flights had written"
    finally:
        for f in target.glob("*.json"):
            if f not in saved:
                f.unlink()
        for f, data in saved.items():
            f.write_bytes(data)


def test_the_guard_and_the_session_copy_are_in_force(request):
    """Confirms, in whatever session runs this — CI's included — that both are active."""
    from pathlib import Path

    from app.api import track_b

    committed = Path(__file__).resolve().parent / "artifacts"
    assert "committed_artifacts_are_untouched" in request.fixturenames
    assert "_artifact_writes_go_to_a_session_copy" in request.fixturenames
    assert fs.FORECAST_DIR != committed / "forecasts", "forecast writes would reach the committed set"
    assert track_b.BACKTEST_CACHE_DIR != committed / "backtests", "backtest writes would reach the committed set"
