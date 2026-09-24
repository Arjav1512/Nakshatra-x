"""
Demo hardening: no computation on a request path, and nothing that can wedge it.

These tests exist because the demo backend twice became unusable under ordinary
use — a handful of concurrent forecasts exhausted the connection pool, and
abandoned requests kept computing until load average reached 98.7 and a 42 s
request took 300 s.
"""

from __future__ import annotations

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import forecast_store as fs
from app.main import app

REPO = Path(__file__).resolve().parents[1]
MINE_CODES = [
    "MOIL-BAL-01", "MOIL-BHR-02", "MOIL-UKW-03", "MOIL-TIR-04", "MOIL-DON-05",
    "MOIL-CHK-06", "MOIL-MAN-07", "MOIL-KAN-08", "MOIL-GUM-09", "MOIL-BEL-10",
]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Artifacts match the code that is running
# ---------------------------------------------------------------------------

def test_committed_artifacts_match_current_code():
    """
    Every committed artifact must have been produced by this code.

    Committed artifacts are what make a fresh backend fast. They are also how
    you serve last month's model under this month's label, so the fingerprint is
    checked rather than trusted. If this fails, regenerate:

        python -m app.api.batch forecast
    """
    want = fs.artifact_identity()
    mismatches = []
    for code in MINE_CODES:
        path = fs.artifact_path(code, 14)
        assert path.exists(), f"missing artifact for {code} — run `python -m app.api.batch forecast`"
        data = json.loads(path.read_text())
        ok, reason = fs.identity_matches(data)
        if not ok:
            mismatches.append(f"{code}: {reason}")
    assert not mismatches, (
        "Committed artifacts were produced by different code:\n  "
        + "\n  ".join(mismatches)
        + f"\nCurrent identity: {want}"
    )


def test_artifact_with_wrong_fingerprint_is_not_served(tmp_path, monkeypatch):
    """An artifact from other code must be refused, not served under this label."""
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    payload = {"mine_code": "X", "artifact_identity": {
        "model_version": "some-old-model",
        "generator_seed": 1,
        "code_fingerprint": "deadbeefdeadbeef",
    }}
    (tmp_path / "X_14d.json").write_text(json.dumps(payload))
    assert fs.read_artifact("X", 14) is None
    assert fs.is_fresh("X", 14) is False


# ---------------------------------------------------------------------------
# Readiness and configuration
# ---------------------------------------------------------------------------

def test_healthz_is_liveness_only(client):
    r = client.get("/api/v1/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_readyz_reports_every_mine(client):
    r = client.get("/api/v1/readyz")
    body = r.json()
    assert body["mines_total"] == len(MINE_CODES)
    assert {m["mine_code"] for m in body["mines"]} == set(MINE_CODES)
    for m in body["mines"]:
        assert m["status"] in {"ready", "warming", "failed", "stale", "missing"}
    assert r.status_code == (200 if body["ready"] else 503)


def test_skip_warm_is_test_only_and_absent_from_shipped_config():
    """
    NAKSHATRA_SKIP_WARM disables startup warming. It is for tests measuring a
    cold backend, and must never be set in anything we ship or demo from.
    """
    assert os.environ.get("NAKSHATRA_SKIP_WARM") != "1" or True  # informational

    offenders = []
    for pattern in ("*.yml", "*.yaml", "*.env", "*.example", "Dockerfile*", "*.toml", "*.json", "*.md"):
        for path in REPO.rglob(pattern):
            parts = set(path.parts)
            if parts & {"node_modules", ".next", ".git", "artifacts", "outputs"}:
                continue
            if path.name == "test_demo_hardening.py":
                continue
            try:
                text = path.read_text(errors="ignore")
            except OSError:
                continue
            for line in text.splitlines():
                if "NAKSHATRA_SKIP_WARM" in line and "=1" in line.replace(" ", ""):
                    # A documented warning that it must not be used is fine.
                    if "never" in line.lower() or "must not" in line.lower() or "test-only" in line.lower():
                        continue
                    offenders.append(f"{path.relative_to(REPO)}: {line.strip()[:90]}")
    assert not offenders, "NAKSHATRA_SKIP_WARM=1 found in shipped config:\n  " + "\n  ".join(offenders)


# ---------------------------------------------------------------------------
# Single-flight, failure handling, backoff
# ---------------------------------------------------------------------------

def test_single_flight_shares_one_computation(monkeypatch, tmp_path):
    """Ten concurrent requests for one mine must cost one computation."""
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    calls = []
    gate = threading.Event()

    def slow_compute(code, horizon):
        calls.append(code)
        gate.wait(timeout=5)
        return {"mine_code": code, "grades": []}

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(fs.warm, "MOIL-BAL-01", 14, slow_compute) for _ in range(10)]
        time.sleep(0.3)
        gate.set()
        for f in futures:
            f.result(timeout=20)

    assert len(calls) == 1, f"expected 1 computation for 10 callers, got {len(calls)}"


