"""
How often the forecaster's quantiles cross — D-043, part 1.

    NAKSHATRA_DATA_END_DATE=2026-10-06 python measure_quantile_crossing.py --out crossing.json

q10, q50 and q90 come from three gradient-boosting models fitted independently,
so nothing makes them ordered. On one Balaghat calibration day q90 fell below
q50 and onto q10, and that single row is what made the 14-day distribution
narrower than independent days (DECISIONS.md D-043). This counts how often it
happens, in the three places the quantiles are used:

- **calibration** — the served forecaster's calibration slice (the rows its
  conformal widths and its residual series come from): every row, and the
  one-step rows the residuals are built from;
- **served** — every mine, grade and horizon 1-14 at the dataset's end date;
- **backtest** — the calibration harness's design (24 origins, step 14 days,
  every mine, grade and horizon 1-14), refitting before each origin.

For served and backtest rows it counts twice: the **raw** model outputs, and
the interval **after** the conformal adjustment as `predict` returns it. The
conformal width can be negative, which moves the endpoints towards each other
and can cross them again; calibration rows have no conformal step.

Three kinds per row — q10 > q50, q50 > q90, q10 > q90 — and `any`.

It reads the forecaster through `fit`'s own construction (the same samples,
sort and split), so it describes the code it is run on: on main, the defect;
after the fix, what the fix leaves. Quiet machine, one process.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from collections import defaultdict
from datetime import date, timedelta

import numpy as np

from app.ingestion.generator import MINES, generate_all, resolve_data_end_date
from app.ml.forecaster import (
    SEASONAL_PERIOD_DAYS,
    ProductionForecaster,
    build_covariates,
    build_series,
    make_features,
)

MAX_H = 14
SPAN, STEP = 340, 14  # the calibration harness's design


def _kinds(q10: np.ndarray, q50: np.ndarray, q90: np.ndarray) -> dict:
    a, b, c = q10 > q50, q50 > q90, q10 > q90
    n = int(len(q10))
    out = {"rows": n}
    for name, m in (("q10>q50", a), ("q50>q90", b), ("q10>q90", c), ("any", a | b | c)):
        k = int(np.sum(m))
        out[name] = {"count": k, "share": round(k / n, 5) if n else None}
    return out


def _calibration_rows(fc: ProductionForecaster, series_by_key, cov, train_end: date, mine: str):
    """`fit`'s samples for one mine, in `fit`'s order, and its calibration split."""
    start = fc.epoch + timedelta(days=SEASONAL_PERIOD_DAYS + 30)
    samples = []
    for (m, grade), series in series_by_key.items():
        if m != mine:
            continue
        for o in sorted(d for d in series if d <= train_end):
            if o < start:
                continue
            for h in range(1, MAX_H + 1):
                target = o + timedelta(days=h)
                if target > train_end or target not in series:
                    continue
                x = make_features(o, h, series, cov, m, grade, fc.opencast.get(m, False), fc.epoch)
                samples.append((x, o))
    samples.sort(key=lambda t: t[1])
    X = np.array([s[0] for s in samples], dtype=float)
    n = len(X)
    n_cal = min(max(50, int(n * fc.calibration_fraction)), n // 3)
    return X[n - n_cal:]


def _raw(fc: ProductionForecaster, mine: str, X: np.ndarray):
    fits = fc.models[mine]
    q = fc.quantiles
    return fits[q[0]].predict(X), fits[q[1]].predict(X), fits[q[-1]].predict(X)


def _accumulate(acc: dict, key: str, q10, q50, q90) -> None:
    for name, arr in (("q10", q10), ("q50", q50), ("q90", q90)):
        acc[key][name].append(np.asarray(arr, dtype=float))


def _summarise(acc: dict) -> dict:
    out = {}
    for key, cols in acc.items():
        q10, q50, q90 = (np.concatenate(cols[c]) if cols[c] else np.array([]) for c in ("q10", "q50", "q90"))
        out[key] = _kinds(q10, q50, q90)
    return out


def _predict_rows(fc, series_by_key, cov, origin: date, acc: dict, place: str) -> None:
    horizons = list(range(1, MAX_H + 1))
    for (mine, grade), series in series_by_key.items():
        if mine not in fc.models:
            continue
        X = np.array([
            make_features(origin, h, series, cov, mine, grade, fc.opencast.get(mine, False), fc.epoch)
            for h in horizons
        ], dtype=float)
        _accumulate(acc, f"{place}.raw", *_raw(fc, mine, X))
        _accumulate(acc, f"{place}.raw.{mine}", *_raw(fc, mine, X))
        p = fc.predict(mine, grade, origin, horizons, series, cov)
        after = [np.array([p[h][k] for h in horizons]) for k in ("q10", "q50", "q90")]
        _accumulate(acc, f"{place}.after_conformal", *after)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    t0 = time.time()
    end = resolve_data_end_date()
    d = generate_all(end=end)
    series = build_series(d["production_by_mine_grade_period"])
    cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
    opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    acc: dict = defaultdict(lambda: {"q10": [], "q50": [], "q90": []})

    # The served forecaster: fitted through the end date, as track_b fits it.
    fc = ProductionForecaster().fit(series, cov, train_end=end, opencast=opencast)
    for mine in sorted(fc.models):
        Xc = _calibration_rows(fc, series, cov, end, mine)
        q10, q50, q90 = _raw(fc, mine, Xc)
        _accumulate(acc, "calibration.all_horizons", q10, q50, q90)
        one = Xc[:, 0].astype(int) == 1
        _accumulate(acc, "calibration.one_step", q10[one], q50[one], q90[one])
        _accumulate(acc, f"calibration.one_step.{mine}", q10[one], q50[one], q90[one])
    _predict_rows(fc, series, cov, end, acc, "served")
    print(f"served forecaster done in {time.time() - t0:.0f}s", flush=True)

    origins = []
    o = end - timedelta(days=SPAN)
    while o + timedelta(days=MAX_H) <= end:
        origins.append(o)
        o += timedelta(days=STEP)
    for i, origin in enumerate(origins, 1):
        t1 = time.time()
        fb = ProductionForecaster().fit(
            series, cov, train_end=origin - timedelta(days=1),
            horizons=tuple(range(1, MAX_H + 1)), opencast=opencast,
        )
        _predict_rows(fb, series, cov, origin, acc, "backtest")
        print(f"  [{i}/{len(origins)}] {origin} {time.time() - t1:5.1f}s", flush=True)

    report = {
        "data_end_date": end.isoformat(),
        "env_end_date": os.environ.get("NAKSHATRA_DATA_END_DATE"),
        "backtest_origins": {"n": len(origins), "first": origins[0].isoformat(),
                             "last": origins[-1].isoformat(), "step_days": STEP},
        "counts": _summarise(acc),
        "seconds": round(time.time() - t0, 1),
    }
    with open(args.out, "w") as fh:
        json.dump(report, fh, indent=2)

    print(f"\ndataset end {end}   ({report['seconds']} s)")
    print(f"{'place':34} {'rows':>7} {'q10>q50':>9} {'q50>q90':>9} {'q10>q90':>9} {'any':>9}  share")
    for key, c in report["counts"].items():
        if key.count(".") > 1 and not key.startswith("calibration.one_step."):
            continue
        if key.startswith("calibration.one_step.") or key.startswith("served.raw.") or key.startswith("backtest.raw."):
            continue
        print(f"{key:34} {c['rows']:7d} {c['q10>q50']['count']:9d} {c['q50>q90']['count']:9d} "
              f"{c['q10>q90']['count']:9d} {c['any']['count']:9d}  {c['any']['share']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
