"""
Forecast artifacts: persisted, single-flight, warmed off the request path.

WHY THIS EXISTS
---------------
`/forecast` used to fit a model inside the request. That had four consequences,
each of which bit during the redesign work:

1. A cold request took ~42 s, and the first one in a process also regenerated
   the 58,083-row synthetic dataset.
2. The request held a `Depends(get_db)` session for the whole fit — open and
   unused — so ten concurrent forecasts held ten connections and `/mines` could
   not get one. That surfaced as
   `QueuePool limit of size 5 overflow 10 reached` on the endpoint every page
   needs.
3. Abandoned work kept running. A client that gave up did not stop the fit, so
   repeated test runs piled work onto the process; load average reached 98.7
   with uvicorn at 845% CPU, and a forecast that normally takes 42 s timed out
   at 300 s.
4. Two concurrent requests for the same mine fitted the same model twice.

The rule now is simple: **no forecast is ever computed inside a request.** A
request either serves a persisted artifact or reports that the mine is warming.
Computation happens in a bounded background pool, one flight per mine.
"""

from __future__ import annotations

import json
import os
import fcntl
import threading
import time
from contextlib import contextmanager
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

FORECAST_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "forecasts"

# Artifacts older than this are refreshed by the warmer. The generator is
# seeded, so a refresh reproduces the same numbers unless the code changed —
# staleness is about code and model version, not drift.
STALE_AFTER_HOURS = 24.0

# Bounded on purpose. The fit is CPU-bound and already threads internally
# through numpy/scikit-learn; more workers than this stopped helping and
# started starving the event loop.
MAX_WARM_WORKERS = int(os.environ.get("NAKSHATRA_WARM_WORKERS", "2"))

# Threads per fit.
#
# numpy/scikit-learn thread across all cores by default. Two warm workers each
# doing that oversubscribes the machine: during earlier runs uvicorn sat at
# 845% CPU with a load average of 98.7, and a request that normally takes 42 s
# took 300 s — not because the work grew, but because nothing could get
# scheduled. Capping per-fit threads leaves headroom for the event loop, so
# /mines and artifact reads stay fast while warming runs.
#
# Set before numpy is imported anywhere, which is why this module is imported
# early by app.main.
FIT_THREADS = os.environ.get("NAKSHATRA_FIT_THREADS", "2")
for _var in (
    "OMP_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "MKL_NUM_THREADS",
    "NUMEXPR_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
):
    os.environ.setdefault(_var, FIT_THREADS)

# Rough per-mine fit cost, used only to give a waiting client an ETA.
EST_FIT_SECONDS = 45.0


# ---------------------------------------------------------------------------
# Artifact identity
# ---------------------------------------------------------------------------
#
# An artifact is only usable if it was produced by the code that is running
# now. Committed artifacts make a fresh checkout fast; they also make it
# possible to serve last month's model under this month's label, which would be
# worse than being slow. Identity is checked, not assumed.

def code_fingerprint() -> str:
    """
    Hash of the sources that determine a forecast's numbers.

    Deliberately narrow: the forecaster, the conformal wrapper and the data
    generator. Hashing the whole package would invalidate every artifact on an
    unrelated edit, and people who see spurious invalidations start ignoring
    them.
    """
    import hashlib

    root = Path(__file__).resolve().parents[1]
    files = [
        root / "ml" / "forecaster.py",
        root / "ingestion" / "generator.py",
        root / "api" / "track_b.py",
    ]
    h = hashlib.sha256()
    for f in sorted(files):
        if f.exists():
            h.update(f.read_bytes())
    return h.hexdigest()[:16]


def artifact_identity() -> dict[str, Any]:
    from app.ingestion.generator import DEFAULT_SEED
    from app.ml.forecaster import MODEL_VERSION

    return {
        "model_version": MODEL_VERSION,
        "generator_seed": DEFAULT_SEED,
        "code_fingerprint": code_fingerprint(),
    }


def identity_matches(data: dict[str, Any]) -> tuple[bool, str | None]:
    """(matches, reason if not)."""
    want = artifact_identity()
    got = data.get("artifact_identity") or {}
    for key, expected in want.items():
        actual = got.get(key)
        if actual != expected:
            return False, f"{key}: artifact has {actual!r}, code has {expected!r}"
    return True, None


class Warming(Exception):
    """Raised when an artifact is not available yet. Carries an ETA in seconds."""

    def __init__(self, mine_code: str, eta_seconds: float, queued: int):
        self.mine_code = mine_code
        self.eta_seconds = eta_seconds
        self.queued = queued
        super().__init__(f"{mine_code} is warming; about {eta_seconds:.0f}s")


