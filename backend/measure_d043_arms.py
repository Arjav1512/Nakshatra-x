"""
The per-arm statistics D-043 amendment 2 defines apart from the test code.

    NAKSHATRA_DATA_END_DATE=2026-10-06 python measure_d043_arms.py --arm crossing --out a.json

Two of the acceptance criteria are defined so that every arm is judged on what
it actually does, which the tests (written for the shipped arm) do not compute
for the others:

- **A2's precondition**: persistence across days, the same statistic for every
  arm — the mean over Balaghat's grades of the Pearson lag-1 of each grade's
  column of `residual_days` (every arm builds it) — and, separately, "wider
  than independent days" for every grade, from the residuals the arm's
  aggregation uses (`residual_block`).
- **A5**: removing the day with the largest absolute standardised residual,
  from the table for an arm with day blocks, or that day's rows from the
  interleaved series for an arm without. No grade's 14-day sd may move by 5%.

The interleaved series stores no day labels, so `fit`'s rows are rebuilt here
(same samples, order, split, rearrangement and floor) and checked to reproduce
the fitted residuals exactly before anything is measured.
"""
from __future__ import annotations

import argparse
import json
from datetime import timedelta

import numpy as np

from app.ingestion.generator import MINES, generate_all, resolve_data_end_date
from app.ml.backtest import _cumulative_paths
from app.ml.forecaster import (
    SEASONAL_PERIOD_DAYS,
    SIGMA_FLOOR_FRACTION,
    ProductionForecaster,
    build_covariates,
    build_series,
    make_features,
)

ARMS = {
    "both": {"rearrange": True, "day_blocks": True},
    "crossing": {"rearrange": True, "day_blocks": False},
    "blocks": {"rearrange": False, "day_blocks": True},
    "none": {"rearrange": False, "day_blocks": False},
}
H = list(range(1, 15))
PILOT = "MOIL-BAL-01"


def _row_days(fc: ProductionForecaster, series_by_key, cov, train_end, mine: str):
    """The target day of every entry of fc.residuals[mine], by rebuilding fit's rows."""
    start = fc.epoch + timedelta(days=SEASONAL_PERIOD_DAYS + 30)
    samples = []
    for (m, grade), series in series_by_key.items():
        if m != mine:
            continue
        for o in sorted(d for d in series if d <= train_end):
            if o < start:
                continue
            for h in H:
                t = o + timedelta(days=h)
                if t > train_end or t not in series:
                    continue
                samples.append((make_features(o, h, series, cov, m, grade, fc.opencast.get(m, False), fc.epoch),
                                float(series[t]), o, grade))
    samples.sort(key=lambda s: s[2])
    X = np.array([s[0] for s in samples], dtype=float)
    y = np.array([s[1] for s in samples], dtype=float)
    n = len(X)
    n_cal = min(max(50, int(n * fc.calibration_fraction)), n // 3)
    cal_idx = np.arange(n - n_cal, n)
    cal_q = np.vstack([fc.models[mine][q].predict(X[cal_idx]) for q in fc.quantiles])
    if fc.rearrange:
        cal_q = np.sort(cal_q, axis=0)
    step1 = X[cal_idx][:, 0].astype(int) == 1
    one_step = cal_idx[step1]
    lo, hi = cal_q[0][step1], cal_q[-1][step1]
    centre = cal_q[fc.quantiles.index(0.5)][step1]
    ok = (y[one_step] > 0) & (centre > 0) & (hi > lo) & (lo > 0)
    sd_day = np.maximum((np.log(hi[ok]) - np.log(lo[ok])) / (2 * 1.2815515655446004), 1e-6)
    if fc.rearrange:
        sd_day = np.maximum(sd_day, SIGMA_FLOOR_FRACTION * float(np.median(sd_day)))
    r = (np.log(y[one_step][ok]) - np.log(centre[ok])) / sd_day
    finite = np.isfinite(r)
    z = r[finite] / float(np.std(r[finite]))
    assert np.allclose(z, fc.residuals[mine]), f"{mine}: rebuilt rows do not reproduce the fitted residuals"
    return [samples[i][2] + timedelta(days=1) for i in one_step[ok][finite]]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", choices=sorted(ARMS), required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    end = resolve_data_end_date()
    d = generate_all(end=end)
    series = build_series(d["production_by_mine_grade_period"])
    cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
    opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    fc = ProductionForecaster(**ARMS[args.arm]).fit(series, cov, train_end=end, opencast=opencast)

    out: dict = {"arm": args.arm, "switches": ARMS[args.arm], "data_end_date": end.isoformat()}

    # ---- A2 on the pilot: persistence, and wider than independent ----------
    t = fc.residual_days[PILOT]
    lags = {g: float(np.corrcoef(t["table"][:-1, j], t["table"][1:, j])[0, 1]) for j, g in enumerate(t["grades"])}
    wider = {}
    for g in t["grades"]:
        preds = fc.predict(PILOT, g, end, H, series[(PILOT, g)], cov)
        b = _cumulative_paths(preds, fc.residual_block(PILOT, g))
        i = _cumulative_paths(preds, None)
        wider[g] = {"correlated_sd": round(float(np.std(b)), 1), "independent_sd": round(float(np.std(i)), 1),
                    "wider": bool(np.std(b) > np.std(i))}
    mean_lag = float(np.mean(list(lags.values())))
    out["A2"] = {
        "per_grade_day_lag1": {g: round(v, 3) for g, v in lags.items()},
        "precondition_mean_lag1": round(mean_lag, 3),
        "precondition_passes": mean_lag > 0.2,
        "wider_than_independent": wider,
        "wider_passes": all(w["wider"] for w in wider.values()),
    }

    # ---- A5, every mine ----------------------------------------------------
    a5 = {}
    for mine in sorted(fc.residual_days):
        tab = fc.residual_days[mine]
        moved = {}
        if fc.day_blocks:
            worst = int(np.argmax(np.max(np.abs(tab["table"]), axis=1)))
            worst_day = tab["days"][worst]
            for j, g in enumerate(tab["grades"]):
                preds = fc.predict(mine, g, end, H, series[(mine, g)], cov)
                full = float(np.std(_cumulative_paths(preds, tab["table"][:, j])))
                cut = float(np.std(_cumulative_paths(preds, np.delete(tab["table"], worst, axis=0)[:, j])))
                moved[g] = round(abs(cut - full) / full, 4)
        else:
            z = np.asarray(fc.residuals[mine], dtype=float)
            days = _row_days(fc, series, cov, end, mine)
            worst_day = days[int(np.argmax(np.abs(z)))]
            kept = np.array([dd != worst_day for dd in days])
            for g in tab["grades"]:
                preds = fc.predict(mine, g, end, H, series[(mine, g)], cov)
                full = float(np.std(_cumulative_paths(preds, z)))
                cut = float(np.std(_cumulative_paths(preds, z[kept])))
                moved[g] = round(abs(cut - full) / full, 4)
        a5[mine] = {"day_removed": worst_day.isoformat(), "relative_sd_change": moved,
                    "passes": all(v < 0.05 for v in moved.values())}
    out["A5"] = {"mines": a5, "passes": all(m["passes"] for m in a5.values())}

    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=2)
    print(json.dumps({k: (v if k != "A5" else {"passes": v["passes"]}) for k, v in out.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
