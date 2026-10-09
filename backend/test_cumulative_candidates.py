"""
The arithmetic of D-045's two candidates, on constructed inputs.

These pin what the estimators compute, whichever way D-045's measurement went:
the conformal predictive distribution and band of (b), and the dependence the
copula of (a) puts between days. That the calibration slice is rebuilt exactly
as `fit` builds it is checked on a real fit in test_track_b.py.
"""
import numpy as np
import pytest

from app.ml import cumulative_candidates as cc

FLAT = {h: {"q10": 90.0, "q50": 100.0, "q90": 110.0} for h in range(1, 15)}   # T_hat = 1400


def test_conformal_p_is_the_midpoint_of_the_predictive_distribution():
    scores = np.sort(np.log(np.array([0.90, 0.95, 1.00, 1.05, 1.10])))   # n = 5
    # Below every calibrated total: k = 0 -> 0.5 / 6. Above every one: 5.5 / 6.
    assert cc.conformal_p(FLAT, scores, 1400 * 0.80) == pytest.approx(0.5 / 6)
    assert cc.conformal_p(FLAT, scores, 1400 * 1.20) == pytest.approx(5.5 / 6)
    # Between the second and third: k = 2.
    assert cc.conformal_p(FLAT, scores, 1400 * 0.97) == pytest.approx(2.5 / 6)
    assert cc.conformal_extremes(5) == (pytest.approx(0.5 / 6), pytest.approx(5.5 / 6))


def test_conformal_band_uses_the_registered_order_statistics():
    scores = np.sort(np.log(np.linspace(0.80, 1.20, 19)))                 # n = 19, n + 1 = 20
    lo, hi = cc.conformal_band(FLAT, scores)
    # l = floor(0.1 x 20) = 2, u = ceil(0.9 x 20) = 18 (1-indexed).
    assert lo == pytest.approx(1400 * np.exp(scores[1]))
    assert hi == pytest.approx(1400 * np.exp(scores[17]))


def test_the_copula_carries_the_correlation_it_is_given():
    rho = 0.5
    R = np.full((14, 14), rho)
    np.fill_diagonal(R, 1.0)
    ind = cc.independent_paths(FLAT, n_sim=20000)
    dep = cc.horizon_paths(FLAT, R, n_sim=20000)
    # For a sum of 14 near-identical days, var(dependent) / var(independent)
    # is close to 1 + 13 rho: positive dependence must widen the total.
    ratio = float(np.var(dep) / np.var(ind))
    assert 1 + 13 * rho - 1.0 < ratio < 1 + 13 * rho + 1.0, ratio
    # And the identity reproduces independence; the means agree either way.
    assert abs(np.mean(dep) - np.mean(ind)) / np.mean(ind) < 0.005


def test_days_with_no_median_are_left_out_of_the_copula():
    preds = {**FLAT, 3: {"q10": 0.0, "q50": 0.0, "q90": 0.0}}
    sims = cc.horizon_paths(preds, np.eye(14), n_sim=2000)
    assert sims is not None and np.isfinite(sims).all()
    assert np.mean(sims) == pytest.approx(13 * np.mean(cc.independent_paths(FLAT, n_sim=2000)) / 14, rel=0.01)