# Reentrant: warm() holds the lock and calls _pool(), which also needs it.
# With a plain Lock that is a self-deadlock — the request hangs rather than
# returning "warming", which is the exact failure this module exists to remove.
_LOCK = threading.RLock()
_INFLIGHT: dict[str, Future] = {}
_POOL: ThreadPoolExecutor | None = None
_STARTED_AT: dict[str, float] = {}

# Failures, per key: {"reason": str, "at": float, "attempts": int}
_FAILED: dict[str, dict[str, Any]] = {}

# Bounded exponential backoff. Without it, a mine that fails deterministically
# is retried by every request that touches it — a retry storm that turns one
# broken mine into a broken backend.
BACKOFF_BASE_SECONDS = 30.0
BACKOFF_MAX_SECONDS = 900.0
MAX_ATTEMPTS_BEFORE_MAX_BACKOFF = 5


def _backoff_for(attempts: int) -> float:
    return min(BACKOFF_MAX_SECONDS, BACKOFF_BASE_SECONDS * (2 ** min(attempts - 1, MAX_ATTEMPTS_BEFORE_MAX_BACKOFF)))


def _in_backoff(key: str) -> tuple[bool, float]:
    """(still backing off, seconds remaining)."""
    f = _FAILED.get(key)
    if not f:
        return False, 0.0
    wait = _backoff_for(f["attempts"])
    remaining = (f["at"] + wait) - time.time()
    return (remaining > 0), max(0.0, remaining)


def _pool() -> ThreadPoolExecutor:
    global _POOL
    with _LOCK:
        if _POOL is None:
            _POOL = ThreadPoolExecutor(
                max_workers=MAX_WARM_WORKERS, thread_name_prefix="forecast-warm"
            )
        return _POOL


def _key(mine_code: str, horizon_days: int) -> str:
    return f"{mine_code}_{horizon_days}d"


def artifact_path(mine_code: str, horizon_days: int) -> Path:
    return FORECAST_DIR / f"{_key(mine_code, horizon_days)}.json"


def _age_hours(path: Path) -> float:
    return (time.time() - path.stat().st_mtime) / 3600.0


def read_artifact(mine_code: str, horizon_days: int) -> dict[str, Any] | None:
    """Return the persisted forecast, annotated with its age, or None."""
    path = artifact_path(mine_code, horizon_days)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None
    matches, reason = identity_matches(data)
    if not matches:
        # Produced by different code. Refusing it is the whole point: serving it
        # would put an old model's numbers under the current model_version.
        return None

    data["served_from"] = "artifact"
    data["artifact_age_hours"] = round(_age_hours(path), 2)
    data["artifact_stale"] = data["artifact_age_hours"] > STALE_AFTER_HOURS
    return data


def write_artifact(mine_code: str, horizon_days: int, payload: dict[str, Any]) -> Path:
    FORECAST_DIR.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["vintage"] = datetime.now(timezone.utc).isoformat()
    payload["artifact_identity"] = artifact_identity()
    path = artifact_path(mine_code, horizon_days)
    # Write-then-rename, so a reader never sees a half-written artifact.
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=str))
    tmp.replace(path)
    return path


def is_fresh(mine_code: str, horizon_days: int) -> bool:
    """Fresh means: present, within the staleness window, AND produced by this code."""
    path = artifact_path(mine_code, horizon_days)
    if not path.exists() or _age_hours(path) > STALE_AFTER_HOURS:
        return False
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return False
    return identity_matches(data)[0]


def warm(
    mine_code: str,
    horizon_days: int,
    compute: Callable[[str, int], dict[str, Any]],
) -> Future:
    """
    Ensure exactly one computation is in flight for this mine and horizon.

    Concurrent callers receive the same Future rather than starting a second
    fit. This is the single-flight guarantee: ten simultaneous requests for
    Balaghat cost one model fit, not ten.
    """
    key = _key(mine_code, horizon_days)
    with _LOCK:
        existing = _INFLIGHT.get(key)
        if existing is not None and not existing.done():
            return existing

        backing_off, remaining = _in_backoff(key)
        if backing_off:
            # Deliberately not scheduling. The caller still gets a Warming with
            # this mine's failure reason via status(); a fifth retry in ten
            # seconds helps nobody.
            fut: Future = Future()
            fut.set_exception(
                RuntimeError(
                    f"{mine_code} failed previously; retrying in {remaining:.0f}s "
                    f"({_FAILED[key]['reason']})"
                )
            )
            return fut

        def _run() -> dict[str, Any]:
            try:
                payload = compute(mine_code, horizon_days)
                write_artifact(mine_code, horizon_days, payload)
                with _LOCK:
                    _FAILED.pop(key, None)
                return payload
            except BaseException as exc:
                with _LOCK:
                    prev = _FAILED.get(key, {"attempts": 0})
                    _FAILED[key] = {
                        "reason": f"{type(exc).__name__}: {exc}"[:200],
                        "at": time.time(),
                        "attempts": prev["attempts"] + 1,
                    }
                raise
            finally:
                # Always clears, on success and on failure. A single-flight entry
                # left behind after a crash blocks every future attempt for that
                # mine, which looks exactly like a hang.
                with _LOCK:
                    _INFLIGHT.pop(key, None)
                    _STARTED_AT.pop(key, None)

        fut = _pool().submit(_run)
        _INFLIGHT[key] = fut
        _STARTED_AT[key] = time.time()
        return fut


