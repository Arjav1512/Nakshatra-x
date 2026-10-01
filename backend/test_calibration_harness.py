"""
Tests for the calibration validation harness (docs/DECISIONS.md D-040).

The cumulative calibration itself is NOT in this tree — it was measured, judged
against main, and declined (see docs/CALIBRATION.md and the D-040 addendum). What
survives is the instrument, and an instrument that decides whether a model change
ships has to be tested harder than the change would have been.

Three things are asserted, each of which is a way the instrument could have lied:

  1. distance to nominal — an overshoot must score as a loss, not a win. A
     directional rule would have scored coverage 0.98 against a nominal 0.80 as
     an improvement and shipped a distribution that is wrong in the other
     direction;
  2. the bootstrap really does cluster — resampling whole origin dates must widen
     the interval when a date's windows move together, and must not when they do
     not. A clustered bootstrap that silently behaved like a binomial one would
     have reported intervals ~1.6x too narrow on the real data;
  3. the verdict applies the pre-registered rule, including choosing the
     worse-looking loading when the pre-registered deciding statistic says so,
     and including refusing to claim it checked criterion 3.
"""
from __future__ import annotations

import numpy as np

import measure_cumulative_calibration as H


def _records(
    n_dates: int,
    per_date: int,
    arms: dict[str, list[bool]],
    pits: dict[str, list[float]] | None = None,
) -> list[dict]:
    """
    Synthetic cumulative records. `arms` maps arm name -> inside flags, in order,
    length n_dates * per_date.
    """
    out = []
    i = 0
    for d in range(n_dates):
        for w in range(per_date):
            rec = {
                "type": "cum",
                "origin": f"2026-01-{d + 1:02d}",
                "mine": f"M{w}",
                "grade": "g",
                "realised": 100.0,
                "arms": {},
            }
            for name, flags in arms.items():
                pit = (pits or {}).get(name, [0.5] * (n_dates * per_date))[i]
                rec["arms"][name] = {"pit": pit, "inside": flags[i], "rho": 0.0}
            out.append(rec)
            i += 1
    return out


def _boots(cum, n_boot=400):
    keys, by = H._clusters(cum)
    return list(H._boot_indices(keys, by, n_boot))


def test_overshoot_scores_as_a_loss_not_a_win():
    """
    The failure a directional rule would have passed.

    Arm A sits just under nominal (coverage 0.80 exactly); arm B overshoots badly
    (1.00). Distance to nominal must make B worse than A.
    """
    n = 40
    a_inside = [True] * 32 + [False] * 8          # 0.80 — exactly nominal
    b_inside = [True] * 40                        # 1.00 — 20 points too wide
    # PITs: A spread so ~10% land in the tails; B bunched mid, so 0% do.
    a_pit = ([0.01] * 2 + [0.99] * 2 + [0.5] * 36)
    b_pit = [0.5] * 40
    cum = _records(10, 4, {"a": a_inside, "b": b_inside},
                   {"a": a_pit, "b": b_pit})

    pr = H._paired(cum, "a", "b", _boots(cum))
    assert pr is not None
    assert pr["delta_coverage_toward_nominal"] < 0, (
        f"an overshoot from 0.80 to 1.00 scored {pr['delta_coverage_toward_nominal']:+.4f} "
        f"— the rule is directional, not distance to nominal"
    )
    # B's PIT dispersion is far BELOW uniform (too wide), so that is a loss too.
    assert pr["delta_pit_dispersion_toward_uniform"] < 0

    # And the verdict must refuse to ship it.
    report = {
        "arms": {},
        "paired": {"rho0__pooled": dict(pr, comparison="a -> b")},
    }
    v = H._verdict(report)
    assert v["ship_enabled"] is False
    assert v["criterion_1_no_metric_worse"] is False


def test_bootstrap_clusters_by_origin_date():
    """
    Whole origin dates are the resampling unit, so correlation within a date
    inflates the interval. If it did not, the intervals would be the binomial
    ones under another name.
    """
    # Perfectly correlated within a date: all 8 windows at a date agree.
    n_dates, per_date = 12, 8
    corr = []
    for d in range(n_dates):
        corr.extend([d < 9] * per_date)          # 9 of 12 dates inside -> 0.75
    cum_corr = _records(n_dates, per_date, {"a": corr})
    s_corr = H._arm_stats(cum_corr, "a", _boots(cum_corr, 800))

    # Independent within a date: the same overall rate, spread across windows.
    rng = np.random.default_rng(5)
    indep = list(rng.permutation([True] * 72 + [False] * 24).astype(bool))
    cum_ind = _records(n_dates, per_date, {"a": [bool(x) for x in indep]})
    s_ind = H._arm_stats(cum_ind, "a", _boots(cum_ind, 800))

    assert abs(s_corr["coverage_80"] - s_ind["coverage_80"]) < 0.02, (
        "the two fixtures must have the same coverage, or the comparison is "
        f"about coverage and not about clustering: {s_corr['coverage_80']} vs "
        f"{s_ind['coverage_80']}"
    )
    assert s_corr["design_effect"] > 3.0, (
        f"windows that move together within a date gave design effect "
        f"{s_corr['design_effect']} — the bootstrap is not clustering"
    )
    assert s_ind["design_effect"] < 2.0, (
        f"independent windows gave design effect {s_ind['design_effect']} — the "
        f"bootstrap is inflating intervals that need no inflation"
    )
    assert s_corr["effective_sample_size"] < s_ind["effective_sample_size"]


