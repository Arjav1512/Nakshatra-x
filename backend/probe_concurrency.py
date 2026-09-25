"""
Black-box concurrency probe. Works against any backend over HTTP.

Used to revert-proof the demo hardening: this runs unchanged against the
pre-fix backend, which cannot import the new modules.

  python probe_concurrency.py [BASE_URL]
"""
from __future__ import annotations

import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000") + "/api/v1"


def get(path: str, timeout: float = 180.0) -> tuple[str, int, float]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            r.read()
            return path, r.status, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        e.read()
        return path, e.code, time.perf_counter() - t0
    except Exception as exc:
        return path, -1, time.perf_counter() - t0


def main() -> int:
    paths = [f"/mines/{i}/forecast?horizon_days=14" for i in range(1, 11)] + ["/mines"] * 5
    print(f"firing {len(paths)} concurrent requests at {BASE}")
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=len(paths)) as pool:
        res = list(pool.map(get, paths))
    elapsed = time.perf_counter() - t0

    mines = [(c, t) for p, c, t in res if p == "/mines"]
    fc = [(c, t) for p, c, t in res if "forecast" in p]
    hard_5xx = [(p, c) for p, c, _ in res if c >= 500 and c != 503]
    failed_conn = [(p, c) for p, c, _ in res if c == -1]

    print(f"  wall clock            : {elapsed:.1f}s")
    print(f"  /mines statuses       : {sorted({c for c, _ in mines})}")
    print(f"  /mines slowest        : {max((t for _, t in mines), default=0):.1f}s")
    print(f"  /forecast statuses    : {sorted({c for c, _ in fc})}")
    print(f"  5xx excluding 503     : {len(hard_5xx)}  {hard_5xx[:4]}")
    print(f"  connection failures   : {len(failed_conn)}")

    ok = not hard_5xx and not failed_conn and all(c == 200 for c, _ in mines)
    print(f"\n{'PASS' if ok else 'FAIL'} — /mines stayed healthy and nothing returned a hard 5xx")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
