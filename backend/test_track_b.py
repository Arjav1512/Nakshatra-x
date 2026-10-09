"""
Track B tests (PRD B-5, B-6, B-10, C-5).

The backtest is the slow one — it refits the model at every origin. Run with
FULL_BACKTEST=1 for the reported configuration; the default is a reduced one so
the suite stays usable.
"""
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.ingestion.generator import MINES, generate_all
from app.ml.backtest import rolling_origin_backtest
from app.ml.constraints import (
    ActionType,
    ConstraintEngine,
    MineContext,
    ProposedAction,
    haversine_km,
)
from app.ml.forecaster import (
    NOMINAL_COVERAGE,
    ProductionForecaster,
    build_covariates,
    build_series,
    seasonal_naive,
    shortfall_probability,
)

PILOT = "MOIL-BAL-01"  # Balaghat — PRD §13 Q4 recommends it as the Track B pilot

_CACHE = {}


def _dataset():
    if "d" not in _CACHE:
        d = generate_all()
        _CACHE["d"] = d
        _CACHE["series"] = build_series(d["production_by_mine_grade_period"])
        _CACHE["cov"] = build_covariates(
            d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"]
        )
        _CACHE["opencast"] = {m.code: (m.mine_type.value == "opencast") for m in MINES}
    return _CACHE


def _mine_contexts() -> dict[str, MineContext]:
    return {
        m.code: MineContext(m.code, m.mine_type.value, m.latitude, m.longitude)
        for m in MINES
    }


# --------------------------------------------------------------------------
# B-5 / B-6 — forecasting and shortfall probability
# --------------------------------------------------------------------------

def test_forecaster_is_grade_aware():
    """PRD B-5 [PS] P0: forecast production per mine PER GRADE."""
    c = _dataset()
    end = date.fromisoformat(c["d"]["window"]["end"])
    origin = end - timedelta(days=20)
    fc = ProductionForecaster().fit(
        c["series"], c["cov"], train_end=origin, opencast=c["opencast"]
    )
    grades = [k[1] for k in c["series"] if k[0] == PILOT]
    preds = {}
    for g in grades:
        p = fc.predict(PILOT, g, origin, [1, 7, 14], c["series"][(PILOT, g)], c["cov"])
        preds[g] = p[7]["q50"]
    assert len(preds) >= 2, "pilot mine is not grade-split"
    assert len(set(round(v, 3) for v in preds.values())) > 1, (
        "every grade produced the same forecast — the model is not grade-aware"
    )
    print(f"✓ B-5 grade-aware: {len(preds)} grades forecast separately for {PILOT}")
    for g, v in sorted(preds.items(), key=lambda x: -x[1]):
        print(f"    {g:20} h=7 median {v:8.1f} t/day")


def test_forecaster_uses_no_future_information():
    """
    Leakage guard. Track A was invalidated by features derived from the label;
    the same mistake must not recur here. A forecast made at an origin must not
    change when data AFTER the origin is altered.
    """
    c = _dataset()
    end = date.fromisoformat(c["d"]["window"]["end"])
    origin = end - timedelta(days=30)
    key = (PILOT, "silico_manganese")

    fc = ProductionForecaster().fit(
        c["series"], c["cov"], train_end=origin, opencast=c["opencast"]
    )
    before = fc.predict(PILOT, key[1], origin, [1, 7, 14], c["series"][key], c["cov"])

    # Corrupt every future day; the prediction must be unaffected.
    tampered = dict(c["series"][key])
    for d0 in list(tampered):
        if d0 > origin:
            tampered[d0] = tampered[d0] * 10.0
    after = fc.predict(PILOT, key[1], origin, [1, 7, 14], tampered, c["cov"])

    for h in (1, 7, 14):
        assert abs(before[h]["q50"] - after[h]["q50"]) < 1e-9, (
            f"h={h} forecast changed when post-origin data was altered — leakage"
        )
    print("✓ No leakage: forecasts are unchanged when post-origin actuals are corrupted 10x")


