"""
Staleness is identity, never age (forecast_store, "STALENESS IS IDENTITY, NOT AGE").

An artifact is stale when its dataset identity or code fingerprint no longer
matches the running code. Age is reported, and the pre-flight can warn on it,
but it never forces a recompute — and recomputing identical inputs never
re-stamps `vintage`, `computed_at` or `generated_at`.

The tests that boot the real app (its lifespan runs the startup warmer) do so
against a copy of the committed forecasts, and record every forecast
computation the backend starts. They use only interfaces that exist on main as
well, so the same file is the revert-proof: on main the 48-hour case recomputes
all ten mines.
"""
from __future__ import annotations

import argparse
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


# ---------------------------------------------------------------------------
# Recomputing identical inputs rewrites nothing
# ---------------------------------------------------------------------------

def test_an_identical_forecast_is_not_rewritten(tmp_path, monkeypatch):
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    payload = {"mine_code": "X", "grades": [{"q50": 1.0, "provenance": {"vintage": "first"}}]}

    path, written = fs.write_artifact("X", 14, payload)
    assert written
    before = (path.read_bytes(), path.stat().st_mtime_ns)
    time.sleep(0.01)

    # Same content, new stamps at both depths: not a change.
    again = {"mine_code": "X", "grades": [{"q50": 1.0, "provenance": {"vintage": "second"}}]}
    _, written = fs.write_artifact("X", 14, again)
    assert not written
    assert (path.read_bytes(), path.stat().st_mtime_ns) == before

    # A real change is written.
    _, written = fs.write_artifact("X", 14, {"mine_code": "X", "grades": [{"q50": 2.0}]})
    assert written


def test_an_identical_backtest_keeps_its_computed_at(tmp_path, monkeypatch):
    from datetime import date

    from app.api import track_b

    class _Result:
        def to_dict(self):
            return {"model": {"mape_pct": 11.67}, "baseline": {"mape_pct": 14.0}}

    monkeypatch.setattr(track_b, "BACKTEST_CACHE_DIR", tmp_path)
    monkeypatch.setattr(track_b, "_state", lambda: {
        "end": date(2026, 9, 20), "series": None, "cov": None, "opencast": None,
    })
    monkeypatch.setattr(track_b, "rolling_origin_backtest", lambda *_a, **_k: _Result())

    first = track_b.compute_backtest("X")
    path = tmp_path / "X_150d_14step.json"
    before = (path.read_bytes(), path.stat().st_mtime_ns)
    time.sleep(0.01)
    second = track_b.compute_backtest("X")

    assert (path.read_bytes(), path.stat().st_mtime_ns) == before
    assert second["computed_at"] == first["computed_at"]


def test_an_identical_calibration_keeps_its_generated_at(tmp_path):
    import measure_cumulative_calibration as H

    records = tmp_path / "records.jsonl"
    lines = [{"type": "meta", "first_origin": "2026-01-01", "last_origin": "2026-01-06",
              "step_days": 14, "n_origins": 6}]
    for d in range(6):
        for m in range(3):
            lines.append({"type": "cum", "origin": f"2026-01-{d + 1:02d}", "mine": f"M{m}",
                          "grade": "g", "realised": 100.0,
                          "arms": {"rho0": {"pit": 0.5, "inside": (d + m) % 5 != 0, "rho": 0.0}}})
    records.write_text("".join(json.dumps(r) + "\n" for r in lines))
    out = tmp_path / "cumulative_coverage.json"
    args = argparse.Namespace(records=str(records), out=str(out), n_boot=50)

    assert H.artifact(args) == 0
    before = (out.read_bytes(), out.stat().st_mtime_ns)
    time.sleep(1.1)  # `generated_at` has one-second resolution
    assert H.artifact(args) == 0

    assert (out.read_bytes(), out.stat().st_mtime_ns) == before


