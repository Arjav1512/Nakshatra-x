"""
Held-out validation of the 14-day cumulative distribution.

WHY THIS EXISTS SEPARATELY FROM THE BACKTEST
--------------------------------------------
The committed backtest artifact measures one mine at ten origin dates, so its
cumulative coverage moves in steps of 1/40 = 0.025 and a three-window swing
looks like a fifteen-point change. That is far too coarse to decide whether a
calibration helped.

`ProductionForecaster.fit` fits every mine in one pass, and the rolling-origin
protocol's whole cost is that refit. So evaluating all ten mines at each origin
costs the same as evaluating one and yields roughly forty times the windows.

    python measure_cumulative_calibration.py --span 250 --step 7

Runs on this branch and on main unchanged: the calibrated arm is skipped
automatically where the loading does not exist, so before and after can be
measured on identical origins.

Quiet environment, one process, no parallel runs — the numbers are timings-free
but the refits are CPU-bound and a busy machine changes nothing about coverage,
only about how long you wait.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, timedelta

import numpy as np

from app.ingestion.generator import MINES, generate_all
from app.ml.forecaster import (
    ProductionForecaster,
    build_covariates,
    build_series,
)

MAX_H = 14
UNIFORM_PIT_SD = 1.0 / np.sqrt(12.0)

try:  # this branch
    from app.ml.forecaster import cumulative_paths

    HAVE_SHARED = True
except ImportError:  # main
    from app.ml.backtest import _cumulative_paths as cumulative_paths

    HAVE_SHARED = False


def _paths(preds, residuals, rho):
    if rho == 0.0:
        return cumulative_paths(preds, residuals)
    return cumulative_paths(preds, residuals, rho=rho)


def _summarise(pit: list[float], inside: list[bool]) -> dict:
    p = np.array(pit, dtype=float)
    return {
        "n_windows": int(len(p)),
        "coverage_80": round(float(np.mean(inside)), 3),
        "coverage_gap": round(float(np.mean(inside)) - 0.80, 3),
        "pit_at_extremes": round(float(np.mean((p < 0.05) | (p > 0.95))), 3),
        "pit_at_extremes_gap": round(float(np.mean((p < 0.05) | (p > 0.95))) - 0.10, 3),
        "mean_pit": round(float(np.mean(p)), 3),
        "pit_sd": round(float(np.std(p)), 4),
        "pit_sd_target": round(float(UNIFORM_PIT_SD), 4),
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--span", type=int, default=250, help="days of test window")
    ap.add_argument("--step", type=int, default=7, help="days between origins")
    ap.add_argument("--out", default="", help="write the report to this JSON path")
    args = ap.parse_args(argv)

    d = generate_all()
    series = build_series(d["production_by_mine_grade_period"])
    cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
    opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    end = date.fromisoformat(d["window"]["end"])

    origins: list[date] = []
    o = end - timedelta(days=args.span)
    while o + timedelta(days=MAX_H) <= end:
        origins.append(o)
        o += timedelta(days=args.step)

    codes = [m.code for m in MINES]
    print(
        f"cumulative calibration validation — {len(origins)} origins "
        f"{origins[0]} .. {origins[-1]}, {len(codes)} mines, "
        f"loading {'available' if HAVE_SHARED else 'NOT PRESENT (main)'}"
    )

    raw: dict[str, tuple[list, list]] = {c: ([], []) for c in codes}
    cal: dict[str, tuple[list, list]] = {c: ([], []) for c in codes}
    rhos: dict[str, list[float]] = {c: [] for c in codes}

    full = list(range(1, MAX_H + 1))
    t_start = time.time()
    for i, origin in enumerate(origins, 1):
        t0 = time.time()
        fc = ProductionForecaster().fit(
            series, cov, train_end=origin - timedelta(days=1),
            horizons=tuple(full), opencast=opencast,
        )
        for code in codes:
            if code not in fc.models:
                continue
            res = fc.residuals.get(code)
            if res is None:
                continue
            rho = float(getattr(fc, "rho_for", lambda _c: 0.0)(code))
            rhos[code].append(rho)
            for g in sorted({k[1] for k in series if k[0] == code}):
                s = series[(code, g)]
                actuals = [s.get(origin + timedelta(days=h)) for h in full]
                if any(a is None for a in actuals):
                    continue
                preds = fc.predict(code, g, origin, full, s, cov)
                realised = float(sum(float(a) for a in actuals))

                sr = _paths(preds, res, 0.0)
                if sr is not None:
                    raw[code][0].append(float(np.mean(sr < realised)))
                    lo, hi = np.percentile(sr, [10, 90])
                    raw[code][1].append(bool(lo <= realised <= hi))
                if HAVE_SHARED:
                    sc = _paths(preds, res, rho)
                    if sc is not None:
                        cal[code][0].append(float(np.mean(sc < realised)))
                        lo, hi = np.percentile(sc, [10, 90])
                        cal[code][1].append(bool(lo <= realised <= hi))
        done = sum(len(v[0]) for v in raw.values())
        print(
            f"  [{i}/{len(origins)}] {origin} {time.time()-t0:5.1f}s  "
            f"windows so far {done}",
            flush=True,
        )

    all_raw = ([], [])
    all_cal = ([], [])
    for c in codes:
        all_raw[0].extend(raw[c][0]); all_raw[1].extend(raw[c][1])
        all_cal[0].extend(cal[c][0]); all_cal[1].extend(cal[c][1])

    report = {
        "origins": {"n": len(origins), "first": origins[0].isoformat(),
                    "last": origins[-1].isoformat(), "step_days": args.step},
        "loading_available": HAVE_SHARED,
        "nominal": {"coverage_80": 0.80, "pit_at_extremes": 0.10},
        "pooled": {
            "rho_0": _summarise(*all_raw),
            "calibrated": _summarise(*all_cal) if all_cal[0] else None,
        },
        "per_mine": {
            c: {
                "rho_mean": round(float(np.mean(rhos[c])), 3) if rhos[c] else None,
                "rho_range": [round(float(np.min(rhos[c])), 3),
                              round(float(np.max(rhos[c])), 3)] if rhos[c] else None,
                "rho_0": _summarise(*raw[c]) if raw[c][0] else None,
                "calibrated": _summarise(*cal[c]) if cal[c][0] else None,
            }
            for c in codes
        },
        "elapsed_seconds": round(time.time() - t_start, 1),
    }

    print()
    print("POOLED, rho = 0 (block bootstrap only):")
    print(json.dumps(report["pooled"]["rho_0"], indent=2))
    if report["pooled"]["calibrated"]:
        print("POOLED, calibrated loading:")
        print(json.dumps(report["pooled"]["calibrated"], indent=2))
    print()
    print(f"{'mine':14} {'rho':>6}  {'cov80 rho=0':>11} {'cov80 cal':>9}  "
          f"{'tails rho=0':>11} {'tails cal':>9}")
    for c in codes:
        pm = report["per_mine"][c]
        r0, rc = pm["rho_0"], pm["calibrated"]
        if not r0:
            continue
        print(
            f"{c:14} {pm['rho_mean'] if pm['rho_mean'] is not None else float('nan'):6.2f}  "
            f"{r0['coverage_80']:11.3f} {rc['coverage_80'] if rc else float('nan'):9.3f}  "
            f"{r0['pit_at_extremes']:11.3f} {rc['pit_at_extremes'] if rc else float('nan'):9.3f}"
        )

    if args.out:
        with open(args.out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