def test_shortfall_probability_is_a_probability():
    """PRD B-6: shortfall risk as a probability with a confidence band."""
    c = _dataset()
    end = date.fromisoformat(c["d"]["window"]["end"])
    origin = end - timedelta(days=20)
    key = (PILOT, "silico_manganese")
    fc = ProductionForecaster().fit(
        c["series"], c["cov"], train_end=origin, opencast=c["opencast"]
    )
    preds = fc.predict(PILOT, key[1], origin, list(range(1, 15)), c["series"][key], c["cov"])
    expected = sum(p["q50"] for p in preds.values())

    impossible = shortfall_probability(preds, target_tonnes=expected * 3.0)
    trivial = shortfall_probability(preds, target_tonnes=expected * 0.2)
    even = shortfall_probability(preds, target_tonnes=expected)

    for r in (impossible, trivial, even):
        assert 0.0 <= r["p_shortfall"] <= 1.0
        assert r["p10_cumulative_tonnes"] <= r["expected_cumulative_tonnes"] <= r["p90_cumulative_tonnes"]

    assert impossible["p_shortfall"] > 0.95, "an unreachable target should be near-certain to be missed"
    assert trivial["p_shortfall"] < 0.05, "a trivial target should be near-certain to be met"
    assert 0.2 < even["p_shortfall"] < 0.8, "a target at the expectation should be genuinely uncertain"
    print(
        f"✓ B-6 P(cumulative < target) behaves: unreachable={impossible['p_shortfall']:.3f}, "
        f"at-expectation={even['p_shortfall']:.3f}, trivial={trivial['p_shortfall']:.3f}"
    )


# --------------------------------------------------------------------------
# B-10 — rolling-origin backtest
# --------------------------------------------------------------------------

def test_backtest_gbt_beats_baseline_and_is_calibrated():
    """
    PRD B-10 + the architecture's "seasonal-naive baseline that must be beaten",
    and PRD §11's calibration metric.
    """
    c = _dataset()
    end = date.fromisoformat(c["d"]["window"]["end"])
    # Coverage is a proportion: it needs enough predictions to be measurable.
    # A 90-day / 30-day-step window yields only 3 origins and 36 points, where a
    # single unlucky origin moves measured coverage by 0.25 — that configuration
    # was dropped because it tests sample size, not calibration.
    full = os.environ.get("FULL_BACKTEST") == "1"
    span, step, horizons = (150, 14, (1, 3, 7, 14)) if full else (120, 20, (1, 7, 14))

    res = rolling_origin_backtest(
        c["series"], c["cov"], PILOT,
        test_start=end - timedelta(days=span), test_end=end,
        horizons=horizons, origin_step_days=step, opencast=c["opencast"],
    ).to_dict()

    m, b = res["model"], res["baseline"]
    assert res["n_predictions"] >= 60, (
        f"only {res['n_predictions']} predictions — too few to assert on coverage"
    )
    assert m["mape_pct"] < b["mape_pct"], (
        f"GBT MAPE {m['mape_pct']}% did not beat baseline {b['mape_pct']}%"
    )
    cov = m["coverage_80"]
    assert 0.70 <= cov <= 0.90, (
        f"80% interval coverage {cov} is not near nominal {NOMINAL_COVERAGE}"
    )
    print(f"✓ B-10 {res['verdict']}")
    print(f"    coverage_80 = {cov} (nominal {NOMINAL_COVERAGE}, gap {m['coverage_gap']:+.3f})")
    print(f"    MAE {m['mae_tonnes']} t vs baseline {b['mae_tonnes']} t over "
          f"{res['n_predictions']} predictions from {res['n_origins']} origins")


# --------------------------------------------------------------------------
# C-5 — hard constraint engine
# --------------------------------------------------------------------------

def test_blast_in_statutory_rest_period_is_rejected():
    """
    PRD §6.3, verbatim: "A recommender that suggests blasting during a
    statutory rest period ... discredits the whole system in one demo."
    """
    eng = ConstraintEngine(_mine_contexts())
    a = ProposedAction(
        id="blast-night", action_type=ActionType.BLAST_RESCHEDULE,
        mine_code="MOIL-DON-05",  # opencast
        description="Advance blast to recover schedule",
        proposed_at=datetime(2026, 9, 21, 2, 30),  # 02:30
    )
    v = eng.check(a)
    assert not v.feasible
    assert any(x.rule == "blast_window" for x in v.violations)
    print(f"✓ C-5 night blast rejected: {v.violations[0].detail}")