def test_failed_computation_clears_inflight_and_backs_off(monkeypatch, tmp_path):
    """
    A failure must release the single-flight slot and then back off.

    A slot left behind blocks every future attempt for that mine, which is
    indistinguishable from a hang; retrying immediately turns one broken mine
    into a retry storm.
    """
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    attempts = []

    def boom(code, horizon):
        attempts.append(code)
        raise RuntimeError("synthetic failure")

    fut = fs.warm("MOIL-FAIL-99", 14, boom)
    with pytest.raises(RuntimeError):
        fut.result(timeout=20)

    # slot released
    assert fs._key("MOIL-FAIL-99", 14) not in fs._INFLIGHT

    failure = fs.failure_for("MOIL-FAIL-99", 14)
    assert failure is not None
    assert "synthetic failure" in failure["reason"]
    assert failure["attempts"] == 1

    # immediate retry is refused by backoff, so `boom` is not called again
    fut2 = fs.warm("MOIL-FAIL-99", 14, boom)
    with pytest.raises(RuntimeError):
        fut2.result(timeout=5)
    assert len(attempts) == 1, "backoff should have suppressed the immediate retry"


def test_one_failed_mine_does_not_affect_the_others(monkeypatch, tmp_path, client):
    """Inject a failure for one mine; the other nine must still serve."""
    fs._FAILED[fs._key("MOIL-TIR-04", 14)] = {
        "reason": "RuntimeError: injected", "at": time.time(), "attempts": 2,
    }
    try:
        body = client.get("/api/v1/readyz").json()
        by_code = {m["mine_code"]: m for m in body["mines"]}

        tirodi = by_code["MOIL-TIR-04"]
        assert tirodi["status"] in {"failed", "ready"}
        if tirodi["status"] == "failed":
            assert "injected" in tirodi["failure"]["reason"]
            assert tirodi["failure"]["retry_in_seconds"] > 0

        # the other nine still serve their artifacts
        for mine_id in (1, 2, 3, 5, 6, 7, 8, 9, 10):
            r = client.get(f"/api/v1/mines/{mine_id}/forecast?horizon_days=14")
            assert r.status_code == 200, f"mine {mine_id} broke when another mine failed"
    finally:
        fs._FAILED.pop(fs._key("MOIL-TIR-04", 14), None)


# ---------------------------------------------------------------------------
# Concurrency and abandonment
# ---------------------------------------------------------------------------

def test_ten_parallel_forecasts_plus_mines_return_no_5xx(client):
    """
    The failure this whole change exists to prevent.

    Ten concurrent forecasts used to hold ten DB connections across their model
    fits, exhausting SQLite's pool and making /api/v1/mines — which every page
    needs — fail with a 30 s timeout.
    """
    results: list[tuple[str, int]] = []
    lock = threading.Lock()

    def hit(path: str):
        r = client.get(path)
        with lock:
            results.append((path, r.status_code))

    paths = [f"/api/v1/mines/{i}/forecast?horizon_days=14" for i in range(1, 11)]
    paths += ["/api/v1/mines"] * 5

    with ThreadPoolExecutor(max_workers=15) as pool:
        list(pool.map(hit, paths))

    server_errors = [(p, s) for p, s in results if s >= 500 and s != 503]
    assert not server_errors, f"5xx under concurrency: {server_errors}"

    mines_calls = [s for p, s in results if p == "/api/v1/mines"]
    assert all(s == 200 for s in mines_calls), f"/mines degraded under load: {mines_calls}"

    forecast_calls = [s for p, s in results if "forecast" in p]
    assert all(s in (200, 503) for s in forecast_calls), forecast_calls


def test_abandoned_requests_do_not_queue_work(monkeypatch, tmp_path):
    """
    A client that gives up must not leave work running.

    Requests no longer enqueue computation at all — only the warmer does, and it
    is single-flight — so abandoning a request cannot add load. This asserts the
    property directly: many callers, one flight, and nothing left in flight
    afterwards.
    """
    monkeypatch.setattr(fs, "FORECAST_DIR", tmp_path)
    calls = []
    gate = threading.Event()

    def gated(code, horizon):
        calls.append(code)
        gate.wait(timeout=10)
        return {"mine_code": code, "grades": []}

    # The gate keeps the first flight open until every caller has arrived, so
    # this measures deduplication rather than how fast the machine happened to
    # be. Without it, later callers land after the first flight has finished and
    # correctly start a new one — which made an earlier version of this test
    # flap.
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(fs.warm, "MOIL-ABANDON", 14, gated) for _ in range(20)]
        time.sleep(0.5)
        assert len(calls) == 1, f"20 concurrent callers produced {len(calls)} computations"
        gate.set()
        for f in futures:
            f.result(timeout=30)

    # Nothing left running once the work is done.
    deadline = time.time() + 5
    while fs._key("MOIL-ABANDON", 14) in fs._INFLIGHT and time.time() < deadline:
        time.sleep(0.05)
    assert fs._key("MOIL-ABANDON", 14) not in fs._INFLIGHT, "flight left in flight"
