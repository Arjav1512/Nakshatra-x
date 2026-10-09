"""
The two P(shortfall) candidates pre-registered in DECISIONS.md D-045.

(a) Horizon dependence — the correlation of standardised errors across horizons
    1-14 within each held-out calibration path, per grade, through a Gaussian
    copula on the served daily lognormals.
(b) Direct calibration of the 14-day total — split conformal on log(realised /
    sum of served medians) over the same held-out paths.

Both are estimated from the forecaster's own calibration slice: the most recent
quarter of each mine's samples, which its quantile models never trained on and
whose targets all fall on or before the fit's last day. Nothing here sees the
future of the forecast it is applied to.

Not in the forecast's import chain: nothing served imports this module, so
measuring a candidate moves no artifact's identity. If one passes its rule it
moves into the served path, and the artifacts are regenerated with it.

The calibration slice is rebuilt here exactly as `ProductionForecaster.fit`
builds it. `check_reconstruction` recomputes the conformal widths from the
rebuilt rows and requires them to equal the fitted ones, so a rebuild that
drifted from `fit` fails loudly instead of measuring something else.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Sequence

import numpy as np

from app.ml.forecaster import SEASONAL_PERIOD_DAYS, make_features

Z90 = 1.2815515655446004
H = tuple(range(1, 15))
#: D-045: fewer complete paths than this for a grade pools the mine's grades.
MIN_PATHS = 30
N_SIM = 4000
SEED = 20260921


def _served(lo: float, mid: float, hi: float, width: float) -> tuple[float, float, float]:
    """`ProductionForecaster.predict`'s post-processing: sort, widen, sort, clamp."""
    lo, mid, hi = sorted((lo, mid, hi))
    lo -= width
    hi += width
    lo, mid, hi = sorted((lo, mid, hi))
    return max(0.0, lo), max(0.0, mid), max(0.0, hi)


def lognormal_params(q10: float, q50: float, q90: float) -> tuple[float, float]:
    """The daily lognormal `shortfall_probability` uses, from served quantiles."""
    mu = float(np.log(max(q50, 1e-9)))
    sigma = (np.log(q90) - np.log(q10)) / (2 * Z90) if q90 > q10 > 0 else 0.15
    return mu, float(min(max(sigma, 0.02), 1.5))


@dataclass
class GradePaths:
    """Complete held-out calibration paths for one grade: one row per origin."""
    origins: list[date] = field(default_factory=list)
    z: np.ndarray = field(default_factory=lambda: np.empty((0, len(H))))   # standardised errors
    s: np.ndarray = field(default_factory=lambda: np.empty(0))              # log(T / T_hat)


