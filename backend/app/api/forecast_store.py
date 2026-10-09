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
import sys
import fcntl
import threading
import time
from contextlib import contextmanager
from functools import lru_cache
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

FORECAST_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "forecasts"

# STALENESS IS IDENTITY, NOT AGE.
#
# An artifact is stale when its dataset identity or code fingerprint no longer
# matches the running code — that is the only thing that changes what it says.
# The generator is seeded, so recomputing an artifact whose identity matches
# reproduces the same numbers; the only thing a recompute could change is the
# timestamp.
#
# This used to be a 24-hour window on the file's modification time, and that
# was wrong both ways. Regenerating the day before a demo, as docs/DEMO.md
# says to, put every artifact past the window by the time the demo started, so
# the backend refitted all ten forecasts on stage — minutes of "Computing" on
# every mine, for byte-identical numbers under a new `vintage`. And a fresh
# checkout sets every file time to the moment of checkout, so an artifact
# generated weeks earlier counted as brand new.
#
# Age is still reported (`artifact_age_hours`), read from the `vintage` the
# artifact recorded when it was generated rather than from the file. Past this
# threshold /readyz carries a warning for the pre-flight to print. It never
# forces a recompute and never affects readiness.
AGE_WARN_AFTER_HOURS = 48.0

#: Keys that record *when* an artifact was written rather than *what* it says,
#: at any depth (`vintage` also appears in each figure's provenance envelope).
#: A rewrite that would change only these is not a change, so it is not made.
GENERATION_STAMPS = frozenset({"vintage", "computed_at", "generated_at"})

# Bounded on purpose. The fit is CPU-bound and already threads internally
# through numpy/scikit-learn; more workers than this stopped helping and
# started starving the event loop.
MAX_WARM_WORKERS = int(os.environ.get("NAKSHATRA_WARM_WORKERS", "2"))

# Threads per fit are capped in `app/__init__.py`, which is the only module
# guaranteed to run before numpy is imported whatever the entry point. See the
# comment there: setting OMP_NUM_THREADS after numpy has loaded does nothing,
# and this module is not imported first by every entry point.
from app import FIT_THREADS  # noqa: E402  (re-exported for /readyz)
from app.core.artifact_guard import ArtifactWriteRefused, check_write  # noqa: E402

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

# The three entry points into the forecast. Everything they import, directly or
# transitively, is part of the forecast's code.
FORECAST_ROOT_MODULES = (
    "app.api.track_b",
    "app.ml.forecaster",
    "app.ingestion.generator",
)

# Import names that do not match their distribution name on PyPI.
_DISTRIBUTION_ALIASES = {"sklearn": "scikit-learn"}

_PACKAGE_ROOT = Path(__file__).resolve().parents[1]   # .../app


def _module_file(dotted: str, root: Path) -> Path | None:
    """Resolve `app.ml.forecaster` to a file inside this package, or None."""
    if dotted != "app" and not dotted.startswith("app."):
        return None
    rel = dotted.split(".")[1:]
    if not rel:
        return root / "__init__.py"
    module = root.joinpath(*rel).with_suffix(".py")
    if module.exists():
        return module
    package = root.joinpath(*rel) / "__init__.py"
    return package if package.exists() else None


def _imports_of(path: Path) -> list[str]:
    """Dotted module names imported by this file (absolute imports only)."""
    import ast

    try:
        tree = ast.parse(path.read_text(), filename=str(path))
    except (OSError, SyntaxError):
        return []
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            # `from app.ingestion import generator` imports a module, not a name,
            # so both readings are followed; the resolver drops whichever is not
            # a file.
            names.append(node.module)
            names.extend(f"{node.module}.{a.name}" for a in node.names)
    return names


@lru_cache(maxsize=8)
def _walk_forecast_imports(root: Path | None = None) -> tuple[tuple[Path, ...], frozenset[str]]:
    """
    (files in the forecast's import chain, third-party top-level modules it uses).

    Cached on `root`. Every request checks artifact identity, and identity needs
    the fingerprint; without the cache that meant parsing eight files with `ast`
    and hashing them on each call. Measured cost of getting this wrong: p95 on
    /forecast went from 1.5 ms to 58.8 ms, and /mines under ten concurrent
    forecasts from 14 ms to 186 ms. Source cannot change inside a running
    process, so caching costs nothing and a restart is the invalidation.

    Walked statically from the source, not from `sys.modules`: the set of
    imported modules at runtime depends on what else the process has touched,
    and a fingerprint that changes depending on whether pytest imported
    something would be worse than no fingerprint at all.
    """
    root = root or _PACKAGE_ROOT
    seen: set[str] = set()
    files: dict[str, Path] = {}
    third_party: set[str] = set()
    queue = list(FORECAST_ROOT_MODULES)
    while queue:
        dotted = queue.pop()
        if dotted in seen:
            continue
        seen.add(dotted)
        path = _module_file(dotted, root)
        if path is None:
            continue
        files[dotted] = path
        for name in _imports_of(path):
            if name.startswith("app.") or name == "app":
                queue.append(name)
            else:
                # Not `root` — that name is the package root in this scope.
                top = name.split(".")[0]
                if top not in sys.stdlib_module_names:
                    third_party.add(top)
    return tuple(sorted(set(files.values()))), frozenset(third_party)


