"""
Tests for the cumulative calibration (docs/DECISIONS.md D-040).

The point of these is the *properties* of the correction, not its value. The
value is a measurement and lives in measure_cumulative_calibration.py; a test
that asserted a particular loading would break every time the data changed and
would tell nobody anything.

What is asserted here is what must hold whatever the loading turns out to be:

  * the loading leaves each day's marginal distribution alone — this is the whole
    reason it was chosen over widening the daily sigmas, and it is the claim that
    lets daily coverage and the point forecast stay untouched;
  * the loading widens the cumulative distribution, monotonically;
  * the calibration record is complete enough to audit, including the case where
    a mine could not be calibrated and the case where its cumulative was already
    too wide;
  * `cumulative_paths` refuses to invent a residual series.
"""
from __future__ import annotations

import math

import numpy as np

from app.ml.forecaster import (
    CUMULATIVE_LOADING_MODE,
    CUMULATIVE_RHO_GRID,
    UNIFORM_PIT_SD,
    cumulative_paths,
    lognormal_day_params,
    shortfall_probability,
)


def _preds(n_days: int = 14) -> dict[int, dict[str, float]]:
    """A plausible 14-day quantile forecast; widths grow with horizon."""
    out = {}
    for h in range(1, n_days + 1):
        mid = 300.0
        half = 30.0 + 2.0 * h
        out[h] = {"q10": mid - half, "q50": mid, "q90": mid + half}
    return out


def _residuals(n: int = 600, phi: float = 0.5, seed: int = 7) -> np.ndarray:
    """An AR(1) series, standardised, so the block bootstrap has persistence."""
    rng = np.random.default_rng(seed)
    r = np.zeros(n)
    for i in range(1, n):
        r[i] = phi * r[i - 1] + rng.standard_normal() * math.sqrt(1 - phi**2)
    return (r / float(np.std(r))).astype(float)


def test_loading_leaves_daily_forecast_identical():
    """
    CRITERION 3 of D-040.

    The loading must not touch the point forecast or any day's interval. It is
    applied inside `cumulative_paths` only, so the daily quantiles a caller
    passes in come back out of `shortfall_probability` untouched — and with a
    single-day horizon the "cumulative" distribution IS that day's marginal, so
    its spread must not move with the loading either.
    """
    preds = _preds()
    res = _residuals()

    # The quantiles handed to the aggregation are not mutated by it.
    before = {h: dict(v) for h, v in preds.items()}
    for rho in (0.0, 0.25, 0.5):
        shortfall_probability(preds, target_tonnes=4000.0, residuals=res, rho=rho)
    assert preds == before, "shortfall_probability mutated the forecast it was given"

    # One day only: the marginal. Var(z) = (1-rho) + rho = 1 for every rho, so
    # the spread must be invariant up to Monte Carlo error.
    one = {1: preds[1]}
    sds = []
    for rho in (0.0, 0.2, 0.4):
        sims = cumulative_paths(one, res, rho=rho, n_sim=200_000, seed=11)
        assert sims is not None
        sds.append(float(np.std(sims)))
    spread = (max(sds) - min(sds)) / sds[0]
    assert spread < 0.02, (
        f"daily marginal spread moved {spread:.1%} with the loading "
        f"({sds}) — the loading is changing a day's distribution, not just the "
        f"dependence between days"
    )


def test_loading_widens_the_cumulative_monotonically():
    """More shared shock, more cumulative spread. Otherwise it cannot calibrate."""
    preds = _preds()
    res = _residuals()
    sds = []
    for rho in (0.0, 0.1, 0.2, 0.3, 0.4, 0.5):
        sims = cumulative_paths(preds, res, rho=rho, n_sim=40_000, seed=3)
        assert sims is not None
        sds.append(float(np.std(sims)))
    for a, b in zip(sds, sds[1:]):
        assert b > a, f"cumulative spread did not increase: {sds}"
    assert sds[-1] > 1.2 * sds[0], (
        f"the loading barely moves the cumulative spread ({sds[0]:.1f} -> "
        f"{sds[-1]:.1f}); it could not correct a 0.075 coverage gap"
    )


def test_cumulative_paths_refuses_to_invent_a_residual_series():
    """
    No residual series, no block bootstrap — and no silent substitute.

    The old helper fell back to independent draws and returned them as if they
    were the same object, which is how an aggregation error reached production
    while every daily interval was correct.
    """
    assert cumulative_paths(_preds(), None) is None
    assert cumulative_paths(_preds(), np.zeros(5)) is None  # too short

    # The product still has its fallback, and still says which one it used.
    out = shortfall_probability(_preds(), target_tonnes=4000.0, residuals=None)
    assert "independent daily draws" in out["aggregation"]
    assert out["cumulative_common_factor_rho"] is None
    assert "understates cumulative spread" in out["assumption"]

    with_blocks = shortfall_probability(
        _preds(), target_tonnes=4000.0, residuals=_residuals(), rho=0.2
    )
    assert "block-bootstrap" in with_blocks["aggregation"]
    assert "0.20" in with_blocks["aggregation"]
    assert with_blocks["cumulative_common_factor_rho"] == 0.2