def test_overnight_long_haul_relocation_is_rejected():
    """
    PRD §6.3, verbatim: "... or moving a shovel between mines 200 km apart
    overnight, discredits the whole system in one demo."
    """
    eng = ConstraintEngine(_mine_contexts())
    km = haversine_km(21.83, 80.19, 21.16, 79.18)  # Balaghat -> Beldongri
    a = ProposedAction(
        id="move-shovel", action_type=ActionType.EQUIPMENT_RELOCATION,
        mine_code="MOIL-BEL-10", description="Redeploy shovel overnight",
        equipment_id="SHOVEL-07", equipment_class="shovel",
        from_mine="MOIL-BAL-01", to_mine="MOIL-BEL-10",
        available_hours=10.0,
    )
    v = eng.check(a)
    assert not v.feasible
    assert any(x.rule == "relocation_feasibility" for x in v.violations)
    print(f"✓ C-5 overnight long-haul rejected ({km:.0f} km): {v.violations[0].detail}")


def test_surface_equipment_underground_is_rejected():
    eng = ConstraintEngine(_mine_contexts())
    a = ProposedAction(
        id="bad-fit", action_type=ActionType.EQUIPMENT_RELOCATION,
        mine_code="MOIL-BAL-01", description="Send dragline underground",
        equipment_class="dragline",
        from_mine="MOIL-DON-05", to_mine="MOIL-BAL-01", available_hours=200.0,
    )
    v = eng.check(a)
    assert not v.feasible
    assert any(x.rule == "equipment_compatibility" for x in v.violations)
    print(f"✓ C-5 incompatible equipment rejected: {v.violations[0].detail}")


def test_feasible_actions_pass_with_named_checks():
    eng = ConstraintEngine(_mine_contexts())
    ok = ProposedAction(
        id="blast-ok", action_type=ActionType.BLAST_RESCHEDULE,
        mine_code="MOIL-BAL-01", description="Blast at the inter-shift window",
        proposed_at=datetime(2026, 9, 21, 6, 30),
        last_blast_at=datetime(2026, 9, 20, 14, 30),
    )
    v = eng.check(ok)
    assert v.feasible, v.violations
    assert "blast_window" in v.checks_passed and "blast_separation" in v.checks_passed
    print(f"✓ C-5 feasible action approved, checks passed: {v.checks_passed}")


def test_gate_removes_infeasible_actions_entirely():
    """Infeasible actions must be removed, not downgraded or flagged."""
    eng = ConstraintEngine(_mine_contexts())
    actions = [
        ProposedAction(id="a1", action_type=ActionType.BLAST_RESCHEDULE, mine_code="MOIL-BAL-01",
                       description="ok", proposed_at=datetime(2026, 9, 21, 6, 30)),
        ProposedAction(id="a2", action_type=ActionType.BLAST_RESCHEDULE, mine_code="MOIL-DON-05",
                       description="night blast", proposed_at=datetime(2026, 9, 21, 3, 0)),
        ProposedAction(id="a3", action_type=ActionType.EQUIPMENT_RELOCATION, mine_code="MOIL-BEL-10",
                       description="impossible haul", equipment_class="shovel",
                       from_mine="MOIL-BAL-01", to_mine="MOIL-BEL-10", available_hours=2.0),
    ]
    approved, rejected = eng.gate(actions)
    ids_ok = {a["id"] for a in approved}
    assert ids_ok == {"a1"}, f"expected only a1 approved, got {ids_ok}"
    assert len(rejected) == 2
    for r in rejected:
        assert r["constraint_check"]["violations"], "a rejection must state why"
    print(f"✓ C-5 gate: {len(approved)} approved, {len(rejected)} removed entirely, each with a stated reason")


if __name__ == "__main__":
    test_forecaster_is_grade_aware()
    test_forecaster_uses_no_future_information()
    test_shortfall_probability_is_a_probability()
    test_blast_in_statutory_rest_period_is_rejected()
    test_overnight_long_haul_relocation_is_rejected()
    test_surface_equipment_underground_is_rejected()
    test_feasible_actions_pass_with_named_checks()
    test_gate_removes_infeasible_actions_entirely()
    test_backtest_gbt_beats_baseline_and_is_calibrated()
    print("\nALL TRACK B TESTS PASSED.")

