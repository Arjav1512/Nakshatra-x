"""
Staleness is identity, never age (forecast_store, "STALENESS IS IDENTITY, NOT AGE").

An artifact is stale when its dataset identity or code fingerprint no longer
matches the running code. Age is reported, and the pre-flight can warn on it,
but it never forces a recompute.

The tests that boot the real app (its lifespan runs the startup warmer) do so
against a copy of the committed forecasts, and record every forecast
computation the backend starts. They use only interfaces that exist on main as
well, so the same file is the revert-proof: on main the 48-hour case recomputes
all ten mines.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import forecast_store as fs
from app.main import app

MINE_CODES = [
    "MOIL-BAL-01", "MOIL-BHR-02", "MOIL-UKW-03", "MOIL-TIR-04", "MOIL-DON-05",
    "MOIL-CHK-06", "MOIL-MAN-07", "MOIL-KAN-08", "MOIL-GUM-09", "MOIL-BEL-10",
]


@pytest.fixture
def store(tmp_path, monkeypatch):
    """
    A copy of the committed forecasts whose identity matches the running code.

    The identity is stamped onto the copy so these tests are about the staleness
    rule, not about whether the committed set happens to be current —
    test_demo_hardening checks that separately.
    """
    ident = fs.artifact_identity()
    for src in sorted(fs.FORECAST_DIR.glob("*_14d.json")):
        data = json.loads(src.read_text())
        data["artifact_identity"] = ident
        (tmp_path / src.name).write_text(json.dumps(data, indent=2, default=str))
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def recomputes(monkeypatch):
    """Every forecast computation the backend starts, by mine code."""
    from app.api import track_b

    calls: list[str] = []
    # The startup warmer's entry point, and the request path's.
    monkeypatch.setattr(track_b, "warm_forecast", lambda code, *_a, **_k: calls.append(code))
    monkeypatch.setattr(track_b, "warm", lambda code, *_a, **_k: calls.append(code))
    # Mosaic registration is also started at boot; it is not under test and
    # would otherwise reach the network.
    monkeypatch.setattr("app.ml.map_layers.warm_tile_layers", lambda: None)
    return calls


def _age(store: Path, *, recorded_hours: float, file_hours: float) -> None:
    """
    Make every artifact `recorded_hours` old by its own `vintage`, and give the
    file a modification time `file_hours` ago. The two differ after a checkout.
    """
    now = datetime.now(timezone.utc)
    t = time.time() - file_hours * 3600
    for f in store.glob("*_14d.json"):
        data = json.loads(f.read_text())
        data["vintage"] = (now - timedelta(hours=recorded_hours)).isoformat()
        f.write_text(json.dumps(data, indent=2, default=str))
        os.utime(f, (t, t))


def _snapshot(store: Path) -> dict[str, tuple[bytes, int]]:
    return {f.name: (f.read_bytes(), f.stat().st_mtime_ns) for f in sorted(store.glob("*.json"))}


def _boot():
    """Start the backend (lifespan included), then ask what a client would ask."""
    with TestClient(app) as c:
        ready = c.get("/api/v1/readyz")
        forecast = c.get("/api/v1/mines/1/forecast")
    return ready, forecast


# ---------------------------------------------------------------------------
# The three cases
# ---------------------------------------------------------------------------

def test_matching_identity_48h_old_serves_as_ready_without_recompute(store, recomputes):
    _age(store, recorded_hours=48, file_hours=48)
    before = _snapshot(store)

    ready, forecast = _boot()

    assert recomputes == [], (
        f"the backend recomputed {len(recomputes)} forecast(s) whose identity matches "
        f"the running code, because they were 48 h old: {recomputes}"
    )
    assert ready.status_code == 200, ready.json()
    body = ready.json()
    assert {m["status"] for m in body["mines"]} == {"ready"}, body["mines"]
    ages = [m["artifact_age_hours"] for m in body["mines"]]
    assert all(47.9 < a < 48.5 for a in ages), ages
    assert forecast.status_code == 200 and forecast.json()["served_from"] == "artifact"
    assert _snapshot(store) == before, "an artifact was rewritten"


def test_identity_mismatch_is_stale_and_is_recomputed(store, recomputes):
    # One hour old, so age cannot be what makes it stale.
    _age(store, recorded_hours=1, file_hours=1)
    f = store / "MOIL-BAL-01_14d.json"
    data = json.loads(f.read_text())
    data["artifact_identity"]["code_fingerprint"] = "0" * 16
    f.write_text(json.dumps(data, indent=2, default=str))

    ready, forecast = _boot()

    assert ready.status_code == 503
    by_code = {m["mine_code"]: m for m in ready.json()["mines"]}
    assert by_code["MOIL-BAL-01"]["status"] == "stale", by_code["MOIL-BAL-01"]
    assert "code_fingerprint" in by_code["MOIL-BAL-01"]["identity_mismatch"]
    assert all(m["status"] == "ready" for c, m in by_code.items() if c != "MOIL-BAL-01")
    # Real staleness still triggers a recompute — of that mine and no other.
    assert set(recomputes) == {"MOIL-BAL-01"}, recomputes
    assert forecast.status_code != 200, "a mismatched artifact was served"


def test_fresh_checkout_is_ready_and_reports_the_recorded_age(store, recomputes):
    # A checkout sets every file time to the moment of checkout; the artifacts
    # inside were generated three days earlier.
    _age(store, recorded_hours=72, file_hours=0)

    ready, _ = _boot()

    assert recomputes == [], recomputes
    assert ready.status_code == 200, ready.json()
    ages = [m["artifact_age_hours"] for m in ready.json()["mines"]]
    assert all(71.9 < a < 72.5 for a in ages), (
        f"age must come from the artifact's own vintage (72 h), not the file time: {ages}"
    )


@pytest.mark.parametrize("hours, warns", [(47, False), (49, True)])
def test_age_warning_is_informational(store, recomputes, hours, warns):
    _age(store, recorded_hours=hours, file_hours=hours)

    ready, _ = _boot()

    body = ready.json()
    assert ready.status_code == 200 and recomputes == []
    assert (body["age_warning"] is not None) is warns, body["age_warning"]
    assert body["age_warn_after_hours"] == fs.AGE_WARN_AFTER_HOURS
