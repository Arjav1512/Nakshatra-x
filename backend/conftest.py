"""
Test-session safety: the committed artifacts, and the network.

THE NETWORK
-----------
Every test runs with outbound connections refused, except tests marked
`@pytest.mark.network`. No test that CI requires may depend on NASA POWER,
STAC, Planetary Computer or Open-Meteo being up: an unmarked test that reaches
for one meets a refusal every time, so its result cannot depend on whether the
service is up, slow or erroring. The marked tests run in their own non-blocking
CI job (docs/CI.md lists them).

Measured before this was written, with every non-loopback connection refused
and logged by test: all 75 backend tests outside Track B passed, and only
test_api's NASA POWER and STAC steps reached out. The app's background mosaic
registration also reaches Planetary Computer at boot; it degrades on refusal
and no test depends on it.

The block is at the Python socket layer, so a C-level client would pass it —
GDAL's HTTP reads, say. No unmarked test uses one (also measured).

THE COMMITTED ARTIFACTS
-----------------------
The committed artifacts are what the demo serves. PR #16 guarded them with a
session fixture in test_demo_hardening.py that hashed `artifacts/forecasts`
before and after the run. During the staleness change it stayed silent while
the test client's startup warmer overwrote two committed forecasts (TIR-04 and
UKW-03), for two reasons:

1. Nothing redirected where a test client writes. A client boots the real app,
   and its startup warmer — like any forecast request for a stale mine, or a
   backtest request with `?compute=true` — writes through
   `forecast_store.FORECAST_DIR` / `track_b.BACKTEST_CACHE_DIR`: the committed
   directories.
2. The check ran before the writes. `forecast_store.shutdown()` drops queued
   flights but does not wait for running ones, so fits the client started kept
   running after it closed. They wrote after the guard's final hash, while the
   interpreter waited on their threads at exit, and the run reported green.

It also lived in one module, so a session that did not collect that module had
no guard at all, and it hashed forecasts only.

So, for every test in every module:

- every write goes to a session copy (`_artifact_writes_go_to_a_session_copy`):
  test clients — startup warmer, request path, `?compute=true` — read and write
  forecasts and backtests there, never in the committed directories;
- the guard (`committed_artifacts_are_untouched`) hashes every committed
  artifact — forecasts, backtests, calibration, samples — and waits for every
  forecast flight to finish before its final hash, so no thread can outrun it.
"""
from __future__ import annotations

import hashlib
import ipaddress
import shutil
import socket
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import forecast_store as fs
from app.main import app

REPO = Path(__file__).resolve().parents[1]

#: Everything `python -m app.api.batch all` produces, and the demo serves.
COMMITTED_ARTIFACT_DIRS = (REPO / "backend" / "artifacts", REPO / "data" / "synthetic")


def committed_digest() -> dict[str, str]:
    """sha256 of every committed artifact, by repo-relative path."""
    out: dict[str, str] = {}
    for root in COMMITTED_ARTIFACT_DIRS:
        for f in sorted(root.rglob("*")):
            # `.warm.lock` is rewritten by every boot and is gitignored.
            if f.is_file() and not f.name.startswith(".") and not f.name.endswith(".tmp"):
                out[str(f.relative_to(REPO))] = hashlib.sha256(f.read_bytes()).hexdigest()
    return out


def changed_between(before: dict[str, str], after: dict[str, str]) -> list[str]:
    return sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))


#: `thread_name_prefix` of the store's pool (forecast_store._pool).
WARM_THREAD_PREFIX = "forecast-warm"


def drain_forecast_flights(timeout: float = 300.0) -> None:
    """
    Cancel queued forecast flights and wait for running ones to finish writing.

    `forecast_store.shutdown()` does the first and not the second, which is
    right for a server stopping and wrong for a test about to check what was
    written. And it detaches the pool: once a test client has closed, the app's
    lifespan has already called it, so the store no longer holds the pool whose
    fits are still running. Waiting on `_POOL` therefore waits on nothing — the
    first version of this function did exactly that, and the guard passed while
    two late flights wrote behind it (test_artifact_guard covers that case).
    So the running flights are found by their threads, which outlive the pool.

    This reaches into the store rather than adding a `wait` flag to
    `shutdown()`: forecast_store.py is in the forecast's fingerprinted import
    chain, so editing it, even for a test hook, would mark every committed
    artifact stale.
    """
    with fs._LOCK:
        pool, fs._POOL = fs._POOL, None
    if pool is not None:
        pool.shutdown(wait=False, cancel_futures=True)
    deadline = time.time() + timeout
    for t in threading.enumerate():
        if t.name.startswith(WARM_THREAD_PREFIX):
            t.join(max(0.0, deadline - time.time()))
            assert not t.is_alive(), (
                f"forecast flight {t.name} still running after {timeout:.0f} s; "
                "what it writes cannot be checked"
            )
    with fs._LOCK:
        fs._INFLIGHT.clear()
        fs._STARTED_AT.clear()
        fs._FAILED.clear()


