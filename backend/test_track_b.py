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
