"""
A mine's expected shortfall is the sum of each grade's own (PRD §3).

The served figure was max(0, sum of plans - sum of expected), which lets a
surplus in one grade cancel a deficit in another. On the dataset frozen for the
demo it read 18.3 t for Balaghat while its grades were 95.5 t short, the console
had to re-add the grades itself, and the recommendation engine sized every
action from the netted 18.3 t (DECISIONS.md D-044). These pin the rule at the
source: the function, every served artifact, and the actions sized from it.
"""
import json
from pathlib import Path

import pytest

from app.api.track_b import mine_shortfall_tonnes

ARTIFACTS = Path(__file__).resolve().parent / "artifacts" / "forecasts"

#: What each candidate recovers, as a share of the mine's shortfall
#: (track_b.recommend_actions). Restated here so a change to either is seen.
RECOVERY_SHARE = {"blast-advance": 0.25, "shift-extend": 0.30, "relocate": 0.20}


def _grade(plan: float, expected: float) -> dict:
    return {
        "plan_target_tonnes": plan,
        "shortfall": {
            "expected_cumulative_tonnes": expected,
            "expected_shortfall_tonnes": round(max(0.0, plan - expected), 1),
        },
    }


@pytest.mark.parametrize(
    ("grades", "summed", "netted"),
    [
        # One grade short by 20 t, another 30 t over plan: netting reads 0 t.
        ([(100.0, 80.0), (100.0, 130.0)], 20.0, 0.0),
        # Short in both: the two agree.
        ([(100.0, 90.0), (50.0, 45.0)], 15.0, 15.0),
        # Over plan in both: nothing is short either way.
        ([(100.0, 110.0), (50.0, 60.0)], 0.0, 0.0),
        # Short in two, a small surplus in a third: netting understates.
        ([(300.0, 250.0), (200.0, 180.0), (100.0, 104.0)], 70.0, 66.0),
    ],
)
def test_a_surplus_in_one_grade_does_not_cancel_a_deficit_in_another(grades, summed, netted):
    per_grade = [_grade(p, e) for p, e in grades]
    assert mine_shortfall_tonnes(per_grade) == summed
    # The figure this replaced, for contrast: they differ exactly when a grade
    # has a surplus while another is short.
    assert round(max(0.0, sum(p for p, _ in grades) - sum(e for _, e in grades)), 1) == netted


def _served():
    paths = sorted(ARTIFACTS.glob("*_14d.json"))
    assert len(paths) == 10, f"expected ten committed forecasts, found {len(paths)}"
    return [json.loads(p.read_text()) for p in paths]


def test_every_served_forecast_sums_its_grades():
    for fx in _served():
        fx = fx.get("forecast", fx)
        per_grade = round(sum(g["shortfall"]["expected_shortfall_tonnes"] for g in fx["grades"]), 1)
        assert fx["portfolio"]["expected_shortfall_tonnes"] == per_grade, (
            f"{fx['mine_code']}: serves {fx['portfolio']['expected_shortfall_tonnes']} t, "
            f"its grades are short by {per_grade} t"
        )
        # No netted figure under the old name or any other: a mine total of
        # shortfall that can disagree with its grades is not served at all.
        assert set(fx["portfolio"]) == {
            "plan_target_tonnes", "expected_cumulative_tonnes", "expected_shortfall_tonnes",
        }, sorted(fx["portfolio"])


def test_actions_are_sized_from_the_served_shortfall(client):
    """Balaghat's actions on the frozen dataset are sized for 95.5 t, not 18.3 t."""
    fx = client.get("/api/v1/mines/1/forecast").json()
    recs = client.get("/api/v1/mines/1/recommendations").json()
    shortfall = fx["portfolio"]["expected_shortfall_tonnes"]
    per_grade = round(sum(g["shortfall"]["expected_shortfall_tonnes"] for g in fx["grades"]), 1)
    assert shortfall == per_grade
    assert recs["expected_shortfall_tonnes"] == shortfall

    actions = recs["approved_actions"] + recs["rejected_actions"]
    assert actions, "a mine with an expected shortfall should get candidate actions"
    sized = 0
    for a in actions:
        kind = next((k for k in RECOVERY_SHARE if a["id"].endswith(k)), None)
        if kind is None:
            continue
        sized += 1
        assert a["expected_recovery_tonnes"] == pytest.approx(shortfall * RECOVERY_SHARE[kind], abs=0.05), (
            f"{a['id']}: recovers {a['expected_recovery_tonnes']} t, "
            f"{RECOVERY_SHARE[kind]:.0%} of the served {shortfall} t would be "
            f"{shortfall * RECOVERY_SHARE[kind]:.1f} t"
        )
    assert sized == len(actions), [a["id"] for a in actions]