@pytest.fixture(scope="session", autouse=True)
def committed_artifacts_are_untouched():
    """Fail the run if any committed artifact changed, however it got written."""
    before = committed_digest()
    yield
    # Only after every flight has finished: a fit still running here would
    # write after this check, which is exactly how the PR #16 guard was outrun.
    drain_forecast_flights()
    changed = changed_between(before, committed_digest())
    assert not changed, (
        "the test run modified committed artifacts: " + ", ".join(changed)
        + " — something wrote outside the session copy. Roll back with "
        "`git checkout -- backend/artifacts data/synthetic`."
    )


@pytest.fixture(scope="session", autouse=True)
def _artifact_writes_go_to_a_session_copy(committed_artifacts_are_untouched, tmp_path_factory):
    """
    Point the forecast and backtest stores at a copy for the whole session.

    The paths are module attributes read at call time, so this covers every
    test client and every background flight, whenever it writes. Tests that
    monkeypatch a store to their own tmp_path restore it to this copy. The copy
    starts byte-identical to the committed set, so reads are unchanged; tests
    that must judge the committed files themselves read them by path
    (test_demo_hardening.COMMITTED_FORECASTS).
    """
    from app.api import track_b

    root = tmp_path_factory.mktemp("artifacts")
    real = (fs.FORECAST_DIR, track_b.BACKTEST_CACHE_DIR)
    copies = (root / "forecasts", root / "backtests")
    for src, dst in zip(real, copies):
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".*", "*.tmp"))
    fs.FORECAST_DIR, track_b.BACKTEST_CACHE_DIR = copies
    yield
    # Restore only once nothing can still write through the copied paths.
    drain_forecast_flights()
    fs.FORECAST_DIR, track_b.BACKTEST_CACHE_DIR = real


@pytest.fixture(scope="module")
def client():
    """The app as a test client, with startup warming on, as it runs for real."""
    with TestClient(app) as c:
        yield c
        # Before the lifespan closes: flights this client started must not keep
        # running into the next module's tests.
        drain_forecast_flights()


@pytest.fixture
def artifact_digest():
    """`committed_digest`, for tests that check the guard's own condition."""
    return committed_digest


@pytest.fixture
def drain_flights():
    """`drain_forecast_flights`, for tests of the guard's timing."""
    return drain_forecast_flights


# ---------------------------------------------------------------------------
# The network (module docstring, THE NETWORK)
# ---------------------------------------------------------------------------

#: Set only while a test marked `network` runs. Read by the patched socket
#: functions, which background threads use too — so the app's own threads are
#: offline for the whole session, not only inside unmarked tests.
_network_allowed = threading.Event()

_LOCAL_NAMES = {"localhost", "testserver"}


def _is_local(host) -> bool:
    if host is None:
        return True
    name = host.decode() if isinstance(host, bytes) else str(host)
    if name in _LOCAL_NAMES:
        return True
    try:
        ip = ipaddress.ip_address(name.split("%")[0])
    except ValueError:
        return False
    return ip.is_loopback or ip.is_unspecified


def _refusal(host) -> str:
    return (
        f"{host!r}: outbound network is off for tests not marked "
        "@pytest.mark.network (backend/conftest.py, THE NETWORK)"
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "network: reaches an external service (NASA POWER, STAC, Planetary "
        "Computer, Open-Meteo); runs in CI's non-blocking network job only",
    )


def pytest_report_header(config):
    n = len(committed_digest())
    return [
        f"committed-artifact guard: active — {n} committed files watched; "
        "forecast and backtest writes go to a session copy",
        "network: off, except in tests marked @pytest.mark.network",
    ]


@pytest.fixture(scope="session", autouse=True)
def _network_off_for_the_session():
    real_getaddrinfo, real_connect = socket.getaddrinfo, socket.socket.connect

    def getaddrinfo(host, *args, **kwargs):
        if not _network_allowed.is_set() and not _is_local(host):
            raise socket.gaierror(socket.EAI_NONAME, _refusal(host))
        return real_getaddrinfo(host, *args, **kwargs)

    def connect(self, address):
        host = address[0] if isinstance(address, tuple) else None
        if host is not None and not _network_allowed.is_set() and not _is_local(host):
            raise ConnectionRefusedError(_refusal(host))
        return real_connect(self, address)

    socket.getaddrinfo, socket.socket.connect = getaddrinfo, connect
    yield
    socket.getaddrinfo, socket.socket.connect = real_getaddrinfo, real_connect


@pytest.fixture(autouse=True)
def _network_only_when_marked(request):
    if request.node.get_closest_marker("network") is None:
        yield
        return
    _network_allowed.set()
    try:
        yield
    finally:
        _network_allowed.clear()