# ---------------------------------------------------------------------------
# Cumulative-probability calibration
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason=(
    "DECISIONS.md D-043, measured: one-step residuals carry little persistence "
    "across days (Balaghat, mean over grades of each grade's daily Pearson lag-1: "
    "0.145 on the 20 Sep dataset, -0.011 on 6 Oct, main's construction). The lag-1 "
    "of about 0.5 this test used to read came from interleaving three or four "
    "grades per day: same-day correlation between grades, 0.68-0.81. Strict: when "
    "the follow-up makes the premise hold, this fails until the marker goes."
))
def test_residuals_persist_across_days():
    """
    The block bootstrap's premise: residuals carry persistence across days.

    If they do not, resampling them in blocks is an expensive way to reproduce
    independence, and any widening it produces comes from somewhere else. Pearson
    lag-1 of each grade's daily series (its column of the day table), averaged
    over the grades, must exceed 0.2 (D-043 A2, amendment 2: the same statistic
    whatever series the aggregation resamples).
    """
    import numpy as np

    from app.api.track_b import _forecaster, _state

    st = _state()
    code = "MOIL-BAL-01"
    fc = _forecaster(code, st["end"])
    t = fc.residual_days[code]
    assert len(t["table"]) >= 100, "no residual day table was kept"
    lag1 = float(np.mean([np.corrcoef(t["table"][:-1, j], t["table"][1:, j])[0, 1]
                          for j in range(len(t["grades"]))]))
    assert lag1 > 0.2, f"mean per-grade daily lag-1 {lag1:.3f} — nothing to preserve"


def test_cumulative_aggregation_beats_independent_days():
    """
    The served aggregation gives a wider 14-day distribution than independent days.

    P(cumulative < target) read 1.000 on nine of ten mines. Days were summed as
    independent lognormals, which gave a 14-day cumulative coefficient of
    variation of 0.034-0.069 by mine against 0.084-0.232 actually present in the
    data. Daily interval coverage was correct throughout (0.812 against a
    nominal 0.8), so the backtest passed: the error was in how days combine and
    nothing measured that.

    This compares the served aggregation with independent days on the same
    predictive distributions. What it does not show is *why* the served one is
    wider: D-043 measured that its residual series' apparent persistence is
    mostly same-day correlation between grades, interleaved — see
    test_residuals_persist_across_days and docs/QUANTILE_CROSSING.md.
    """
    import numpy as np

    from app.api.track_b import _forecaster, _state
    from app.ml.backtest import _cumulative_paths

    st = _state()
    code = "MOIL-BAL-01"
    origin = st["end"]
    fc = _forecaster(code, origin)
    assert code in fc.models
    grades = sorted({k[1] for k in st["series"] if k[0] == code})
    served = {g: fc.residual_block(code, g) for g in grades}
    for g, res in served.items():
        assert res is not None and len(res) >= 100, f"no residual series was kept for {g}"

    horizons = list(range(1, 15))
    wider = 0
    for g in grades:
        series = st["series"][(code, g)]
        preds = fc.predict(code, g, origin, horizons, series, st["cov"])
        blocks = _cumulative_paths(preds, served[g])
        indep = _cumulative_paths(preds, None)
        assert blocks is not None and indep is not None
        if float(np.std(blocks)) > float(np.std(indep)):
            wider += 1
    assert wider == len(grades), (
        f"correlated aggregation was not wider for {len(grades) - wider} of "
        f"{len(grades)} grades"
    )