def calibration_paths(fc, series_by_key, cov, train_end: date,
                      horizons: Sequence[int] = H,
                      min_history_days: int = SEASONAL_PERIOD_DAYS + 30):
    """
    {mine: {grade: GradePaths}} from the fit's held-out calibration slice.

    Also returns the raw calibration rows per mine, for `check_reconstruction`.
    """
    keys_by_mine: dict[str, list[tuple[date, str, int]]] = {}
    for (mine, grade), series in series_by_key.items():
        days = sorted(d for d in series if d <= train_end)
        start = fc.epoch + timedelta(days=min_history_days)
        for origin in days:
            if origin < start:
                continue
            for h in horizons:
                target = origin + timedelta(days=h)
                if target > train_end or target not in series:
                    continue
                keys_by_mine.setdefault(mine, []).append((origin, grade, int(h)))

    paths: dict[str, dict[str, GradePaths]] = {}
    rows: dict[str, dict] = {}
    for mine, keys in keys_by_mine.items():
        if mine not in fc.models or len(keys) < 200:
            continue
        keys = sorted(keys, key=lambda k: k[0])          # stable, as fit sorts
        n = len(keys)
        n_cal = min(max(50, int(n * fc.calibration_fraction)), n // 3)
        cal = keys[n - n_cal:]
        X = np.array([
            make_features(o, h, series_by_key[(mine, g)], cov, mine, g,
                          fc.opencast.get(mine, False), fc.epoch)
            for o, g, h in cal
        ], dtype=float)
        y = np.array([float(series_by_key[(mine, g)][o + timedelta(days=h)]) for o, g, h in cal])
        cal_q = np.vstack([fc.models[mine][q].predict(X) for q in fc.quantiles])
        rows[mine] = {"keys": cal, "y": y, "cal_q": cal_q}

        by_path: dict[tuple[str, date], dict[int, tuple]] = {}
        for i, (o, g, h) in enumerate(cal):
            by_path.setdefault((g, o), {})[h] = (y[i], cal_q[0][i], cal_q[1][i], cal_q[-1][i])
        per_grade: dict[str, list] = {}
        for (g, o), hs in by_path.items():
            if any(h not in hs for h in H):
                continue
            z_row, total, total_hat, ok = [], 0.0, 0.0, True
            for h in H:
                actual, lo, mid, hi = hs[h]
                width = fc.conformal_width.get((mine, h), fc.conformal_width_default.get(mine, 0.0))
                lo, mid, hi = _served(lo, mid, hi, width)
                if actual <= 0 or lo <= 0 or mid <= 0 or hi <= 0:
                    ok = False
                    break
                mu, sigma = lognormal_params(lo, mid, hi)
                z_row.append((np.log(actual) - mu) / sigma)
                total += actual
                total_hat += mid
            if ok:
                per_grade.setdefault(g, []).append((o, z_row, float(np.log(total / total_hat))))
        paths[mine] = {}
        for g, recs in per_grade.items():
            recs.sort(key=lambda r: r[0])
            paths[mine][g] = GradePaths(
                origins=[r[0] for r in recs],
                z=np.array([r[1] for r in recs], dtype=float),
                s=np.array([r[2] for r in recs], dtype=float),
            )
    return paths, rows


def check_reconstruction(fc, rows) -> None:
    """The rebuilt calibration rows reproduce the fitted conformal widths exactly."""
    alpha = 1.0 - (fc.quantiles[-1] - fc.quantiles[0])
    for mine, r in rows.items():
        lo, hi, y = r["cal_q"][0], r["cal_q"][-1], r["y"]
        scores = np.maximum(lo - y, y - hi)
        hs = np.array([k[2] for k in r["keys"]])
        for h in np.unique(hs):
            sel = np.sort(scores[hs == h])
            if len(sel) < 30:
                continue
            k = max(0, min(int(np.ceil((len(sel) + 1) * (1 - alpha))) - 1, len(sel) - 1))
            if not np.isclose(sel[k], fc.conformal_width[(mine, int(h))], rtol=0, atol=1e-9):
                raise AssertionError(
                    f"{mine} h={h}: rebuilt calibration rows give width {sel[k]}, "
                    f"the fit has {fc.conformal_width[(mine, int(h))]} — the rebuild "
                    "does not match fit, so nothing measured from it would be the candidate"
                )


def _grade_or_pooled(paths_for_mine: dict[str, GradePaths], grade: str) -> tuple[GradePaths, bool]:
    gp = paths_for_mine.get(grade)
    if gp is not None and len(gp.origins) >= MIN_PATHS:
        return gp, False
    pooled = GradePaths(
        origins=[o for p in paths_for_mine.values() for o in p.origins],
        z=np.vstack([p.z for p in paths_for_mine.values() if len(p.z)]) if paths_for_mine else np.empty((0, len(H))),
        s=np.concatenate([p.s for p in paths_for_mine.values()]) if paths_for_mine else np.empty(0),
    )
    return pooled, True


# ---------------------------------------------------------------- (a) ---------

def horizon_corr(paths_for_mine: dict[str, GradePaths], grade: str) -> tuple[np.ndarray, int, bool]:
    """(R_g, number of paths, pooled?) — Pearson correlation across horizons."""
    gp, pooled = _grade_or_pooled(paths_for_mine, grade)
    R = np.corrcoef(gp.z, rowvar=False)
    return R, len(gp.z), pooled


def horizon_paths(preds: dict[int, dict[str, float]], R: np.ndarray,
                  n_sim: int = N_SIM, seed: int = SEED) -> np.ndarray | None:
    """14-day totals from the served daily lognormals, dependent through R."""
    kept, params = [], []
    for h in sorted(preds):
        p = preds[h]
        if p["q50"] <= 0:
            continue
        kept.append(int(h) - 1)
        params.append(lognormal_params(p["q10"], p["q50"], p["q90"]))
    if not params:
        return None
    sub = R[np.ix_(kept, kept)]
    rng = np.random.default_rng(seed)
    # numpy 2.2 on Apple's Accelerate raises divide/overflow/invalid warnings
    # from inside this matmul on valid input (checked: 200,000 draws all finite,
    # correlations within 0.004 of R). Silenced here only, and replaced by an
    # explicit check, so a genuinely bad draw still fails.
    with np.errstate(all="ignore"):
        Z = rng.multivariate_normal(np.zeros(len(kept)), sub, size=n_sim, method="eigh")
    if not np.isfinite(Z).all():
        raise FloatingPointError("non-finite draws from the horizon copula")
    mus = np.array([m for m, _ in params])[None, :]
    sds = np.array([s for _, s in params])[None, :]
    return np.exp(mus + sds * Z).sum(axis=1)


def independent_paths(preds: dict[int, dict[str, float]], n_sim: int = N_SIM, seed: int = SEED):
    """The same daily lognormals summed independently (R = I)."""
    n = sum(1 for h in preds if preds[h]["q50"] > 0)
    return horizon_paths(preds, np.eye(len(H)), n_sim, seed) if n else None


# ---------------------------------------------------------------- (b) ---------

def total_scores(paths_for_mine: dict[str, GradePaths], grade: str) -> tuple[np.ndarray, bool]:
    """(sorted conformity scores log(T / T_hat), pooled?)"""
    gp, pooled = _grade_or_pooled(paths_for_mine, grade)
    return np.sort(gp.s), pooled


def total_hat(preds: dict[int, dict[str, float]]) -> float:
    return float(sum(preds[h]["q50"] for h in sorted(preds)))


def conformal_totals(preds, scores: np.ndarray) -> np.ndarray:
    return total_hat(preds) * np.exp(scores)


def conformal_p(preds, scores: np.ndarray, target: float) -> float:
    """P(total < target) = (k + 0.5) / (n + 1), k = #{s_i < log(target / T_hat)}."""
    t_hat = total_hat(preds)
    n = len(scores)
    if target <= 0:
        return 0.5 / (n + 1)
    k = int(np.sum(scores < np.log(target / t_hat)))
    return (k + 0.5) / (n + 1)


def conformal_band(preds, scores: np.ndarray) -> tuple[float, float]:
    """The 80% band: order statistics l = floor(0.1(n+1)), u = ceil(0.9(n+1)), 1-indexed."""
    n = len(scores)
    t_hat = total_hat(preds)
    lo_k = min(max(int(np.floor(0.1 * (n + 1))), 1), n)
    hi_k = min(max(int(np.ceil(0.9 * (n + 1))), 1), n)
    return t_hat * float(np.exp(scores[lo_k - 1])), t_hat * float(np.exp(scores[hi_k - 1]))


def conformal_extremes(n: int) -> tuple[float, float]:
    """The most extreme P values (b) can express with n scores (D-045 C3 ii)."""
    return 0.5 / (n + 1), (n + 0.5) / (n + 1)
