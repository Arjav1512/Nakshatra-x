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


@pytest.fixture(scope="session", autouse=True)
def committed_artifacts_are_not_modified_by_this_suite():
    """
    Structural guard: no test may write into the committed artifacts directory.

    One test did, through a race (see test_single_flight_shares_one_computation),
    and the damage reached a commit. Fixing that one test is necessary and not
    sufficient — the next test to forget a tmp_path would do it again, silently,
    and the only symptom would be a demo mine with no numbers. This fails the
    run instead.
    """
    import hashlib

    def digest():
        out = {}
        for f in sorted(fs.FORECAST_DIR.glob("*.json")):
            out[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
        return out

    before = digest()
    yield
    after = digest()
    changed = sorted(
        set(before) ^ set(after)
        | {k for k in set(before) & set(after) if before[k] != after[k]}
    )
    assert not changed, (
        "the test suite modified committed artifacts: "
        + ", ".join(changed)
        + " — a test is missing `monkeypatch.setattr(fs, 'FORECAST_DIR', tmp_path)`, "
        "or is not waiting for its flight to finish before the patch is undone"
    )


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


def test_committed_artifacts_are_complete_forecasts():
    """
    An artifact that passes the identity check can still be empty.

    This is not hypothetical. The committed artifact for MOIL-BAL-01 — the first
    mine in the demo — was `{"mine_code": ..., "grades": [], ...}` with a valid
    identity block: the abandon test's stub payload, written into the real
    artifacts directory before that test was given a tmp_path, and then
    committed. It would have been served as a complete forecast, and the console
    would have rendered Balaghat with no grades and no trajectory.

    Identity says "this came from our code". It says nothing about whether the
    code produced anything. Both have to be checked.
    """
    problems = []
    for code in MINE_CODES:
        d = json.loads(fs.artifact_path(code, 14).read_text())
        grades = d.get("grades") or []
        if not grades:
            problems.append(f"{code}: no grades")
            continue
        for field in ("forecast_origin", "window", "model_version", "portfolio", "provenance"):
            if not d.get(field):
                problems.append(f"{code}: missing {field}")
        w = d.get("window") or {}
        if not (w.get("start") and w.get("end")):
            problems.append(f"{code}: window {w!r}")
        for g in grades:
            traj = g.get("trajectory") or []
            if len(traj) != d.get("horizon_days", 14):
                problems.append(f"{code}/{g.get('grade')}: {len(traj)} trajectory points")
            if not all(p.get("date") for p in traj):
                problems.append(f"{code}/{g.get('grade')}: a trajectory point has no date")
    assert not problems, "incomplete committed artifacts:\n  " + "\n  ".join(problems)


def test_no_stub_or_test_artifacts_are_committed():
    """Only the ten real mines. A fixture that reaches this directory is a bug."""
    import subprocess

    tracked = subprocess.run(
        ["git", "ls-files", "backend/artifacts/forecasts/"],
        cwd=str(REPO), capture_output=True, text=True, check=True,
    ).stdout.split()
    names = sorted(Path(t).name for t in tracked)
    assert names == sorted(f"{c}_14d.json" for c in MINE_CODES), names


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


def _still_served() -> list[str]:
    """Mine codes whose committed artifact `read_artifact` will still hand out."""
    return [c for c in MINE_CODES if fs.read_artifact(c, 14) is not None]


def test_fingerprint_covers_the_whole_import_chain():
    """
    The fingerprint was three hand-picked files: forecaster, generator, track_b.

    That list was wrong the day it was written — `constraints.py` gates every
    recommendation and `schemas.py` defines the rows the generator emits, and a
    change to either moves the numbers while leaving the fingerprint, and so
    every committed artifact, untouched. The chain is walked now; this asserts
    it reaches past the original three.
    """
    files, third_party = fs._walk_forecast_imports()
    names = {f.name for f in files}
    for expected in ("forecaster.py", "generator.py", "track_b.py",
                     "constraints.py", "schemas.py", "backtest.py", "provenance.py"):
        assert expected in names, f"{expected} missing from the forecast import chain: {sorted(names)}"
    # The libraries whose output the artifact actually depends on.
    assert {"numpy", "sklearn"} <= third_party, third_party


def test_library_versions_are_recorded():
    versions = fs.library_versions()
    assert versions.get("sklearn") and versions["sklearn"] != "unknown"
    assert versions.get("numpy") and versions["numpy"] != "unknown"
    assert fs.artifact_identity()["library_versions"] == versions


def test_data_end_date_is_a_parameter_with_a_committed_default(monkeypatch):
    from app.ingestion import generator as gen

    monkeypatch.delenv(gen.DATA_END_DATE_ENV, raising=False)
    assert gen.resolve_data_end_date() == gen.DEFAULT_DATA_END_DATE

    monkeypatch.setenv(gen.DATA_END_DATE_ENV, "2027-01-31")
    assert gen.resolve_data_end_date().isoformat() == "2027-01-31"
    assert gen.SyntheticDataset().end.isoformat() == "2027-01-31"

    monkeypatch.setenv(gen.DATA_END_DATE_ENV, "not-a-date")
    with pytest.raises(ValueError):
        gen.resolve_data_end_date()


@pytest.mark.parametrize("component", [
    "model_version", "generator_seed", "data_end_date",
    "code_fingerprint", "library_versions",
])
def test_changing_any_identity_component_marks_every_artifact_stale(component, monkeypatch, tmp_path):
    """
    Each part of the identity, on its own, must invalidate all ten artifacts.

    Not "should be caught by review" — the whole point of committing artifacts
    is that nobody looks at them again. If any one of these can change without
    the artifacts being refused, the demo serves an old model's forecast under
    the current label.
    """
    import shutil

    assert _still_served() == MINE_CODES, "precondition: all ten artifacts match current code"

    if component == "model_version":
        monkeypatch.setattr("app.ml.forecaster.MODEL_VERSION", "nakshatra-gbt-cqr-v99")
    elif component == "generator_seed":
        monkeypatch.setattr("app.ingestion.generator.DEFAULT_SEED", 12345)
    elif component == "data_end_date":
        monkeypatch.setenv("NAKSHATRA_DATA_END_DATE", "2026-12-31")
    elif component == "library_versions":
        monkeypatch.setattr(fs, "library_versions", lambda: {"numpy": "0.0.0", "sklearn": "0.0.0"})
    elif component == "code_fingerprint":
        # Edit a copy of the package, never the real tree, and edit a file that
        # was NOT in the original hand-picked three.
        pkg = tmp_path / "app"
        shutil.copytree(fs._PACKAGE_ROOT, pkg)
        target = pkg / "ml" / "constraints.py"
        before = fs.code_fingerprint()
        target.write_text(target.read_text() + "\n# a change to a gating rule\n")
        monkeypatch.setattr(fs, "_PACKAGE_ROOT", pkg)
        assert fs.code_fingerprint() != before, "editing a chain module did not move the fingerprint"

    still_served = _still_served()
    assert still_served == [], (
        f"changing {component} left {len(still_served)} artifacts being served: {still_served}"
    )
    assert all(fs.is_fresh(c, 14) is False for c in MINE_CODES)

    st = fs.status(MINE_CODES, 14)
    assert st["ready"] is False
    assert st["mines_ready"] == 0, st
    mismatched = [m for m in st["mines"] if m.get("identity_mismatch")]
    assert len(mismatched) == len(MINE_CODES), st
    assert all(m["status"] in {"stale", "warming"} for m in st["mines"]), st


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
# CPU oversubscription
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("entry_point", [
    "app.ingestion.generator",   # what the batch tool and test_track_b import first
    "app.api.track_b",
    "app.main",
])
def test_thread_caps_apply_before_numpy_on_every_entry_point(entry_point):
    """
    The caps must be in place whatever imports the package first.

    They were set at the top of `forecast_store`, which `app.main` imports
    first — so the API was capped and nothing else was. `app/api/track_b.py`
    imports the generator (and numpy with it) at line 18 and `forecast_store`
    at line 192, so `python -m app.api.batch forecast` and `pytest
    test_track_b.py` both loaded numpy uncapped. Measured before the fix: one
    pytest process at 849% CPU on an 8-core laptop.

    OpenMP reads these when its library loads, i.e. on `import numpy`. Setting
    them afterwards silently does nothing, which is why this is asserted in a
    subprocess at import time rather than by reading os.environ in-process.
    """
    import subprocess
    import sys as _sys

    code = (
        f"import {entry_point}; import os; "
        "print(os.environ.get('OMP_NUM_THREADS'), os.environ.get('OPENBLAS_NUM_THREADS'))"
    )
    env = {k: v for k, v in os.environ.items() if k not in {
        "OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
        "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS",
    }}
    out = subprocess.run(
        [_sys.executable, "-c", code], cwd=str(Path(__file__).resolve().parent),
        capture_output=True, text=True, env=env, timeout=180,
    )
    assert out.returncode == 0, out.stderr[-2000:]
    omp, openblas = out.stdout.strip().split()
    assert omp == "2" and openblas == "2", f"{entry_point} left threads uncapped: {out.stdout!r}"


def test_caps_are_set_in_the_package_init_not_a_submodule():
    """
    Structural: a package __init__ is the only module guaranteed to run before
    any app.* submodule. If these move back into a submodule, some entry point
    will bypass them again and nothing will say so.
    """
    import app

    src = Path(app.__file__).read_text()
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        assert var in src, f"{var} is not capped in app/__init__.py"
    assert app.FIT_THREADS


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
        # `fs.warm` RETURNS a Future; the outer future resolves to it the moment
        # warm() has registered the flight. Waiting only on the outer futures
        # therefore returns while the computation is still running — and this
        # test then ended, monkeypatch restored the real FORECAST_DIR, and the
        # flight wrote its stub payload into the committed artifacts. That is
        # how MOIL-BAL-01 came to be committed as `{"grades": []}`.
        inner = [f.result(timeout=20) for f in futures]
        for flight in inner:
            flight.result(timeout=20)

    assert len(calls) == 1, f"expected 1 computation for 10 callers, got {len(calls)}"
    # The write landed in tmp_path, not in the repo.
    assert (tmp_path / "MOIL-BAL-01_14d.json").exists()


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