def test_grid_cannot_narrow_and_is_capped():
    """
    The correction is one-sided by construction.

    A negative loading would narrow the cumulative distribution — shrinking an
    interval on the strength of a held-out sample — and a loading near 1 would
    say a fortnight is one shared shock, which is a different model. Neither is
    a calibration.
    """
    assert min(CUMULATIVE_RHO_GRID) == 0.0
    assert max(CUMULATIVE_RHO_GRID) <= 0.5
    assert all(0.0 <= r <= 1.0 for r in CUMULATIVE_RHO_GRID)
    assert abs(UNIFORM_PIT_SD - 1.0 / math.sqrt(12.0)) < 1e-12


def test_applied_loading_honours_the_declared_mode():
    """
    What ships is what was validated.

    D-040's rule selected the pooled loading. The backtest and the served
    forecast must both read it through `applied_rho`, or the backtest would
    certify a configuration the product does not use.
    """
    from app.ml.forecaster import ProductionForecaster

    assert CUMULATIVE_LOADING_MODE in ("pooled", "per_mine", "off")

    fc = ProductionForecaster()
    fc.cumulative_rho = {"A": 0.30, "B": 0.00}
    fc.cumulative_rho_default = 0.10

    if CUMULATIVE_LOADING_MODE == "pooled":
        assert fc.applied_rho("A") == 0.10
        assert fc.applied_rho("B") == 0.10
        assert fc.applied_rho("UNKNOWN") == 0.10
    elif CUMULATIVE_LOADING_MODE == "per_mine":
        assert fc.applied_rho("A") == 0.30
        assert fc.applied_rho("UNKNOWN") == 0.10
    else:
        assert fc.applied_rho("A") == 0.0

    # The per-mine estimate stays reachable whatever the mode, because the
    # measurement script needs it to compare the two.
    assert fc.rho_for("A") == 0.30
    assert fc.rho_for("UNKNOWN") == 0.10


def test_calibration_record_is_auditable():
    """
    Every fitted mine carries what it would take to challenge its loading.

    Expensive: fits all ten mines once (~30 s), reusing the process cache.
    """
    from app.api.track_b import _forecaster, _state

    st = _state()
    fc = _forecaster("MOIL-BAL-01", st["end"])

    assert fc.cumulative_calibration, "no calibration records at all"
    for code, meta in fc.cumulative_calibration.items():
        assert "calibrated" in meta, code
        if not meta["calibrated"]:
            assert meta.get("reason"), f"{code} is uncalibrated with no reason given"
            continue
        for field in ("rho", "direction", "n_windows", "block_start", "block_end",
                      "objective", "in_block_pit_sd_at_rho_0", "at_grid_edge"):
            assert field in meta, f"{code} calibration record lacks {field}"
        assert 0.0 <= meta["rho"] <= 0.5, meta
        assert meta["n_windows"] >= 40, meta

        # The direction must agree with the numbers it describes.
        sd0 = meta["in_block_pit_sd_at_rho_0"]
        if sd0 < UNIFORM_PIT_SD - 0.01:
            assert "TOO WIDE" in meta["direction"], (
                f"{code} block PIT sd {sd0} is below uniform {UNIFORM_PIT_SD:.4f} "
                f"— already too wide — but direction says: {meta['direction']}"
            )
            assert meta["rho"] == 0.0, (
                f"{code} was already too wide and still got a positive loading"
            )

    # The served summary drops the search curve and states what was applied,
    # separately from what was fitted for that mine — those differ under the
    # pooled mode, and a record that conflated them would hide the choice.
    summary = fc.calibration_summary("MOIL-BAL-01")
    assert "search_curve" not in summary
    assert summary["loading_mode"] == CUMULATIVE_LOADING_MODE
    assert summary["rho_applied"] == round(fc.applied_rho("MOIL-BAL-01"), 3)
    assert summary["rho_fitted_for_this_mine"] == round(fc.rho_for("MOIL-BAL-01"), 3)

    # A mine nobody fitted gets an honest record, not a zero that looks fitted.
    unknown = fc.calibration_summary("MOIL-NOPE-99")
    assert unknown["calibrated"] is False
    assert unknown.get("reason")


if __name__ == "__main__":
    test_loading_leaves_daily_forecast_identical()
    test_loading_widens_the_cumulative_monotonically()
    test_cumulative_paths_refuses_to_invent_a_residual_series()
    test_grid_cannot_narrow_and_is_capped()
    test_applied_loading_honours_the_declared_mode()
    test_calibration_record_is_auditable()
    print("all cumulative-calibration tests passed")