def failure_for(mine_code: str, horizon_days: int) -> dict[str, Any] | None:
    with _LOCK:
        f = _FAILED.get(_key(mine_code, horizon_days))
        return dict(f) if f else None


def eta_seconds(mine_code: str, horizon_days: int) -> tuple[float, int]:
    """(estimated seconds remaining, number of flights queued ahead)."""
    key = _key(mine_code, horizon_days)
    with _LOCK:
        started = _STARTED_AT.get(key)
        queued = max(0, len(_INFLIGHT) - MAX_WARM_WORKERS)
    if started is None:
        return EST_FIT_SECONDS * (1 + queued), queued
    elapsed = time.time() - started
    return max(1.0, EST_FIT_SECONDS - elapsed), queued


def status(mine_codes: list[str], horizon_days: int = 14) -> dict[str, Any]:
    """Per-mine artifact status, for /readyz."""
    mines = []
    ready = 0
    failed = 0
    for code in mine_codes:
        path = artifact_path(code, horizon_days)
        exists = path.exists()
        age = round(_age_hours(path), 2) if exists else None
        fresh = bool(exists and age is not None and age <= STALE_AFTER_HOURS)
        if fresh:
            ready += 1
        k = _key(code, horizon_days)
        with _LOCK:
            warming = k in _INFLIGHT
            failure = dict(_FAILED.get(k) or {})

        # Why an artifact that exists is not fresh matters to whoever is reading
        # this: "present but from another model" is a different problem from
        # "present but old".
        identity_ok, identity_reason = (True, None)
        if exists and not fresh:
            try:
                identity_ok, identity_reason = identity_matches(json.loads(path.read_text()))
            except (json.JSONDecodeError, OSError) as exc:
                identity_ok, identity_reason = False, f"unreadable: {exc}"

        if fresh:
            state = "ready"
        elif failure and not warming:
            state = "failed"
        elif warming:
            state = "warming"
        else:
            state = "stale" if exists else "missing"

        if state == "failed":
            failed += 1

        entry = {
            "mine_code": code,
            "status": state,
            "artifact": "present" if exists else "missing",
            "artifact_age_hours": age,
            "fresh": fresh,
            "warming": warming,
        }
        if not identity_ok and identity_reason:
            entry["identity_mismatch"] = identity_reason
        if failure:
            entry["failure"] = {
                "reason": failure.get("reason"),
                "attempts": failure.get("attempts"),
                "retry_in_seconds": round(_in_backoff(k)[1], 1),
            }
        mines.append(entry)

    return {
        "ready": ready == len(mine_codes) and len(mine_codes) > 0,
        "mines_ready": ready,
        "mines_failed": failed,
        "mines_total": len(mine_codes),
        "stale_after_hours": STALE_AFTER_HOURS,
        "warm_workers": MAX_WARM_WORKERS,
        "artifact_identity": artifact_identity(),
        "mines": mines,
    }


def shutdown() -> None:
    """Stop accepting work and drop queued flights. Used on app shutdown."""
    global _POOL
    with _LOCK:
        pool, _POOL = _POOL, None
        _INFLIGHT.clear()
        _STARTED_AT.clear()
        _FAILED.clear()
    if pool is not None:
        pool.shutdown(wait=False, cancel_futures=True)


@contextmanager
def warm_lock():
    """
    Advisory, non-blocking, per-host lock so only one process warms.

    Yields True if this process acquired it, False if another already holds it.
    Never blocks: a worker that loses the race should start serving, not wait.
    """
    FORECAST_DIR.mkdir(parents=True, exist_ok=True)
    path = FORECAST_DIR / ".warm.lock"
    fh = None
    acquired = False
    try:
        fh = open(path, "w")
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
            acquired = True
            fh.write(str(os.getpid()))
            fh.flush()
        except OSError:
            acquired = False
        yield acquired
    finally:
        if fh is not None:
            try:
                if acquired:
                    fcntl.flock(fh, fcntl.LOCK_UN)
            finally:
                fh.close()