def test_re_exporting_identical_samples_rewrites_nothing(tmp_path, monkeypatch):
    """Every row carries `ingested_at = now`; that alone must not rewrite a file."""
    from app.ingestion import export

    monkeypatch.setattr(export, "SAMPLE_DIR", tmp_path)
    first: list[str] = []
    export.export_samples(rows_per_entity=20, written=first)
    assert len(first) == len(export.ENTITY_ORDER) + 2, first  # + identity, README
    before = {f.name: (f.read_bytes(), f.stat().st_mtime_ns) for f in tmp_path.iterdir()}
    time.sleep(0.01)

    second: list[str] = []
    export.export_samples(rows_per_entity=20, written=second)
    assert second == []
    assert {f.name: (f.read_bytes(), f.stat().st_mtime_ns) for f in tmp_path.iterdir()} == before

    # A changed row is written.
    csv_path = tmp_path / "borehole.sample.csv"
    csv_path.write_text(csv_path.read_text().replace("MOIL-BAL-01-BH-001", "EDITED", 1))
    third: list[str] = []
    export.export_samples(rows_per_entity=20, written=third)
    assert third == ["borehole.sample.csv"]


# ---------------------------------------------------------------------------
# The batch job follows the same rule
# ---------------------------------------------------------------------------

def test_batch_skips_matching_forecasts_and_force_rewrites_nothing_identical(store, monkeypatch):
    from app.api import batch, track_b

    _age(store, recorded_hours=48, file_hours=48)
    before = _snapshot(store)

    def must_not_run(*_a, **_k):
        pytest.fail("batch recomputed a forecast whose identity matches")

    monkeypatch.setattr(track_b, "compute_forecast", must_not_run)
    assert batch.run_forecasts() == 0
    assert _snapshot(store) == before

    # --force recomputes; identical output is still not written.
    stored = {f.name.removesuffix("_14d.json"): json.loads(f.read_text()) for f in store.glob("*_14d.json")}
    monkeypatch.setattr(track_b, "compute_forecast", lambda code, horizon_days=14: {
        k: v for k, v in stored[code].items() if k not in ("vintage", "artifact_identity")
    })
    assert batch.run_forecasts(force=True) == 0
    assert _snapshot(store) == before


def test_batch_does_not_re_measure_a_current_calibration(tmp_path, monkeypatch):
    import subprocess

    from app.api import batch

    art = json.loads(batch.CALIBRATION_ARTIFACT.read_text())
    art["artifact_identity"] = fs.artifact_identity()
    art["harness_fingerprint"] = fs.file_fingerprint(batch.CALIBRATION_HARNESS)
    path = tmp_path / "cumulative_coverage.json"
    path.write_text(json.dumps(art))
    monkeypatch.setattr(batch, "CALIBRATION_ARTIFACT", path)
    monkeypatch.setattr(subprocess, "run", lambda *_a, **_k: pytest.fail("re-measured a current calibration"))

    assert batch.calibration_is_current()
    assert batch.run_calibration() == 0

    # Measured by a different harness: not current, even with a matching model.
    art["harness_fingerprint"] = "0" * 16
    path.write_text(json.dumps(art))
    assert not batch.calibration_is_current()


def test_batch_check_refuses_artifacts_this_code_did_not_produce(monkeypatch, tmp_path):
    """`batch check` is CI's artifacts gate: each kind of staleness must fail it."""
    import shutil

    from app.api import batch
    from app.ingestion import export

    assert batch.code_identity_report()["ok"], "precondition: the committed set is current"

    # A different model: every forecast, the backtest and the calibration.
    monkeypatch.setattr("app.ml.forecaster.MODEL_VERSION", "nakshatra-gbt-cqr-v99")
    rows = batch.code_identity_report()["artifacts"]
    stale = {r["kind"] for r in rows if not r["ok"]}
    assert stale == {"forecast", "backtest", "calibration"}, rows
    monkeypatch.undo()

    # A different measuring harness: the calibration alone.
    monkeypatch.setattr(batch, "CALIBRATION_HARNESS", Path(__file__))
    rows = batch.code_identity_report()["artifacts"]
    assert [r["kind"] for r in rows if not r["ok"]] == ["calibration"], rows
    monkeypatch.undo()

    # A committed sample the generator would not produce.
    samples = tmp_path / "synthetic"
    shutil.copytree(export.SAMPLE_DIR, samples)
    f = samples / "borehole.sample.csv"
    f.write_text(f.read_text().replace("MOIL-BAL-01-BH-001", "EDITED", 1))
    monkeypatch.setattr(export, "SAMPLE_DIR", samples)
    rows = batch.code_identity_report()["artifacts"]
    bad = [r for r in rows if not r["ok"]]
    assert [r["kind"] for r in bad] == ["samples"] and "borehole.sample.csv" in bad[0]["reason"], rows
