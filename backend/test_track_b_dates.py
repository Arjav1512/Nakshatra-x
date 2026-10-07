"""
The cumulative distribution is sane on many datasets, not one (D-043, A5, A6).

Track B's suite ran on one dataset — the committed one — and passed. Moving the
end date sixteen days, to 2026-10-06, put a crossed-quantile day into Balaghat's
calibration slice and its 14-day distribution came out narrower than treating
the days as independent: one dataset passing and another failing means the
suite only ever tested one. These fit the forecaster on eight datasets spread
over a year and check, at each end date, the properties the original bug and
this one broke:

- A6 (i): for every mine and grade, the correlated 14-day spread is at least
  0.9 x the independent-days spread — never pathologically narrower;
- A6 (ii): at least 80% of (mine, grade) P(shortfall) values lie in
  [0.001, 0.999] — the original aggregation bug saturated nine mines at 1.000;
- A6 (iii): for every mine, removing its single largest residual changes the
  residual scale by less than 10% — no single row dominates;
- A5 (the two pitch datasets): for every mine, removing the day with the largest
  standardised residual changes each grade's 14-day spread by less than 5%.

Thresholds and dates are DECISIONS.md D-043's, registered before any of this was
run. 241 s on an 8-core laptop, so by D-043's rule it is its own CI job on every
pull request.

**Every check here currently fails, on what is served, and is recorded as a
strict xfail.** No D-043 arm passed its rule, so served P(shortfall) kept main's
construction, which fails on all eight datasets (docs/QUANTILE_CROSSING.md):
- a correlated spread narrower than independent days on five of them (down to
  0.22x);
- a single residual moving a mine's scale by 10% or more on every one (up to 91%);
- saturation on two;
- a single day moving a 14-day spread by 5% or more for 20 and 26 grades on the
  two pitch datasets.

Strict, and limited to assertion failures: a date that starts passing, or a
crash, fails the run until the marker is removed. This is the follow-up's
target, not an accepted state.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pytest

from app.ingestion.generator import MINES, generate_all
from app.ml.backtest import _cumulative_paths
from app.ml.forecaster import ProductionForecaster, build_covariates, build_series, shortfall_probability

END_DATES = [
    date(2025, 12, 15), date(2026, 1, 31), date(2026, 3, 15), date(2026, 4, 30),
    date(2026, 6, 15), date(2026, 7, 31), date(2026, 9, 20), date(2026, 10, 6),
]
PITCH_DATES = [date(2026, 9, 20), date(2026, 10, 6)]
H = list(range(1, 15))

_FITS: dict[date, dict] = {}


def _fit(end: date) -> dict:
    """The shipped forecaster fitted at `end`, as Track B fits the served one."""
    if end not in _FITS:
        d = generate_all(end=end)
        series = build_series(d["production_by_mine_grade_period"])
        cov = build_covariates(d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"])
        opencast = {m.code: (m.mine_type.value == "opencast") for m in MINES}
        fc = ProductionForecaster().fit(series, cov, train_end=end, opencast=opencast)
        _FITS[end] = {"fc": fc, "series": series, "cov": cov, "plan": d["plan_target"]}
    return _FITS[end]


def _plan_target(plan, mine: str, grade: str, start: date, end: date) -> float:
    """Pro-rated plan target over the window — the same rule as track_b._plan_target."""
    total = 0.0
    for p in plan:
        g = p.grade if isinstance(p.grade, str) else (p.grade.value if p.grade else None)
        if p.mine_code != mine or g != grade:
            continue
        lo, hi = max(p.period_start, start), min(p.period_end, end)
        if lo > hi:
            continue
        total += float(p.target_tonnes) * ((hi - lo).days + 1) / max((p.period_end - p.period_start).days + 1, 1)
    return total


def _grades(series, mine: str) -> list[str]:
    return sorted({k[1] for k in series if k[0] == mine})


KNOWN_UNSOUND = pytest.mark.xfail(strict=True, raises=AssertionError, reason=(
    "DECISIONS.md D-043: no arm passed, so served P(shortfall) is main's construction, "
    "which fails these checks on every dataset measured (docs/QUANTILE_CROSSING.md). "
    "The follow-up's target."
))


@KNOWN_UNSOUND
@pytest.mark.parametrize("end", END_DATES, ids=[d.isoformat() for d in END_DATES])
def test_cumulative_distribution_is_sane(end):
    st = _fit(end)
    fc, series, cov = st["fc"], st["series"], st["cov"]
    narrower, probs, dominated = [], [], []
    start, stop = end + timedelta(days=1), end + timedelta(days=14)
    for mine in sorted(fc.models):
        z = np.asarray(fc.residuals.get(mine, []), dtype=float)
        if len(z) > 1:
            without = np.delete(z, int(np.argmax(np.abs(z))))
            change = 1.0 - float(np.std(without)) / float(np.std(z))
            if abs(change) >= 0.10:
                dominated.append(f"{mine}: largest residual moves the scale by {change:.1%}")
        for g in _grades(series, mine):
            preds = fc.predict(mine, g, end, H, series[(mine, g)], cov)
            block = fc.residual_block(mine, g)
            corr = _cumulative_paths(preds, block)
            ind = _cumulative_paths(preds, None)
            ratio = float(np.std(corr)) / float(np.std(ind))
            if ratio < 0.9:
                narrower.append(f"{mine} {g}: correlated sd {np.std(corr):.0f} vs independent {np.std(ind):.0f} ({ratio:.2f}x)")
            target = _plan_target(st["plan"], mine, g, start, stop)
            if target > 0:
                probs.append(shortfall_probability(preds, target_tonnes=target, residuals=block)["p_shortfall"])
    unsaturated = sum(1 for p in probs if 0.001 <= p <= 0.999)
    share = unsaturated / len(probs) if probs else 0.0
    problems = narrower + dominated
    if share < 0.8:
        problems.append(f"only {unsaturated}/{len(probs)} P(shortfall) in [0.001, 0.999] ({share:.0%})")
    assert not problems, f"end date {end}:\n  " + "\n  ".join(problems)


@KNOWN_UNSOUND
@pytest.mark.parametrize("end", PITCH_DATES, ids=[d.isoformat() for d in PITCH_DATES])
def test_no_single_day_moves_a_14_day_spread(end):
    """
    D-043 A5, on the construction actually served: the day table when the
    forecaster resamples by day, otherwise the interleaved series with every
    entry of that day removed (amendment 2).
    """
    st = _fit(end)
    fc, series, cov = st["fc"], st["series"], st["cov"]
    moved = []
    for mine in sorted(fc.models):
        t = fc.residual_days.get(mine)
        if t is None or len(t["table"]) < 30:
            continue
        if fc.day_blocks:
            worst = int(np.argmax(np.max(np.abs(t["table"]), axis=1)))
            worst_day = t["days"][worst]
            columns = {g: (t["table"][:, j], np.delete(t["table"], worst, axis=0)[:, j])
                       for j, g in enumerate(t["grades"])}
        else:
            z = np.asarray(fc.residuals[mine], dtype=float)
            days = fc.residual_row_days[mine]
            worst_day = days[int(np.argmax(np.abs(z)))]
            kept = np.array([d != worst_day for d in days])
            columns = {g: (z, z[kept]) for g in t["grades"]}
        for g, (full_r, cut_r) in columns.items():
            preds = fc.predict(mine, g, end, H, series[(mine, g)], cov)
            full = float(np.std(_cumulative_paths(preds, full_r)))
            cut = float(np.std(_cumulative_paths(preds, cut_r)))
            change = abs(cut - full) / full
            if change >= 0.05:
                moved.append(f"{mine} {g}: without {worst_day} the 14-day sd moves {change:.1%}")
    assert not moved, f"end date {end}:\n  " + "\n  ".join(moved)
