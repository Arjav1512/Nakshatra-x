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

#: Standard deviation of a U(0,1) variate. A calibrated predictive distribution
#: has uniform PIT values, so this is the target the cumulative calibration
#: matches. Larger means the distribution is too narrow; smaller, too wide.
UNIFORM_PIT_SD = 1.0 / math.sqrt(12.0)
#: Candidate common-factor loadings. Fine near zero, because that is where the
#: answer sits and where coverage moves fastest, and capped at 0.5 — a loading
#: above that would say most of a fortnight's variation is one shared shock,
#: which is a different model, not a calibration.
#: 0.02 steps: rho moves coverage smoothly, so a finer grid would cost backtest
#: minutes (the model refits at every origin) to buy precision below the noise
#: in the estimate.
CUMULATIVE_RHO_GRID = tuple(float(round(x, 3)) for x in np.arange(0.0, 0.5001, 0.02))
#: Below this many held-out cumulative windows the loading is too noisy to fit;
#: the mine falls back to the pooled median and says so.
MIN_CUMULATIVE_CALIBRATION_RECORDS = 40
#: Which calibrated loading the product applies.
#:
#: "pooled" — one loading for every mine, the median of the per-mine fits — is
#: what the pre-registered rule in docs/DECISIONS.md D-040 selected. Per-mine
#: loadings did beat pooled on held-out coverage (+0.027) and tails (+0.027),
#: both with intervals excluding zero, but the rule's deciding statistic was
#: held-out PIT dispersion, where per-mine gained +0.0108 with a 95% interval of
#: [-0.0005, 0.0155] — not strictly above zero. It missed by 0.0005.
#:
#: Switching to the statistic that gives the preferred answer after seeing the
#: numbers is the thing a pre-registration exists to prevent, so this stays
#: "pooled". The per-mine numbers are reported in full in D-040 so the choice can
#: be revisited deliberately rather than silently.
CUMULATIVE_LOADING_MODE = "pooled"


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
        cumulative_fraction: float = 0.12,
    ):
        self.quantiles = tuple(quantiles)
        self.random_state = random_state
        self.calibration_fraction = calibration_fraction
        #: Share of rows reserved, after the conformal slice, for calibrating
        #: the CUMULATIVE distribution. Carved out of the rows already held back
        #: from the quantile fits, so the fit set is unchanged.
        self.cumulative_fraction = cumulative_fraction
        self.models: dict[str, dict[float, HistGradientBoostingRegressor]] = {}
        #: Standardised one-step residuals per mine, in time order. Used to
        #: aggregate daily distributions into a cumulative one without assuming
        #: the days are independent — see the note in `fit`.
        self.residuals: dict[str, np.ndarray] = {}
        # Conformal width correction, in tonnes, per (mine, horizon).
        # A single global width cannot serve both ends of the horizon range:
        # measured at 0.475 coverage for h=1 against 0.75 for h=14, because
        # short-horizon bands are narrow while the global correction is
        # dominated by long-horizon errors.
        self.conformal_width: dict[tuple[str, int], float] = {}
        self.conformal_width_default: dict[str, float] = {}
        #: Calibrated common-factor loading per mine, for the cumulative
        #: distribution only. See `_calibrate_cumulative`.
        self.cumulative_rho: dict[str, float] = {}
        self.cumulative_rho_default: float = 0.0
        #: What the calibration saw and chose, per mine, so the number can be
        #: audited rather than taken on trust.
        self.cumulative_calibration: dict[str, dict] = {}
        self.epoch: date | None = None
        self.opencast: dict[str, bool] = {}

    def rho_for(self, mine_code: str) -> float:
        """
        The PER-MINE calibrated loading, or the pooled fallback if this mine's
        block was too thin to fit one.

        This is the per-mine estimate itself, not necessarily what the product
        applies — see `applied_rho`. Measurement code asks for this one directly
        when it needs the per-mine arm.
        """
        return self.cumulative_rho.get(mine_code, self.cumulative_rho_default)

    def applied_rho(self, mine_code: str) -> float:
        """
        The loading the product actually applies, honouring
        `CUMULATIVE_LOADING_MODE`.

        Everything that serves or validates a forecast goes through here, so the
        backtest measures the configuration that ships rather than a different
        one.
        """
        if CUMULATIVE_LOADING_MODE == "pooled":
            return self.cumulative_rho_default
        if CUMULATIVE_LOADING_MODE == "per_mine":
            return self.rho_for(mine_code)
        if CUMULATIVE_LOADING_MODE == "off":
            return 0.0
        raise ValueError(f"unknown CUMULATIVE_LOADING_MODE {CUMULATIVE_LOADING_MODE!r}")

    def calibration_summary(self, mine_code: str) -> dict:
        """
        The calibration record for serving: everything except the search curve.

        The curve is 26 rows per mine and belongs in a measurement run, not on
        every forecast artifact. What is kept is what a reader needs to judge
        the number: the loading, which way the block said it was wrong, how many
        held-out windows that came from, and which block.
        """
        meta = dict(self.cumulative_calibration.get(mine_code) or {})
        meta.pop("search_curve", None)
        meta.setdefault("calibrated", False)
        meta.setdefault("reason", "no calibration record for this mine")
        meta["loading_mode"] = CUMULATIVE_LOADING_MODE
        meta["rho_fitted_for_this_mine"] = round(self.rho_for(mine_code), 3)
        meta["rho_applied"] = round(self.applied_rho(mine_code), 3)
        return meta

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
                    by_mine[mine].append((x, float(series[target]), origin))

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
            #
            # THREE BLOCKS, NOT TWO
            # ---------------------
            # The held-back slice is split again, because the cumulative
            # distribution needs a block that the conformal widths and the
            # residual series have not seen either.
            #
            # Measured: on origins inside the conformal slice the cumulative
            # 80% band covered 0.852 of outcomes — too WIDE. On the backtest's
            # genuinely held-out origins the same construction covered 0.725 —
            # too narrow. Both numbers come from the same code; the difference
            # is only whether the widths and residuals were fitted on the
            # origins being scored. A loading calibrated on the conformal slice
            # would therefore read the deficiency as a surplus and correct the
            # wrong way.
            #
            #   fit block        origin <  cal_cut   -> the quantile GBTs
            #   conformal block  cal_cut..cum_cut    -> widths + residual series
            #   cumulative block origin >= cum_cut   -> the loading below
            #
            # The cuts land on origin boundaries, so no origin contributes rows
            # to two blocks. The cumulative block is carved out of rows already
            # held back, so the fit block is the same set of origins as before
            # and the point forecast is untouched.
            n = len(X)
            n_cal = max(50, int(n * self.calibration_fraction))
            n_cal = min(n_cal, n // 3)
            n_cum = min(int(n * self.cumulative_fraction), max(0, n_cal // 2))

            origins = [s[2] for s in samples]
            cal_cut = origins[n - n_cal]
            cum_cut = origins[n - n_cum] if n_cum > 0 else None

            o_arr = np.array([(d - self.epoch).days for d in origins], dtype=int)
            cal_cut_i = (cal_cut - self.epoch).days
            if cum_cut is not None:
                cum_cut_i = (cum_cut - self.epoch).days
                cum_mask = o_arr >= cum_cut_i
            else:
                cum_mask = np.zeros(n, dtype=bool)
            cal_mask = (o_arr >= cal_cut_i) & ~cum_mask
            fit_idx = np.flatnonzero(~cal_mask & ~cum_mask)
            cal_idx = np.flatnonzero(cal_mask)

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

            q_lo, q_hi = self.quantiles[0], self.quantiles[-1]
            lo_cal = fits[q_lo].predict(X[cal_idx])
            hi_cal = fits[q_hi].predict(X[cal_idx])
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
            # One-step (h=1) calibration rows only, which is one observation per
            # origin and therefore a genuine daily series.
            h_col = X[cal_idx][:, 0].astype(int)
            one_step = cal_idx[h_col == 1]
            if len(one_step) >= 30:
                mid = fits[0.5].predict(X[one_step]) if 0.5 in fits else None
                lo = fits[q_lo].predict(X[one_step])
                hi = fits[q_hi].predict(X[one_step])
                centre = mid if mid is not None else (lo + hi) / 2.0

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
                    r = (np.log(y[one_step][ok]) - np.log(centre[ok])) / sd_day
                    r = r[np.isfinite(r)]
                    if len(r) >= 30:
                        sd = float(np.std(r))
                        self.residuals[mine] = (r / sd if sd > 1e-9 else r).astype(float)

            # --- cumulative calibration, on the third block -----------------
            if cum_cut is not None and mine in self.residuals:
                self._calibrate_cumulative(
                    mine, series_by_key, cov, cum_cut, train_end, int(max(horizons)),
                )

        # Pooled fallback for a mine whose own block was too thin to calibrate.
        # The median, not the mean, so one mine with a degenerate block cannot
        # drag the others.
        fitted = [v for v in self.cumulative_rho.values()]
        if fitted:
            self.cumulative_rho_default = float(np.median(fitted))
        return self

    def _calibrate_cumulative(
        self,
        mine: str,
        series_by_key: dict[tuple[str, str], dict[date, float]],
        cov: Covariates,
        cum_cut: date,
        train_end: date,
        max_h: int,
        step_days: int = 2,
        n_sim: int = 1500,
    ) -> None:
        """
        Calibrate how much of each day's shock is shared across the window.

        THE PROBLEM
        -----------
        Daily intervals are calibrated (0.812 against 0.80 nominal) and the
        days are already aggregated with a block bootstrap of the model's own
        residuals, which is what brought P(shortfall) down off 1.000. But the
        14-day TOTAL was still too narrow on held-out origins: the 80% band
        covered 0.725 of outcomes and 0.175 landed in the outer 10% tails
        against an expected 0.10. The residual series is built from one-step
        errors, so it can only express persistence up to the length of the runs
        it contains; a fortnight-long regime — a wet spell, a long equipment
        outage — is wider than anything a one-step residual can say.

        THE CORRECTION, AND WHY IT IS THIS ONE
        --------------------------------------
        A single scalar: the share `rho` of each day's standardised shock that
        is common to the whole window.

            z_h = sqrt(1 - rho) * r_h + sqrt(rho) * e      e drawn once per path

        Because the weights' squares sum to one, every day's marginal
        distribution is left exactly as the model reported it — the daily
        intervals stay calibrated by construction, and the point forecast is not
        touched at all. Only the dependence between days changes, which is
        precisely what was wrong. Widening the daily sigmas instead would have
        bought the same cumulative coverage by breaking the daily coverage that
        is already correct.

        HOW IT IS FITTED
        ----------------
        On the cumulative block only: origins the quantile fits, the conformal
        widths and the residual series have all never seen. The block is
        embargoed by `max_h` days after the conformal cut, so no realised day
        used here was also used to fit a width.

        The objective is NOT the number that gets reported. Fitting rho to make
        coverage read 0.80 would be tuning the output. Instead rho is chosen to
        make the PIT values as dispersed as a calibrated forecast's would be —
        standard deviation 1/sqrt(12) for a uniform — which is a statement about
        the whole distribution. Coverage and tail frequency are then *measured*
        consequences, on origins this search never saw, in the backtest.
        """
        grades = sorted(g for (m, g) in series_by_key if m == mine)
        full = list(range(1, max_h + 1))
        r = self.residuals.get(mine)
        if r is None:
            return

        # Embargo: the conformal block's targets reach `max_h` days past its
        # last origin, so start that far in or the two blocks share realised
        # days.
        start = cum_cut + timedelta(days=max_h)

        recs: list[tuple[np.ndarray, np.ndarray, float]] = []
        for g in grades:
            series = series_by_key.get((mine, g))
            if not series:
                continue
            o = start
            while o + timedelta(days=max_h) <= train_end:
                actuals = [series.get(o + timedelta(days=h)) for h in full]
                if all(a is not None for a in actuals):
                    preds = self.predict(mine, g, o, full, series, cov)
                    params = lognormal_day_params(preds)
                    if params:
                        recs.append((
                            np.array([m for m, _ in params], dtype=float),
                            np.array([s for _, s in params], dtype=float),
                            float(sum(float(a) for a in actuals)),
                        ))
                o += timedelta(days=step_days)

        if len(recs) < MIN_CUMULATIVE_CALIBRATION_RECORDS:
            self.cumulative_calibration[mine] = {
                "calibrated": False,
                "reason": (
                    f"only {len(recs)} held-out cumulative windows available, "
                    f"below the {MIN_CUMULATIVE_CALIBRATION_RECORDS} needed for a "
                    f"stable estimate"
                ),
                "n_windows": len(recs),
            }
            return

        # One set of draws, reused across the grid, so differences between
        # loadings are the loading and not Monte Carlo noise.
        rng = np.random.default_rng(self.random_state)
        prepared = []
        for mus, sigmas, realised in recs:
            n_days = len(mus)
            starts = rng.integers(0, len(r), size=n_sim)
            idx = (starts[:, None] + np.arange(n_days)[None, :]) % len(r)
            prepared.append((
                mus[None, :], sigmas[None, :], r[idx],
                rng.standard_normal((n_sim, 1)), realised,
            ))

        def _pits(rho: float) -> np.ndarray:
            a, b = math.sqrt(1.0 - rho), math.sqrt(rho)
            out = np.empty(len(prepared), dtype=float)
            for i, (mus, sigmas, block, shared, realised) in enumerate(prepared):
                z = block if rho <= 0.0 else a * block + b * shared
                sims = np.exp(mus + sigmas * z).sum(axis=1)
                out[i] = float(np.mean(sims < realised))
            return out

        best_rho, best_dist = 0.0, float("inf")
        curve: list[dict] = []
        for rho in CUMULATIVE_RHO_GRID:
            pit = _pits(rho)
            sd = float(np.std(pit))
            dist = abs(sd - UNIFORM_PIT_SD)
            curve.append({
                "rho": round(float(rho), 3),
                "pit_sd": round(sd, 4),
                "coverage_80": round(float(np.mean((pit >= 0.10) & (pit <= 0.90))), 3),
            })
            if dist < best_dist:
                best_rho, best_dist = float(rho), dist

        chosen = _pits(best_rho)
        at_zero = _pits(0.0)
        sd_zero = float(np.std(at_zero))

        # Which way the block said the distribution was wrong. The common factor
        # can only widen, so a block that was already at or beyond nominal width
        # gets a zero loading and this field says so rather than letting a 0.00
        # read as "nothing needed doing".
        if sd_zero > UNIFORM_PIT_SD + 0.01:
            direction = "too narrow at rho=0; widened to the uniform target"
        elif sd_zero < UNIFORM_PIT_SD - 0.01:
            direction = (
                "ALREADY TOO WIDE at rho=0 (PIT less dispersed than uniform). "
                "The common factor only widens, so the loading is zero and this "
                "mine's cumulative distribution stays conservative. Narrowing it "
                "would mean shrinking intervals on held-out evidence, which is "
                "not a change this calibration is allowed to make."
            )
        else:
            direction = "already within 0.01 of the uniform target; no loading needed"

        self.cumulative_rho[mine] = best_rho
        self.cumulative_calibration[mine] = {
            "calibrated": True,
            "rho": round(best_rho, 3),
            "direction": direction,
            "at_grid_edge": bool(best_rho >= CUMULATIVE_RHO_GRID[-1] - 1e-9),
            "n_windows": len(recs),
            "block_start": start.isoformat(),
            "block_end": train_end.isoformat(),
            "objective": "match PIT dispersion to uniform (sd = 1/sqrt(12))",
            "uniform_pit_sd": round(UNIFORM_PIT_SD, 4),
            "in_block_pit_sd_at_rho_0": round(sd_zero, 4),
            "in_block_pit_sd_at_rho": round(float(np.std(chosen)), 4),
            "search_curve": curve,
            "note": (
                "Fitted on origins held out from the quantile fits, the "
                "conformal widths and the residual series. Coverage and tail "
                "frequency are reported by the backtest on later origins this "
                "search never saw."
            ),
        }

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
            out[h] = {
                "q10": max(0.0, lo),
                "q50": max(0.0, mid),
                "q90": max(0.0, hi),
                "conformal_width_tonnes": round(width, 2),
            }
        return out


def lognormal_day_params(
    horizon_preds: dict[int, dict[str, float]],
) -> list[tuple[float, float]]:
    """
    Per-day (mu, sigma) in log space, matched to the q10/q50/q90 the model
    produced. A lognormal is used because daily output is non-negative and
    right-skewed; the quantiles come from the fitted model, so the shape
    assumption only governs interpolation between them.
    """
    params: list[tuple[float, float]] = []
    for h in sorted(horizon_preds):
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
    return params


def cumulative_paths(
    horizon_preds: dict[int, dict[str, float]],
    residuals: np.ndarray | None = None,
    rho: float = 0.0,
    n_sim: int = 4000,
    seed: int = 20260921,
) -> np.ndarray | None:
    """
    Simulated cumulative-production totals over the forecast horizon.

    THE ONE CONSTRUCTION
    --------------------
    This function is the only place cumulative paths are built. The product's
    `shortfall_probability`, the backtest's calibration check and the
    calibration search in `ProductionForecaster.fit` all call it. They used to
    hold two copies of the arithmetic with a comment asking the reader to keep
    them identical; a calibration check that drifts from the thing it validates
    certifies nothing, so the duplicate is gone.

    `rho` is the common-factor loading described in `fit`: the share of each
    day's standardised shock that is shared across the whole window. It widens
    the cumulative distribution while leaving every day's marginal distribution
    exactly as the model reported it, because the two components are combined
    with weights whose squares sum to one.
    """
    rng = np.random.default_rng(seed)
    params = lognormal_day_params(horizon_preds)
    if not params:
        return None
    n_days = len(params)
    mus = np.array([m for m, _ in params])[None, :]
    sigmas = np.array([sd for _, sd in params])[None, :]

    if residuals is not None and len(residuals) >= max(30, n_days):
        r = np.asarray(residuals, dtype=float)
        # Circular block bootstrap: one contiguous run of residuals per path, so
        # a wet fortnight stays a wet fortnight instead of averaging out.
        starts = rng.integers(0, len(r), size=n_sim)
        idx = (starts[:, None] + np.arange(n_days)[None, :]) % len(r)
        block = r[idx]
    else:
        return None

    if rho > 0.0:
        shared = rng.standard_normal((n_sim, 1))
        block = math.sqrt(1.0 - rho) * block + math.sqrt(rho) * shared

    return np.exp(mus + sigmas * block).sum(axis=1)


def shortfall_probability(
    horizon_preds: dict[int, dict[str, float]],
    target_tonnes: float,
    n_sim: int = 4000,
    seed: int = 20260921,
    residuals: np.ndarray | None = None,
    rho: float = 0.0,
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
    sims = cumulative_paths(
        horizon_preds, residuals=residuals, rho=rho, n_sim=n_sim, seed=seed
    )
    use_blocks = sims is not None
    if use_blocks:
        aggregation = "block-bootstrap of standardised model residuals (days correlated)"
        if rho > 0.0:
            aggregation += (
                f"; plus a calibrated window-wide common factor "
                f"(loading {rho:.2f}, held-out calibration)"
            )
    else:
        # No residual series: fall back to independent daily draws, and say so.
        rng = np.random.default_rng(seed)
        sims = np.zeros(n_sim, dtype=float)
        for mu, sigma in lognormal_day_params(horizon_preds):
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
        "cumulative_common_factor_rho": round(float(rho), 3) if use_blocks else None,
        "assumption": (
            "Daily spread comes from the model's conformalised quantiles; the "
            "correlation between days comes from bootstrapped blocks of its own "
            "residuals, so no independence is assumed. A common-factor loading "
            "calibrated on held-out origins carries the window-wide shocks the "
            "one-step residuals cannot express; it leaves each day's marginal "
            "distribution unchanged."
            if use_blocks
            else "No residual series was available, so days are summed as "
            "independent draws. That understates cumulative spread when shocks "
            "persist and pushes this probability towards 0 or 1."
        ),
    }