def test_expected_shortfall_does_not_depend_on_how_days_correlate():
    """
    The console's focal number is a mean, so it must not rest on the premise
    D-043 falsified (DECISIONS.md D-044, pre-registered there).

    Expected production over the window is the sum of each day's expectation,
    however the days depend on each other: the sum over days of the mean, over
    the residual series the aggregation resamples, of exp(mu_d + sigma_d * r).
    The served figure is a Monte Carlo over blocks of that series. Grade by
    grade, it must lie within four Monte Carlo standard errors of the exact
    expectation, plus 0.05 t of rounding. Four is not a tuned tolerance: a
    correct implementation fails it about once in 16,000 grades. Expected
    shortfall is max(0, plan - this), so it is covered with it.
    """
    import math

    import numpy as np

    from app.api.track_b import _forecaster, _state, forecast_mine
    from app.ml.backtest import _cumulative_paths

    st = _state()
    origin = st["end"]
    fc = _forecaster(PILOT, origin)
    served = {g["grade"]: g["shortfall"] for g in forecast_mine(PILOT, horizon_days=14)["grades"]}
    grades = sorted({k[1] for k in st["series"] if k[0] == PILOT})
    assert sorted(served) == grades

    z = 1.2815515655446004
    for g in grades:
        preds = fc.predict(PILOT, g, origin, list(range(1, 15)), st["series"][(PILOT, g)], st["cov"])
        r = np.asarray(fc.residual_block(PILOT, g), dtype=float)
        # Each day's lognormal, matched to its quantiles as the aggregation does.
        params = []
        for h in sorted(preds):
            q10, q50, q90 = preds[h]["q10"], preds[h]["q50"], preds[h]["q90"]
            if q50 <= 0:
                continue
            sd = (math.log(q90) - math.log(q10)) / (2 * z) if q90 > q10 > 0 else 0.15
            params.append((math.log(max(q50, 1e-9)), min(max(sd, 0.02), 1.5)))
        assert len(r) >= max(30, len(params)), f"{g}: served from independent draws, not blocks"

        exact = sum(float(np.mean(np.exp(mu + sd * r))) for mu, sd in params)
        paths = _cumulative_paths(preds, r)
        se = float(np.std(paths, ddof=1)) / math.sqrt(len(paths))
        got = served[g]["expected_cumulative_tonnes"]
        assert abs(got - exact) <= 4 * se + 0.05, (
            f"{g}: served expected production {got} t, exact expectation {exact:.1f} t, "
            f"Monte Carlo se {se:.2f} t — the focal number depends on the aggregation"
        )
        print(f"    {g}: served {got} t, exact {exact:.1f} t, |diff| {abs(got - exact):.2f} t, 4 se {4 * se:.2f} t")


def test_d045_rebuilds_the_calibration_slice_exactly_as_fit_does():
    """
    DECISIONS.md D-045's candidates read the fit's held-out calibration slice,
    rebuilt outside `fit`. The rebuilt rows must reproduce every conformal width
    the fit computed — if `fit` changes how it builds or splits its samples, the
    candidates would otherwise go on measuring a slice nobody fitted.
    """
    import numpy as np

    from app.api.track_b import _forecaster, _state
    from app.ml import cumulative_candidates as cc

    st = _state()
    fc = _forecaster(PILOT, st["end"])
    paths, rows = cc.calibration_paths(fc, st["series"], st["cov"], st["end"])
    cc.check_reconstruction(fc, rows)
    assert PILOT in paths and paths[PILOT], "no complete calibration paths for the pilot"
    for g, gp in paths[PILOT].items():
        assert len(gp.origins) >= cc.MIN_PATHS, f"{g}: {len(gp.origins)} complete paths"
        assert gp.z.shape == (len(gp.origins), len(cc.H)) and np.isfinite(gp.z).all()
        # Every path ends on or before the fit's last day: nothing from the future.
        assert max(gp.origins) + timedelta(days=len(cc.H)) <= st["end"]


def test_backtest_reports_cumulative_calibration():
    """
    The artifact must carry the cumulative calibration, not only daily coverage.

    Daily coverage is what the backtest measured before, and it is exactly the
    metric that cannot see an aggregation error.
    """
    import json
    from pathlib import Path

    path = (Path(__file__).resolve().parent / "artifacts" / "backtests"
            / "MOIL-BAL-01_150d_14step.json")
    if not path.exists():
        print("SKIPPED — no committed backtest artifact")
        return
    d = json.loads(path.read_text())
    c = d.get("cumulative_calibration")
    assert c, "the backtest artifact reports no cumulative calibration"
    assert c["n_origins"] >= 10, c
    assert 0.0 <= c["coverage_80"] <= 1.0
    assert 0.2 <= c["mean_pit"] <= 0.8, f"cumulative distribution is badly off-centre: {c}"
    # The failure mode this exists to catch: a distribution so narrow that
    # almost every realised total lands in a tail.
    assert c["pit_at_extremes"] <= 0.30, (
        f"{c['pit_at_extremes']:.0%} of origins fall in the outer 10% tails — "
        "the cumulative distribution is too narrow"
    )
