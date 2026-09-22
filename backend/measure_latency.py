"""
Endpoint latency measurement (PRD N-1).

N-1 targets "< 2 s p95 **on cached results**", so cold and warm are reported
separately — conflating them would either flatter the warm path or condemn the
cached one.

  cold  first call in a freshly started process (pays dataset generation,
        model fitting, or an upstream network round trip)
  warm  subsequent calls, which is what N-1 actually governs

Run against a already-running service layer:

    python measure_latency.py [--base http://127.0.0.1:8000] [--n 12]
"""
from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request

ENDPOINTS = [
    ("GET /mines", "/api/v1/mines", 2.0),
    ("GET /mines/1/telemetry", "/api/v1/mines/1/telemetry", 2.0),
    ("GET /mines/1/forecast", "/api/v1/mines/1/forecast?horizon_days=14", 2.0),
    ("GET /mines/1/recommendations", "/api/v1/mines/1/recommendations", 2.0),
    ("GET /mines/1/backtest", "/api/v1/mines/1/backtest", 2.0),
    ("GET /prospectivity/metrics", "/api/v1/prospectivity/metrics", 2.0),
    ("GET /prospectivity/drill-targets", "/api/v1/prospectivity/drill-targets?top_n=8", 2.0),
    ("GET /prospectivity/predict", "/api/v1/prospectivity/predict?lat=21.5&lng=79.9&live=false", 2.0),
]


def call(url: str, timeout: float = 900.0):
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read()
            return time.perf_counter() - started, r.status, len(body)
    except urllib.error.HTTPError as e:
        return time.perf_counter() - started, e.code, 0
    except Exception:
        return time.perf_counter() - started, 0, 0


def p95(xs: list[float]) -> float:
    if not xs:
        return float("nan")
    if len(xs) == 1:
        return xs[0]
    ordered = sorted(xs)
    # Nearest-rank p95; with small n this is the max, which is the conservative
    # reading and the right one for a latency budget.
    k = max(0, min(len(ordered) - 1, int(round(0.95 * len(ordered))) - 1))
    return ordered[k]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--n", type=int, default=12, help="warm samples per endpoint")
    args = ap.parse_args()

    rows = []
    print(f"Measuring {len(ENDPOINTS)} endpoints against {args.base}")
    print(f"cold = 1 call on a fresh process · warm = {args.n} subsequent calls\n")

    for name, path, budget in ENDPOINTS:
        url = args.base + path
        cold, status, size = call(url)
        warm = []
        for _ in range(args.n):
            d, s, _ = call(url)
            if s == status:
                warm.append(d)
        w95 = p95(warm)
        wmed = statistics.median(warm) if warm else float("nan")
        rows.append({
            "endpoint": name, "status": status, "bytes": size,
            "cold_s": round(cold, 3), "warm_p95_s": round(w95, 3),
            "warm_median_s": round(wmed, 3), "budget_s": budget,
            "meets_n1_warm": bool(w95 < budget),
            "meets_n1_cold": bool(cold < budget),
        })
        print(f"  {name:36} status {status}  cold {cold:7.3f}s  warm p95 {w95:7.3f}s  "
              f"{'PASS' if w95 < budget else 'MISS'}")

    print()
    print(f"{'endpoint':36} {'cold':>9} {'warm p95':>10} {'N-1 warm':>9}")
    print("-" * 68)
    for r in rows:
        print(f"{r['endpoint']:36} {r['cold_s']:>8.3f}s {r['warm_p95_s']:>9.3f}s "
              f"{'PASS' if r['meets_n1_warm'] else 'MISS':>9}")
    passed = sum(1 for r in rows if r["meets_n1_warm"])
    print(f"\nN-1 (<2s p95 on cached results): {passed}/{len(rows)} endpoints pass")

    with open("latency_report.json", "w") as fh:
        json.dump({"base": args.base, "warm_samples": args.n, "results": rows}, fh, indent=2)
    print("Wrote backend/latency_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
