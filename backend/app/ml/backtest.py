"""
Rolling-origin backtest (PRD B-10 [D] P0, N-8).

PRD §11 lists "Forecast MAPE against held-out production history" as *the only
honest measure of Track B*, and separately calls out calibration — "do
70%-confidence predictions come true 70% of the time? Almost no team will
measure this." Both are computed here.

Protocol
--------
Origins step forward through the test window. At each origin the model is fitted
on data strictly before it and evaluated on the following `horizons` days. The
fit never sees the days it is scored on, and the model is refitted at each
origin rather than trained once on everything — the expensive, correct option.

Metrics
-------
  MAPE      mean absolute percentage error, per horizon and overall
  sMAPE     symmetric variant, reported because MAPE is unstable near zero
  MAE       in tonnes, so the error is readable in the unit that matters
  coverage  share of actuals inside the 80% interval; nominal is 0.80

Both the GBT and the seasonal-naive baseline are scored on identical origins
and targets, so the comparison is like-for-like.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Sequence

import numpy as np

from app.ml.forecaster import (
    BASELINE_VERSION,
    MODEL_VERSION,
    NOMINAL_COVERAGE,
    Covariates,
    ProductionForecaster,
    cumulative_paths,
    seasonal_naive,
)


@dataclass
class BacktestResult:
    model_version: str
    baseline_version: str
    n_origins: int
    n_predictions: int
    horizons: list[int]
    model: dict
    baseline: dict
    by_horizon: list[dict]
    window: dict
    verdict: str
    cumulative_calibration: dict | None = None

    def to_dict(self) -> dict:
        return {
            "model_version": self.model_version,
            "baseline_version": self.baseline_version,
            "n_origins": self.n_origins,
            "n_predictions": self.n_predictions,
            "horizons": self.horizons,
            "cumulative_calibration": self.cumulative_calibration,
            "model": self.model,
            "baseline": self.baseline,
            "by_horizon": self.by_horizon,
            "window": self.window,
            "verdict": self.verdict,
            "nominal_coverage": NOMINAL_COVERAGE,
        }


def _mape(actual: np.ndarray, pred: np.ndarray, floor: float = 1.0) -> float:
    """MAPE with a denominator floor so near-zero days cannot explode it."""
    denom = np.maximum(np.abs(actual), floor)
    return float(np.mean(np.abs(actual - pred) / denom) * 100.0)


def _smape(actual: np.ndarray, pred: np.ndarray) -> float:
    denom = (np.abs(actual) + np.abs(pred)) / 2.0
    denom = np.maximum(denom, 1e-9)
    return float(np.mean(np.abs(actual - pred) / denom) * 100.0)


def rolling_origin_backtest(
    series_by_key: dict[tuple[str, str], dict[date, float]],
    cov: Covariates,
    mine_code: str,
    test_start: date,
    test_end: date,
    horizons: Sequence[int] = (1, 3, 7, 14),
    origin_step_days: int = 14,
    opencast: dict[str, bool] | None = None,
) -> BacktestResult:
    """Backtest one mine across all of its grades."""
    keys = [k for k in series_by_key if k[0] == mine_code]
    if not keys:
        raise ValueError(f"No series for {mine_code}")

    max_h = max(horizons)
    origins: list[date] = []
    o = test_start
    while o + timedelta(days=max_h) <= test_end:
        origins.append(o)
        o += timedelta(days=origin_step_days)
    if not origins:
        raise ValueError("Test window too short for the requested horizons")
    n_origin_dates = len(origins)

    rec_model: list[tuple[int, float, float, float, float]] = []   # h, actual, q50, q10, q90
    rec_base: list[tuple[int, float, float]] = []                  # h, actual, pred

    # Cumulative calibration, per origin.
    #
    # The backtest measured daily interval coverage and nothing else, so an
    # error in how days *combine* into a cumulative distribution passed it
    # untouched: every day's interval was right while the cumulative spread was
    # understated 2.5-3.4x, and P(cumulative < target) saturated at 1.000 on
    # nine of ten mines. Daily coverage cannot see that.
    #
    # At each origin the realised cumulative is compared against the predicted
    # cumulative distribution. If the aggregation is calibrated, the realised
    # value falls inside the 10-90 band about 80% of the time, and the PIT
    # values are roughly uniform.
    cum_pit: list[float] = []
    cum_inside: list[bool] = []
    raw_pit: list[float] = []
    raw_inside: list[bool] = []
    rho_used: list[float] = []

    for origin in origins:
        # Refit on data strictly before this origin.
        fc = ProductionForecaster().fit(
            series_by_key, cov, train_end=origin - timedelta(days=1),
            horizons=tuple(range(1, max_h + 1)), opencast=opencast,
        )
        if mine_code not in fc.models:
            continue

        for key in keys:
            grade = key[1]
            series = series_by_key[key]
            preds = fc.predict(mine_code, grade, origin, horizons, series, cov)
            for h in horizons:
                target = origin + timedelta(days=h)
                actual = series.get(target)
                if actual is None:
                    continue
                p = preds[h]
                rec_model.append((h, float(actual), p["q50"], p["q10"], p["q90"]))
                rec_base.append((h, float(actual), seasonal_naive(series, target)))

            # --- cumulative calibration over the full horizon ---------------
            full = list(range(1, max_h + 1))
            actuals = [series.get(origin + timedelta(days=h)) for h in full]
            if any(a is None for a in actuals):
                continue
            dense = fc.predict(mine_code, grade, origin, full, series, cov)
            realised = float(sum(float(a) for a in actuals))

            # Both aggregations, at every origin. The calibrated one is what the
            # product serves; the uncalibrated one is kept so the before/after
            # is measured on identical origins rather than across two runs.
            rho = fc.rho_for(mine_code)
            sims = cumulative_paths(dense, fc.residuals.get(mine_code), rho=rho)
            raw = cumulative_paths(dense, fc.residuals.get(mine_code), rho=0.0)
            if sims is None or raw is None:
                continue
            rho_used.append(float(rho))
            cum_pit.append(float(np.mean(sims < realised)))
            lo, hi = np.percentile(sims, [10, 90])
            cum_inside.append(bool(lo <= realised <= hi))
            raw_pit.append(float(np.mean(raw < realised)))
            rlo, rhi = np.percentile(raw, [10, 90])
            raw_inside.append(bool(rlo <= realised <= rhi))

    if not rec_model:
        raise ValueError("Backtest produced no predictions")

    m = np.array(rec_model, dtype=float)
    b = np.array(rec_base, dtype=float)

    model_metrics = _summarise(m[:, 1], m[:, 2], lo=m[:, 3], hi=m[:, 4])
    base_metrics = _summarise(b[:, 1], b[:, 2])

    by_h = []
    for h in horizons:
        mh = m[m[:, 0] == h]
        bh = b[b[:, 0] == h]
        if len(mh) == 0:
            continue
        by_h.append({
            "horizon_days": int(h),
            "n": int(len(mh)),
            "model_mape_pct": round(_mape(mh[:, 1], mh[:, 2]), 2),
            "baseline_mape_pct": round(_mape(bh[:, 1], bh[:, 2]), 2),
            "model_mae_tonnes": round(float(np.mean(np.abs(mh[:, 1] - mh[:, 2]))), 2),
            "baseline_mae_tonnes": round(float(np.mean(np.abs(bh[:, 1] - bh[:, 2]))), 2),
            "coverage_80": round(float(np.mean((mh[:, 1] >= mh[:, 3]) & (mh[:, 1] <= mh[:, 4]))), 3),
        })

    # Cumulative calibration: does P(cumulative < x) mean what it says?
    cumulative = None
    if cum_pit:
        pit = np.array(cum_pit, dtype=float)
        rpit = np.array(raw_pit, dtype=float)
        cumulative = {
            "n_origins": int(len(pit)),
            "n_distinct_origin_dates": int(n_origin_dates),
            "coverage_80": round(float(np.mean(cum_inside)), 3),
            "nominal_coverage": 0.8,
            "coverage_gap": round(float(np.mean(cum_inside)) - 0.8, 3),
            # The calibration, measured on origins it never saw.
            "common_factor_rho_mean": round(float(np.mean(rho_used)), 3),
            "common_factor_rho_range": [
                round(float(np.min(rho_used)), 3), round(float(np.max(rho_used)), 3),
            ],
            "uncalibrated": {
                "coverage_80": round(float(np.mean(raw_inside)), 3),
                "coverage_gap": round(float(np.mean(raw_inside)) - 0.8, 3),
                "mean_pit": round(float(np.mean(rpit)), 3),
                "pit_at_extremes": round(float(np.mean((rpit < 0.05) | (rpit > 0.95))), 3),
                "note": (
                    "The same origins with the common factor switched off, so "
                    "before and after are measured on identical windows."
                ),
            },
            # Mean PIT is 0.5 when the predicted cumulative distribution is
            # centred on reality. Far from 0.5 means the aggregation is biased;
            # a PIT bunched at 0 and 1 means it is too narrow, which is the
            # failure that produced P(shortfall) = 1.000.
            "mean_pit": round(float(np.mean(pit)), 3),
            "pit_at_extremes": round(float(np.mean((pit < 0.05) | (pit > 0.95))), 3),
            "pit_at_extremes_nominal": 0.1,
            "note": (
                "Calibration of the cumulative distribution, not of the daily "
                "intervals. Daily coverage was correct while the cumulative "
                "spread was understated 2.5-3.4x, so this is the check that "
                "would have caught it. These origins are strictly later than "
                "the block the loading was fitted on, so this is held-out."
            ),
            "n_origins_note": (
                "One window per (grade, origin date). Windows at the same date "
                "share weather and equipment state, so the effective sample is "
                "nearer n_distinct_origin_dates than n_origins."
            ),
        }

    beats = model_metrics["mape_pct"] < base_metrics["mape_pct"]
    improvement = 100.0 * (base_metrics["mape_pct"] - model_metrics["mape_pct"]) / base_metrics["mape_pct"]
    verdict = (
        f"GBT {'beats' if beats else 'DOES NOT beat'} the seasonal-naive baseline: "
        f"MAPE {model_metrics['mape_pct']:.2f}% vs {base_metrics['mape_pct']:.2f}% "
        f"({improvement:+.1f}% relative)."
    )

    return BacktestResult(
        model_version=MODEL_VERSION,
        baseline_version=BASELINE_VERSION,
        n_origins=len(origins),
        n_predictions=len(rec_model),
        horizons=[int(h) for h in horizons],
        model=model_metrics,
        baseline=base_metrics,
        by_horizon=by_h,
        window={"test_start": test_start.isoformat(), "test_end": test_end.isoformat(),
                "origin_step_days": origin_step_days},
        verdict=verdict,
        cumulative_calibration=cumulative,
    )


def _summarise(actual: np.ndarray, pred: np.ndarray, lo=None, hi=None) -> dict:
    out = {
        "mape_pct": round(_mape(actual, pred), 2),
        "smape_pct": round(_smape(actual, pred), 2),
        "mae_tonnes": round(float(np.mean(np.abs(actual - pred))), 2),
        "rmse_tonnes": round(float(np.sqrt(np.mean((actual - pred) ** 2))), 2),
        "n": int(len(actual)),
    }
    if lo is not None and hi is not None:
        cov = float(np.mean((actual >= lo) & (actual <= hi)))
        out["coverage_80"] = round(cov, 3)
        out["coverage_gap"] = round(cov - NOMINAL_COVERAGE, 3)
        out["mean_interval_width_tonnes"] = round(float(np.mean(hi - lo)), 2)
    return out