@lru_cache(maxsize=8)
def _library_versions(root: Path) -> tuple[tuple[str, str], ...]:
    """
    Versions of the third-party libraries the forecast chain imports.

    scikit-learn's gradient-boosting output is not guaranteed stable across
    minor versions, and numpy/pandas changes move the inputs. An artifact
    produced under different versions is a different artifact.
    """
    from importlib.metadata import PackageNotFoundError, version

    _, third_party = _walk_forecast_imports(root)
    out: list[tuple[str, str]] = []
    for name in sorted(third_party):
        dist = _DISTRIBUTION_ALIASES.get(name, name)
        try:
            out.append((name, version(dist)))
        except PackageNotFoundError:
            out.append((name, "unknown"))
    return tuple(out)


def library_versions() -> dict[str, str]:
    """Versions of the third-party libraries the forecast chain imports."""
    return dict(_library_versions(_PACKAGE_ROOT))


def code_fingerprint() -> str:
    """
    Hash of every module in the forecast's import chain.

    This started as three hand-picked files, which is exactly the kind of list
    that goes stale silently: a change to `app/ml/constraints.py` or
    `app/ingestion/schemas.py` moves the numbers and left the fingerprint —
    and therefore the committed artifacts — unchanged. The chain is walked
    instead, so a new import is covered the moment it is written.

    The path is hashed alongside the bytes, so moving a file counts as a change.
    """
    return _code_fingerprint(_PACKAGE_ROOT)


@lru_cache(maxsize=8)
def _code_fingerprint(root: Path) -> str:
    import hashlib

    files, _ = _walk_forecast_imports(root)
    h = hashlib.sha256()
    for f in files:
        h.update(str(f.relative_to(root)).encode())
        h.update(b"\0")
        h.update(f.read_bytes())
    return h.hexdigest()[:16]


# The keys every synthetic-derived artifact must agree on, whatever its kind.
DATASET_IDENTITY_KEYS = ("generator", "contract_version", "generator_seed", "data_end_date")


def artifact_identity() -> dict[str, Any]:
    """
    Identity for one artifact: what dataset it came from, and what code built it.

    The first four keys are the dataset identity, shared with backtests and the
    exported samples (`generator.dataset_identity`). The rest are per-kind: the
    forecast origin is the last day of actuals, so the end date decides which
    window an artifact covers, and an artifact generated for a different end
    date describes a different fortnight.
    """
    from app.ingestion.generator import dataset_identity
    from app.ml.forecaster import MODEL_VERSION

    return {
        **dataset_identity(),
        "model_version": MODEL_VERSION,
        "code_fingerprint": code_fingerprint(),
        "library_versions": library_versions(),
    }


def dataset_identity_of(data: dict[str, Any]) -> dict[str, Any] | None:
    """The dataset identity an artifact of any kind claims, or None."""
    ident = data.get("artifact_identity") or {}
    got = {k: ident.get(k) for k in DATASET_IDENTITY_KEYS}
    return got if any(v is not None for v in got.values()) else None


def identity_matches(data: dict[str, Any]) -> tuple[bool, str | None]:
    """(matches, reason if not)."""
    want = artifact_identity()
    got = data.get("artifact_identity") or {}
    for key, expected in want.items():
        actual = got.get(key)
        if actual != expected:
            return False, f"{key}: artifact has {actual!r}, code has {expected!r}"
    return True, None


def file_fingerprint(path: Path) -> str:
    """Hash of one file, in the same form as `code_fingerprint`."""
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def _without_stamps(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _without_stamps(v) for k, v in obj.items() if k not in GENERATION_STAMPS}
    if isinstance(obj, list):
        return [_without_stamps(v) for v in obj]
    return obj


def says_the_same(path: Path, payload: dict[str, Any]) -> bool:
    """
    Does the artifact at `path` already say what `payload` says?

    Everything is compared — figures, identity, wording — except the generation
    stamps. Every artifact writer asks this before writing, so recomputing
    identical inputs leaves the file, and the `vintage` or `generated_at` it
    records, exactly as it was.

    Content is compared rather than identity alone so that the rule cannot hide
    a gap in the identity: if some input the identity does not capture moved
    the numbers, the file differs and is rewritten.
    """
    try:
        existing = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    # Round-trip the payload so dates and other `default=str` values compare as
    # they will be stored.
    fresh = json.loads(json.dumps(payload, default=str))
    return _without_stamps(existing) == _without_stamps(fresh)


def recorded_age_hours(data: dict[str, Any], field: str = "vintage") -> float | None:
    """
    Hours since the artifact says it was generated, or None if it does not say.

    Read from the artifact, never from the file. A checkout, a copy or a
    `git checkout -- backend/artifacts` sets the file time to "now", so the file
    cannot tell you how old the numbers in it are.
    """
    raw = data.get(field)
    if not raw:
        return None
    try:
        at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return round((datetime.now(timezone.utc) - at).total_seconds() / 3600.0, 2)


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

