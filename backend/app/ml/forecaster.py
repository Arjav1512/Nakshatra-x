"""
Track B production forecaster (PRD B-5, B-6, B-10).

Two models, always reported together:

  * **Seasonal-naive baseline** — the forecast for a day is what that mine and
    grade produced on the same day one year earlier. PRD's architecture calls
    for "a seasonal-naive baseline that must be beaten"; a model that cannot
    beat it has demonstrated nothing.

  * **Gradient-boosting quantile model** — three `HistGradientBoostingRegressor`
    fits per mine (q=0.1, 0.5, 0.9) giving a point forecast and an 80%
    prediction interval. scikit-learn is already a dependency; no new library
    is introduced.

-------------------------------------------------------------------------------
NO LEAKAGE
-------------------------------------------------------------------------------
Track A's prospectivity model was invalidated by features derived from the
label. The same mistake is avoided here explicitly.

A forecast is made at an *origin* `t0` for target days `t0+1 .. t0+h`. Only
information available at `t0` may enter the features:

  - production lags are taken **relative to the origin**, never the target day,
    so predicting day `t0+14` still only sees production up to `t0`;
  - weather covariates for the target day are legitimate, because a rainfall
    forecast is genuinely available at `t0` (that is what Open-Meteo supplies);
  - equipment and blasting covariates are taken at the origin, not the target.

`horizon_days` is itself a feature, so the model can learn that accuracy decays
with distance — rather than pretending a 14-day-ahead forecast is as good as a
1-day-ahead one.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterable, Sequence

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

MODEL_VERSION = "nakshatra-gbt-cqr-v1"
BASELINE_VERSION = "seasonal-naive-365-v1"
SEASONAL_PERIOD_DAYS = 365
DEFAULT_QUANTILES = (0.1, 0.5, 0.9)
NOMINAL_COVERAGE = 0.8  # the 0.1-0.9 interval


@dataclass
class SeriesPoint:
    day: date
    mine_code: str
    grade: str
    tonnes: float


@dataclass
class Covariates:
    """Per-day drivers, shared across grades within a mine."""
    rain_mm: dict[date, float] = field(default_factory=dict)
    downtime_hours: dict[tuple[str, date], float] = field(default_factory=dict)
    blast_delay_hours: dict[tuple[str, date], float] = field(default_factory=dict)

    def rain_window(self, day: date, days: int) -> float:
        return sum(self.rain_mm.get(day - timedelta(days=i), 0.0) for i in range(days))

    def downtime_window(self, mine: str, day: date, days: int) -> float:
        return sum(self.downtime_hours.get((mine, day - timedelta(days=i)), 0.0) for i in range(days))

    def blast_window(self, mine: str, day: date, days: int) -> float:
        return sum(self.blast_delay_hours.get((mine, day - timedelta(days=i)), 0.0) for i in range(days))


FEATURE_NAMES = [
    "horizon_days",
    "doy_sin",
    "doy_cos",
    "dow",
    "trend_index",
    "grade_code",
    "origin_lag1",
    "origin_lag7_mean",
    "origin_lag28_mean",
    "origin_lag365",
    "target_rain_7d",      # from a weather forecast, available at the origin
    "target_rain_30d",
    "origin_downtime_7d",
    "origin_downtime_28d",
    "origin_blast_delay_7d",
    "is_opencast",
]

GRADE_CODES = {
    "ferro_manganese": 0,
    "silico_manganese": 1,
    "blast_furnace": 2,
    "dioxide": 3,
}


def build_series(rows: Iterable) -> dict[tuple[str, str], dict[date, float]]:
    """Index production rows as {(mine, grade): {day: tonnes}}."""
    out: dict[tuple[str, str], dict[date, float]] = defaultdict(dict)
    for r in rows:
        key = (r.mine_code, r.grade if isinstance(r.grade, str) else r.grade.value)
        day = r.period_start if isinstance(r.period_start, date) else date.fromisoformat(str(r.period_start))
        out[key][day] = out[key].get(day, 0.0) + float(r.tonnes)
    return out


def build_covariates(rainfall: dict, equipment: Iterable, blasts: Iterable) -> Covariates:
    cov = Covariates()
    for d, v in rainfall.items():
        day = d if isinstance(d, date) else date.fromisoformat(str(d))
        cov.rain_mm[day] = float(v)
    for e in equipment:
        day = e.started_at.date()
        cov.downtime_hours[(e.mine_code, day)] = cov.downtime_hours.get((e.mine_code, day), 0.0) + float(e.downtime_hours or 0.0)
    for b in blasts:
        day = b.planned_at.date()
        cov.blast_delay_hours[(b.mine_code, day)] = cov.blast_delay_hours.get((b.mine_code, day), 0.0) + float(b.delay_hours or 0.0)
    return cov


def _mean_lag(series: dict[date, float], origin: date, days: int) -> float:
    vals = [series.get(origin - timedelta(days=i), None) for i in range(days)]
    vals = [v for v in vals if v is not None]
    return float(np.mean(vals)) if vals else 0.0


def make_features(
    origin: date,
    horizon: int,
    series: dict[date, float],
    cov: Covariates,
    mine_code: str,
    grade: str,
    is_opencast: bool,
    epoch: date,
) -> list[float]:
    """
    Features for predicting `origin + horizon`, using only information available
    at `origin` (plus a legitimately-available weather forecast for the target).
    """
    target = origin + timedelta(days=horizon)
    doy = target.timetuple().tm_yday
    return [
        float(horizon),
        math.sin(2 * math.pi * doy / 365.25),
        math.cos(2 * math.pi * doy / 365.25),
        float(target.weekday()),
        float((origin - epoch).days),
        float(GRADE_CODES.get(grade, 0)),
        float(series.get(origin - timedelta(days=1), 0.0)),
        _mean_lag(series, origin, 7),
        _mean_lag(series, origin, 28),
        float(series.get(target - timedelta(days=SEASONAL_PERIOD_DAYS), 0.0)),
        cov.rain_window(target, 7),
        cov.rain_window(target, 30),
        cov.downtime_window(mine_code, origin, 7),
        cov.downtime_window(mine_code, origin, 28),
        cov.blast_window(mine_code, origin, 7),
        1.0 if is_opencast else 0.0,
    ]


def seasonal_naive(series: dict[date, float], target: date) -> float:
    """
    y_hat[t] = y[t - 365]. Falls back to the 28-day mean before the target when
    a year of history is unavailable, rather than returning zero.
    """
    v = series.get(target - timedelta(days=SEASONAL_PERIOD_DAYS))
    if v is not None:
        return float(v)
    return _mean_lag(series, target, 28)


#: The residual sigma floor, as a fraction of the mine's median one-step
#: sigma (DECISIONS.md D-043, F2). Pre-registered at 0.25 before any outcome was
#: measured, as a guard against degenerate bands rather than a calibration
#: lever. Not to be tuned.
SIGMA_FLOOR_FRACTION = 0.25


class ProductionForecaster:
    """
    Per-mine quantile GBT over all grades of that mine.

    One model set per mine (not per mine-grade) so each fit sees enough rows;
    `grade_code` is a feature, which keeps the forecast grade-aware as PRD B-5
    requires while sharing strength across grades.
    """

    def __init__(
        self,
        quantiles: Sequence[float] = DEFAULT_QUANTILES,
        random_state: int = 20260921,
        calibration_fraction: float = 0.25,
        rearrange: bool = True,
        day_blocks: bool = True,
    ):
        self.quantiles = tuple(quantiles)
        self.random_state = random_state
        self.calibration_fraction = calibration_fraction
        #: D-043 F1 + F2: sort every row's predicted quantiles before they are
        #: used, again after the conformal step, and floor the residual sigma.
        #: Off only to measure the ablation; the product runs with it on.
        self.rearrange = rearrange
        #: D-043 F3: simulate cumulative paths from blocks of days, every grade
        #: of the mine on the same days. Off only to measure the ablation.
        self.day_blocks = day_blocks
        self.models: dict[str, dict[float, HistGradientBoostingRegressor]] = {}
        #: Standardised one-step residuals per mine, rows of all its grades in
        #: calibration order (several per day). What the aggregation used before
        #: D-043; kept for the ablation and for diagnostics.
        self.residuals: dict[str, np.ndarray] = {}
        #: The same residuals as a table per mine: one row per target day, one
        #: column per grade, complete days only — see `residual_block`.
        self.residual_days: dict[str, dict] = {}
        # Conformal width correction, in tonnes, per (mine, horizon).
        # A single global width cannot serve both ends of the horizon range:
        # measured at 0.475 coverage for h=1 against 0.75 for h=14, because
        # short-horizon bands are narrow while the global correction is
        # dominated by long-horizon errors.
        self.conformal_width: dict[tuple[str, int], float] = {}
        self.conformal_width_default: dict[str, float] = {}
        self.epoch: date | None = None
        self.opencast: dict[str, bool] = {}

    def fit(
        self,
        series_by_key: dict[tuple[str, str], dict[date, float]],
        cov: Covariates,
        train_end: date,
        horizons: Sequence[int] = tuple(range(1, 15)),
        opencast: dict[str, bool] | None = None,
        min_history_days: int = SEASONAL_PERIOD_DAYS + 30,
    ) -> "ProductionForecaster":
        self.opencast = opencast or {}
        all_days = [d for s in series_by_key.values() for d in s]
        self.epoch = min(all_days)

        by_mine: dict[str, list[tuple[list[float], float, date]]] = defaultdict(list)
        for (mine, grade), series in series_by_key.items():
            days = sorted(d for d in series if d <= train_end)
            if not days:
                continue
            start = self.epoch + timedelta(days=min_history_days)
            for origin in days:
                if origin < start:
                    continue
                for h in horizons:
                    target = origin + timedelta(days=h)
                    if target > train_end or target not in series:
                        continue
                    x = make_features(
                        origin, h, series, cov, mine, grade,
                        self.opencast.get(mine, False), self.epoch,
                    )
                    by_mine[mine].append((x, float(series[target]), origin, grade))

        for mine, samples in by_mine.items():
            if len(samples) < 200:
                continue
            # Order by origin so the calibration split can be temporal.
            samples.sort(key=lambda t: t[2])
            X = np.array([s[0] for s in samples], dtype=float)
            y = np.array([s[1] for s in samples], dtype=float)

            # --- Conformalised quantile regression -------------------------
            # Raw quantile-GBT intervals are systematically too narrow out of
            # sample: fitting the pinball loss on training residuals
            # understates future spread. Measured here at 0.58 empirical
            # coverage against a 0.80 nominal interval.
            #
            # CQR (Romano, Patterson & Candes, 2019) fixes this without
            # touching the point forecast: fit the quantile models on a proper
            # training split, then on a held-out calibration split measure how
            # far actuals fall outside the predicted band, and widen the band
            # by the (1-alpha) quantile of that conformity score. Coverage then
            # holds by construction rather than by hope.
            #
            # PRD §11 lists calibration as a success metric -- "do 70%-confidence
            # predictions come true 70% of the time? Almost no team will measure
            # this." This is how it is made true rather than merely measured.
            # Calibrate on the MOST RECENT slice, not a random one.
            #
            # A random split assumes exchangeability, which time series
            # violate. Concretely: the evaluation window here spans the
            # monsoon, when rain drag genuinely widens the spread of daily
            # output. A width calibrated on a random sample of mixed-season
            # history is too narrow for that regime, and measured coverage sat
            # at 0.66 against a 0.80 nominal interval even after conformalising.
            #
            # Calibrating on the most recent history instead lets the width
            # track the regime the forecast is actually being made in.
            n = len(X)
            n_cal = max(50, int(n * self.calibration_fraction))
            n_cal = min(n_cal, n // 3)
            fit_idx = np.arange(0, n - n_cal)
            cal_idx = np.arange(n - n_cal, n)

            fits: dict[float, HistGradientBoostingRegressor] = {}
            for q in self.quantiles:
                m = HistGradientBoostingRegressor(
                    loss="quantile",
                    quantile=q,
                    max_iter=220,
                    learning_rate=0.07,
                    max_depth=6,
                    min_samples_leaf=25,
                    l2_regularization=1.0,
                    random_state=self.random_state,
                )
                m.fit(X[fit_idx], y[fit_idx])
                fits[q] = m
            self.models[mine] = fits

            # All quantiles for the calibration rows, one row of `cal_q` per
            # quantile. The models are fitted independently, so a row can come
            # out crossed — on one Balaghat day q90 fell below q50 and onto q10
            # (DECISIONS.md D-043). Sorting each column is the monotone
            # rearrangement (Chernozhukov, Fernandez-Val & Galichon, 2010): it
            # changes nothing on a row that did not cross.
            q_lo, q_hi = self.quantiles[0], self.quantiles[-1]
            cal_q = np.vstack([fits[q].predict(X[cal_idx]) for q in self.quantiles])
            if self.rearrange:
                cal_q = np.sort(cal_q, axis=0)
            lo_cal, hi_cal = cal_q[0], cal_q[-1]
            # Conformity score: signed distance outside the band.
            scores = np.maximum(lo_cal - y[cal_idx], y[cal_idx] - hi_cal)
            alpha = 1.0 - (q_hi - q_lo)

            def _conformal_q(vals: np.ndarray) -> float:
                if len(vals) == 0:
                    return 0.0
                k = int(np.ceil((len(vals) + 1) * (1 - alpha))) - 1
                k = max(0, min(k, len(vals) - 1))
                return float(np.sort(vals)[k])

            # Per-horizon widths. `horizon_days` is feature column 0.
            cal_h = X[cal_idx][:, 0].astype(int)
            for h in np.unique(cal_h):
                sel = scores[cal_h == h]
                # Below this many calibration points the quantile is too noisy
                # to trust; fall back to the pooled width.
                if len(sel) >= 30:
                    self.conformal_width[(mine, int(h))] = _conformal_q(sel)
            self.conformal_width_default[mine] = _conformal_q(scores)

            # --- residual series, for correlated cumulative aggregation -----
            #
            # P(cumulative < target) summed each day's predictive distribution
            # independently. Daily coverage was fine, so the backtest passed —
            # but the error was in how days *combine*, which nothing measured.
            #
            # Measured on the generated data: the real 14-day cumulative
            # coefficient of variation is 0.084-0.232 by mine, while summing
            # independent draws produces 0.034-0.069. Understating cumulative
            # spread by 2.5-3.4x is what pushed P(shortfall) to 1.000 on nine
            # of the ten mines: a target sitting ~7% above the expectation is
            # 3-7 sigma away when sigma is that small, and about 1 sigma away
            # when it is right.
            #
            # Rain drag, equipment downtime and blast delays persist across
            # days by construction in the generator, and the covariates capture
            # only part of that. So the residuals are kept, in time order, and
            # the aggregation bootstraps contiguous blocks of them. No
            # correlation structure is assumed: whatever persistence is in the
            # residuals is reproduced by sampling them in runs.
            #
            # One-step (h=1) calibration rows only: one per grade per day. This
            # comment used to say "one observation per origin and therefore a
            # genuine daily series"; a mine has several grades, so the rows of
            # a day were interleaved, and a block of residuals spanned a
            # quarter as many days as it had entries (D-043). The day table
            # below keeps the days as days.
            h_col = X[cal_idx][:, 0].astype(int)
            step1 = h_col == 1
            one_step = cal_idx[step1]
            if len(one_step) >= 30:
                lo = cal_q[0][step1]
                hi = cal_q[-1][step1]
                centre = (
                    cal_q[self.quantiles.index(0.5)][step1]
                    if 0.5 in self.quantiles else (lo + hi) / 2.0
                )

                # Standardise in LOG space, because that is where they are
                # applied.
                #
                # The first version standardised in level space —
                # (y - centre) / half-width — and then used the result as a
                # standard-normal shock on log(output). For a right-skewed
                # lognormal those are not the same variable, and the mismatch
                # compressed the cumulative spread: the calibration check below
                # showed cumulative coverage 0.575 against a nominal 0.80 with
                # 35% of origins in the outer tails, while daily coverage was a
                # correct 0.812. Same units on both sides now.
                z90 = 1.2815515655446004
                ok = (y[one_step] > 0) & (centre > 0) & (hi > lo) & (lo > 0)
                if int(np.sum(ok)) >= 30:
                    sd_day = (np.log(hi[ok]) - np.log(lo[ok])) / (2 * z90)
                    sd_day = np.maximum(sd_day, 1e-6)
                    if self.rearrange:
                        # D-043 F2. A band far narrower than the mine's typical
                        # one is a near-crossing, not information: on the failing
                        # day the sigma was 0.4% of the median, and dividing by
                        # it gave a residual of -626 that inflated the mine's
                        # residual scale sevenfold.
                        sd_day = np.maximum(
                            sd_day, SIGMA_FLOOR_FRACTION * float(np.median(sd_day))
                        )
                    r = (np.log(y[one_step][ok]) - np.log(centre[ok])) / sd_day
                    finite = np.isfinite(r)
                    r = r[finite]
                    if len(r) >= 30:
                        sd = float(np.std(r))
                        z = (r / sd if sd > 1e-9 else r).astype(float)
                        self.residuals[mine] = z
                        rows = one_step[ok][finite]
                        self.residual_days[mine] = _day_table(
                            [samples[i][2] + timedelta(days=1) for i in rows],
                            [samples[i][3] for i in rows],
                            z,
                        )
        return self

    def residual_block(self, mine_code: str, grade: str) -> np.ndarray | None:
        """
        The residuals a grade's cumulative distribution is simulated from.

        With day blocks (D-043 F3): that grade's column of the mine's day table
        — one value per day, days in order, and the same days for every grade.
        Paths drawn with one seed therefore use the same days for every grade
        of the mine, so the correlation between grades on a day is carried
        along with the persistence across days.

        Without: the mine's interleaved series, as it was before D-043.
        """
        if not self.day_blocks:
            return self.residuals.get(mine_code)
        t = self.residual_days.get(mine_code)
        if t is None or grade not in t["grades"]:
            return None
        return t["table"][:, t["grades"].index(grade)]

    def predict(
        self,
        mine_code: str,
        grade: str,
        origin: date,
        horizons: Sequence[int],
        series: dict[date, float],
        cov: Covariates,
    ) -> dict[int, dict[str, float]]:
        """Return {horizon: {q10, q50, q90}} for one mine and grade."""
        fits = self.models.get(mine_code)
        if not fits or self.epoch is None:
            raise RuntimeError(f"No fitted model for {mine_code}")
        X = np.array(
            [
                make_features(origin, h, series, cov, mine_code, grade,
                              self.opencast.get(mine_code, False), self.epoch)
                for h in horizons
            ],
            dtype=float,
        )
        preds = {q: fits[q].predict(X) for q in self.quantiles}
        out: dict[int, dict[str, float]] = {}
        for i, h in enumerate(horizons):
            width = self.conformal_width.get(
                (mine_code, int(h)), self.conformal_width_default.get(mine_code, 0.0)
            )
            lo = float(preds[self.quantiles[0]][i])
            mid = float(preds[self.quantiles[1]][i])
            hi = float(preds[self.quantiles[-1]][i])
            # Quantile crossing is possible with independent fits; sort to keep
            # the interval coherent rather than reporting lo > hi.
            lo, mid, hi = sorted((lo, mid, hi))
            # Conformal widening — calibrated on held-out data at fit time.
            lo -= width
            hi += width
            if self.rearrange:
                # A negative conformal width moves the endpoints towards each
                # other and can cross them, or the median (D-043 F1).
                lo, mid, hi = sorted((lo, mid, hi))
            out[h] = {
                "q10": max(0.0, lo),
                "q50": max(0.0, mid),
                "q90": max(0.0, hi),
                "conformal_width_tonnes": round(width, 2),
            }
        return out


def _day_table(days: list[date], grades: list[str], z: np.ndarray) -> dict:
    """
    Standardised one-step residuals as a table: one row per target day, one
    column per grade (D-043 F3).

    Only days on which every grade has a residual are kept, so a block of rows
    is a block of days for every grade at once; how many were dropped is
    recorded. The scale was fixed before this, across all of the mine's rows.
    """
    grade_order = tuple(sorted(set(grades)))
    cells = {(d, g): float(v) for d, g, v in zip(days, grades, z)}
    all_days = sorted(set(days))
    complete = [d for d in all_days if all((d, g) in cells for g in grade_order)]
    table = np.array([[cells[(d, g)] for g in grade_order] for d in complete], dtype=float)
    return {
        "grades": grade_order,
        "days": complete,
        "table": table.reshape(len(complete), len(grade_order)),
        "dropped_days": len(all_days) - len(complete),
    }


def shortfall_probability(
    horizon_preds: dict[int, dict[str, float]],
    target_tonnes: float,
    n_sim: int = 4000,
    seed: int = 20260921,
    residuals: np.ndarray | None = None,
) -> dict:
    """
    P(cumulative production < target) over the forecast horizon — PRD B-6, and
    the architecture's `P(cumulative < plan_target)`.

    Each day's predictive distribution is approximated as lognormal matched to
    the q10/q50/q90 the model produced, then days are summed by Monte Carlo.
    A lognormal is used because daily output is non-negative and right-skewed;
    the quantiles come from the fitted model, so the shape assumption only
    governs interpolation between them.

    Days are NOT treated as independent.
    ------------------------------------
    They were, and it was wrong. Summing independent daily draws gave a 14-day
    cumulative coefficient of variation of 0.034-0.069 by mine, against
    0.084-0.232 actually present in the data: an understatement of 2.5-3.4x.
    With spread that tight, a plan target sitting ~7% above the expectation is
    3-7 sigma away, so P(shortfall) came out at 1.000 for nine of ten mines and
    ranked nothing. Daily interval coverage was correct throughout, which is why
    the backtest passed: the error was in how days combine, and nothing measured
    that.

    When `residuals` is supplied — a standardised, time-ordered residual series
    from the model's own calibration slice — the days are simulated as a
    contiguous block sampled from it (a circular block bootstrap). Whatever
    persistence the residuals carry is reproduced by construction, with no
    correlation structure assumed. Rain drag, downtime and blast delay all
    persist across days in this data, and the covariates capture only part of
    that.

    Without residuals it falls back to independent draws and says so in
    `aggregation`, because a number produced one way must not be reported as
    though it were produced the other.
    """
    rng = np.random.default_rng(seed)
    horizons = sorted(horizon_preds)
    sims = np.zeros(n_sim, dtype=float)

    # Per-day lognormal parameters, matched to the quantiles the model produced.
    params: list[tuple[float, float]] = []
    for h in horizons:
        p = horizon_preds[h]
        q10, q50, q90 = p["q10"], p["q50"], p["q90"]
        if q50 <= 0:
            continue
        mu = math.log(max(q50, 1e-9))
        z = 1.2815515655446004  # Phi^-1(0.9)
        if q90 > q10 > 0:
            sigma = (math.log(q90) - math.log(q10)) / (2 * z)
        else:
            sigma = 0.15
        params.append((mu, float(min(max(sigma, 0.02), 1.5))))

    use_blocks = residuals is not None and len(residuals) >= max(30, len(params))
    if use_blocks:
        r = np.asarray(residuals, dtype=float)
        n_days = len(params)
        # Circular block bootstrap: one contiguous run of residuals per path, so
        # a wet fortnight stays a wet fortnight instead of averaging out.
        starts = rng.integers(0, len(r), size=n_sim)
        idx = (starts[:, None] + np.arange(n_days)[None, :]) % len(r)
        block = r[idx]                                  # (n_sim, n_days)
        mus = np.array([m for m, _ in params])[None, :]
        sigmas = np.array([sd for _, sd in params])[None, :]
        sims = np.exp(mus + sigmas * block).sum(axis=1)
        aggregation = "block-bootstrap of standardised model residuals (days correlated)"
    else:
        for mu, sigma in params:
            sims += rng.lognormal(mean=mu, sigma=sigma, size=n_sim)
        aggregation = "independent daily draws (no residual series available)"

    p_short = float(np.mean(sims < target_tonnes))
    return {
        "p_shortfall": round(p_short, 4),
        "expected_cumulative_tonnes": round(float(np.mean(sims)), 1),
        "p10_cumulative_tonnes": round(float(np.percentile(sims, 10)), 1),
        "p90_cumulative_tonnes": round(float(np.percentile(sims, 90)), 1),
        "target_tonnes": round(float(target_tonnes), 1),
        "expected_shortfall_tonnes": round(max(0.0, float(target_tonnes - np.mean(sims))), 1),
        "method": "Monte Carlo over per-day lognormal predictive distributions matched to model quantiles",
        "aggregation": aggregation,
        "n_simulations": n_sim,
        "assumption": (
            "Daily spread comes from the model's conformalised quantiles; the "
            "correlation between days comes from bootstrapped blocks of its own "
            "residuals, so no independence is assumed."
            if use_blocks
            else "No residual series was available, so days are summed as "
            "independent draws. That understates cumulative spread when shocks "
            "persist and pushes this probability towards 0 or 1."
        ),
    }
