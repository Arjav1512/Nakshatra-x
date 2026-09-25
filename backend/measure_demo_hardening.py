"""
Demo-hardening measurements, both paths, quiet environment.

  python measure_demo_hardening.py            # real demo path (artifacts present)
  python measure_demo_hardening.py --cold     # cold path (no artifacts, SKIP_WARM)

Reports: cold start to ready, p95 for /forecast and /mines, p95 during active
warming, a concurrency check and an abandon check.
"""
from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "http://127.0.0.1:8000/api/v1"
ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "forecasts"


def get(path: str, timeout: float = 120.0) -> tuple[int, float]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            r.read()
            return r.status, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        e.read()
        return e.code, time.perf_counter() - t0
    except Exception:
        return 0, time.perf_counter() - t0


def p95(xs: list[float]) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))]


def start_backend(skip_warm: bool) -> subprocess.Popen:
    env = dict(os.environ)
    if skip_warm:
        env["NAKSHATRA_SKIP_WARM"] = "1"
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8000", "--log-level", "warning"],
        cwd=str(ROOT), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def wait_for(path: str, want: int, limit: float) -> float | None:
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < limit:
        code, _ = get(path, timeout=5)
        if code == want:
            return time.perf_counter() - t0
        time.sleep(0.2)
    return None


def main() -> int:
    cold = "--cold" in sys.argv
    label = "COLD PATH (no artifacts, SKIP_WARM=1)" if cold else "DEMO PATH (committed artifacts)"

    stash = None
    if cold and ARTIFACTS.exists():
        stash = ARTIFACTS.with_name("forecasts.stashed")
        if stash.exists():
            subprocess.run(["rm", "-rf", str(stash)], check=False)
        ARTIFACTS.rename(stash)

    proc = start_backend(skip_warm=cold)
    out: dict = {"path": label}
    try:
        live = wait_for("/healthz", 200, 90)
        out["seconds_to_healthz"] = round(live, 2) if live else None

        if not cold:
            ready = wait_for("/readyz", 200, 900)
            out["seconds_to_readyz"] = round(ready, 2) if ready else None
        else:
            out["seconds_to_readyz"] = None  # never ready by design

        # p95, steady state
        f_lat = [get("/mines/1/forecast?horizon_days=14")[1] for _ in range(20)]
        m_lat = [get("/mines")[1] for _ in range(20)]
        out["p95_forecast_ms"] = round(p95(f_lat) * 1000, 1)
        out["p95_mines_ms"] = round(p95(m_lat) * 1000, 1)

        # concurrency: 10 parallel forecasts + 5 /mines
        paths = [f"/mines/{i}/forecast?horizon_days=14" for i in range(1, 11)] + ["/mines"] * 5
        with ThreadPoolExecutor(max_workers=15) as pool:
            res = list(pool.map(lambda p: (p, *get(p)), paths))
        codes = [c for _, c, _ in res]
        out["concurrency_status_codes"] = sorted(set(codes))
        out["concurrency_5xx_excluding_503"] = sum(1 for c in codes if c >= 500 and c != 503)
        mines_codes = [c for p, c, _ in res if p == "/mines"]
        mines_lat = [t for p, _, t in res if p == "/mines"]
        out["mines_under_load_all_200"] = all(c == 200 for c in mines_codes)
        out["p95_mines_during_load_ms"] = round(p95(mines_lat) * 1000, 1)

        # p95 during ACTIVE warming — the realistic "just started" case
        if cold:
            for i in range(1, 4):
                get(f"/mines/{i}/forecast?horizon_days=14", timeout=5)
            time.sleep(1.0)
            wm = [get("/mines")[1] for _ in range(20)]
            wf = [get("/mines/1/forecast?horizon_days=14")[1] for _ in range(20)]
            out["p95_mines_during_warming_ms"] = round(p95(wm) * 1000, 1)
            out["p95_forecast_during_warming_ms"] = round(p95(wf) * 1000, 1)

        # abandon: fire and drop, then confirm the process returns to idle
        t0 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=10) as pool:
            list(pool.map(lambda p: get(p, timeout=0.05), paths[:10]))
        time.sleep(3)
        code, lat = get("/mines")
        out["after_abandon_mines_status"] = code
        out["after_abandon_mines_ms"] = round(lat * 1000, 1)
        out["abandon_window_s"] = round(time.perf_counter() - t0, 1)

        # /readyz answers 503 while anything is unready, which is the point of
        # it — so read the body regardless of status rather than treating the
        # 503 as an error.
        try:
            with urllib.request.urlopen(BASE + "/readyz", timeout=10) as r:
                ready_body = json.loads(r.read())
        except urllib.error.HTTPError as e:
            ready_body = json.loads(e.read())
        out["readyz_status"] = "ready" if ready_body.get("ready") else "not ready"
        out["readyz_mines_ready"] = ready_body.get("mines_ready")
        out["readyz_mines_failed"] = ready_body.get("mines_failed")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
        if stash is not None:
            subprocess.run(["rm", "-rf", str(ARTIFACTS)], check=False)
            stash.rename(ARTIFACTS)

    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