# Forecasts computed here that the write guard kept out of the committed set,
# per key: a process serving a dataset other than the recorded one — a script
# that imported track_b without adopting the record, say — computes for its own
# date and serves from here. Empty whenever the process serves the recorded
# dataset, which is every app and `batch all` run (app.core.artifact_guard).
_UNWRITTEN: dict[str, dict[str, Any]] = {}


def unwritten(mine_code: str, horizon_days: int) -> dict[str, Any] | None:
    """A forecast computed in this process but refused by the write guard."""
    with _LOCK:
        held = _UNWRITTEN.get(_key(mine_code, horizon_days))
        return dict(held) if held else None

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


def read_artifact(mine_code: str, horizon_days: int) -> dict[str, Any] | None:
    """
    Return the persisted forecast, annotated with its age, or None.

    None means missing, unreadable or produced by other code — never "old".
    """
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
    # Informational. An artifact that reaches this line is servable whatever its
    # age; there used to be an age-derived `artifact_stale` flag here, removed
    # because under identity-based staleness it could only ever be false.
    data["artifact_age_hours"] = recorded_age_hours(data)
    return data


def write_artifact(
    mine_code: str, horizon_days: int, payload: dict[str, Any]
) -> tuple[Path, bool]:
    """
    Persist a forecast. Returns (path, written).

    `written` is False when the artifact on disk already says the same thing —
    then the file, and the `vintage` it records, are left exactly as they were.
    """
    FORECAST_DIR.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["vintage"] = datetime.now(timezone.utc).isoformat()
    payload["artifact_identity"] = artifact_identity()
    path = artifact_path(mine_code, horizon_days)
    # Before anything else touches the file: a forecast for a dataset that is
    # not the recorded one never reaches the committed set (D-046).
    check_write(path, payload["artifact_identity"])
    if path.exists() and says_the_same(path, payload):
        return path, False
    # Write-then-rename, so a reader never sees a half-written artifact.
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=str))
    tmp.replace(path)
    return path, True


def is_fresh(mine_code: str, horizon_days: int) -> bool:
    """
    Fresh means: present AND produced by this code and this dataset.

    Age is not part of it. The startup warmer recomputes exactly the artifacts
    this rejects, so an age test here is a recompute of identical inputs.
    """
    path = artifact_path(mine_code, horizon_days)
    if not path.exists():
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
                try:
                    write_artifact(mine_code, horizon_days, payload)
                except ArtifactWriteRefused as refused:
                    # Computing for another dataset is allowed; writing it into
                    # the committed set is not. Said out loud, and kept in memory
                    # so this process can still serve what it computed.
                    print(f"[warm] {mine_code}: {refused}", file=sys.stderr, flush=True)
                    with _LOCK:
                        _UNWRITTEN[key] = {**payload, "served_from": "memory",
                                           "not_written": str(refused)}
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
    ages: list[float] = []
    for code in mine_codes:
        path = artifact_path(code, horizon_days)
        exists = path.exists()
        age: float | None = None

        # Identity is checked here, not only in read_artifact.
        #
        # This used to derive `fresh` from the file's mtime alone, so an
        # artifact produced by an older model was reported `ready` by /readyz
        # while /forecast refused to serve it — the readiness endpoint claiming
        # a green demo that the forecast endpoint would not deliver. Whatever
        # decides "servable" has to be the same in both places.
        #
        # Identity is now the whole test. Age is reported beside it, from the
        # artifact's own `vintage`, and does not enter `fresh`.
        identity_ok, identity_reason = (True, None)
        if exists:
            try:
                data = json.loads(path.read_text())
                identity_ok, identity_reason = identity_matches(data)
                age = recorded_age_hours(data)
            except (json.JSONDecodeError, OSError) as exc:
                identity_ok, identity_reason = False, f"unreadable: {exc}"
        if age is not None:
            ages.append(age)

        fresh = bool(exists and identity_ok)
        if fresh:
            ready += 1
        k = _key(code, horizon_days)
        with _LOCK:
            warming = k in _INFLIGHT
            failure = dict(_FAILED.get(k) or {})

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

    oldest = max(ages) if ages else None
    return {
        "ready": ready == len(mine_codes) and len(mine_codes) > 0,
        "mines_ready": ready,
        "mines_failed": failed,
        "mines_total": len(mine_codes),
        # Informational, for the pre-flight. Never affects `ready`.
        "oldest_artifact_age_hours": oldest,
        "age_warn_after_hours": AGE_WARN_AFTER_HOURS,
        "age_warning": (
            f"The oldest forecast artifact was generated {oldest:.0f} h ago "
            f"(warning above {AGE_WARN_AFTER_HOURS:.0f} h). It matches the running "
            "code, so it is served as it is and nothing is recomputed. If the demo "
            "is today, check its forecast window has not ended (docs/DEMO.md, "
            "'The day before')."
            if oldest is not None and oldest > AGE_WARN_AFTER_HOURS else None
        ),
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