def test_verdict_follows_the_pre_registered_deciding_statistic():
    """
    The awkward case, which is what actually happened.

    Per-mine beats pooled on both primary metrics, but the pre-registered
    deciding statistic is PIT dispersion, whose interval includes zero. The rule
    must choose pooled anyway — that is the whole purpose of fixing the statistic
    in advance.
    """
    pooled_vs_permine = {
        "comparison": "pooled -> permine",
        "n_windows": 816,
        "delta_coverage_toward_nominal": 0.0270,
        "delta_coverage_ci": [0.0049, 0.0491],
        "delta_tails_toward_nominal": 0.0270,
        "delta_tails_ci": [0.0098, 0.0453],
        "delta_pit_dispersion_toward_uniform": 0.0108,
        "delta_pit_dispersion_ci": [-0.0005, 0.0155],   # includes zero, barely
    }
    rho0_vs_pooled = {
        "comparison": "rho0 -> pooled",
        "n_windows": 816,
        "delta_coverage_toward_nominal": 0.0355,
        "delta_coverage_ci": [0.011, 0.0662],
        "delta_tails_toward_nominal": 0.0196,
        "delta_tails_ci": [0.0037, 0.0466],
        "delta_pit_dispersion_toward_uniform": 0.0073,
        "delta_pit_dispersion_ci": [0.0016, 0.0147],
    }
    v = H._verdict({
        "arms": {},
        "paired": {"pooled__permine": pooled_vs_permine,
                   "rho0__pooled": rho0_vs_pooled},
    })
    assert v["loading"] == "pooled", (
        "per-mine was chosen on metrics the rule did not nominate as the decider"
    )
    assert v["ship_enabled"] is True  # the loading beat rho=0; main is judged elsewhere

    # Flip only the deciding statistic's interval: now per-mine is allowed.
    pooled_vs_permine["delta_pit_dispersion_ci"] = [0.0020, 0.0155]
    v2 = H._verdict({
        "arms": {},
        "paired": {"pooled__permine": pooled_vs_permine,
                   "rho0__permine": rho0_vs_pooled},
    })
    assert v2["loading"] == "permine"


def test_verdict_does_not_claim_to_have_checked_criterion_3():
    """
    It cannot check it, so it must say so.

    A run emits one set of daily rows because the loading never entered
    `predict`, so comparing arms here would compare a thing to itself and print
    PASS forever. An earlier draft of this script did exactly that.
    """
    v = H._verdict({
        "arms": {},
        "paired": {"rho0__pooled": {
            "comparison": "rho0 -> pooled", "n_windows": 10,
            "delta_coverage_toward_nominal": 0.01, "delta_coverage_ci": [0.001, 0.02],
            "delta_tails_toward_nominal": 0.01, "delta_tails_ci": [0.001, 0.02],
            "delta_pit_dispersion_toward_uniform": 0.0,
            "delta_pit_dispersion_ci": [-0.01, 0.01],
        }},
    })
    c3 = [ln for ln in v["lines"] if "CRITERION 3" in ln]
    assert len(c3) == 1
    assert "NOT CHECKED HERE" in c3[0]
    assert "PASS" not in c3[0]


def test_distance_helpers_use_the_declared_nominals():
    """Nominal coverage 0.80 and nominal tail frequency 0.10, not 0.5 or 0.0."""
    cum = _records(6, 4, {"a": [True] * 24},
                   {"a": [0.5] * 24})
    s = H._arm_stats(cum, "a", _boots(cum, 200))
    assert s["coverage_80"] == 1.0
    assert s["pit_at_extremes"] == 0.0
    assert abs(H.UNIFORM_PIT_SD - 1.0 / np.sqrt(12.0)) < 1e-12


if __name__ == "__main__":
    test_overshoot_scores_as_a_loss_not_a_win()
    test_bootstrap_clusters_by_origin_date()
    test_verdict_follows_the_pre_registered_deciding_statistic()
    test_verdict_does_not_claim_to_have_checked_criterion_3()
    test_distance_helpers_use_the_declared_nominals()
    print("harness tests passed")
