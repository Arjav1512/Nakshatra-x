"""
No served interval is crossed: 0 <= q10 <= q50 <= q90, everywhere (D-043, A1).

The forecaster's quantiles come from three independently fitted models, and
nothing ordered them. On one Balaghat day q90 fell below q50 — a median outside
its own band — and that row is what broke the 14-day distribution. `predict`
sorted the three before the conformal step, but a negative conformal width
moves the endpoints towards each other afterwards and can cross them again.

These check what is served, not the mechanism: every committed forecast
artifact, every mine, grade and horizon; and `predict` itself, with the
conformal width forced strongly negative.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

ARTIFACTS = sorted((Path(__file__).resolve().parent / "artifacts" / "forecasts").glob("*.json"))


def test_there_are_forecast_artifacts_to_check():
    assert len(ARTIFACTS) == 10, [p.name for p in ARTIFACTS]


@pytest.mark.parametrize("path", ARTIFACTS, ids=[p.stem for p in ARTIFACTS])
def test_every_served_interval_is_ordered(path):
    data = json.loads(path.read_text())
    bad, n = [], 0
    for g in data["grades"]:
        for pt in g["trajectory"]:
            n += 1
            lo, mid, hi = pt["p10_tonnes"], pt["median_tonnes"], pt["p90_tonnes"]
            if not (0 <= lo <= mid <= hi):
                bad.append(f"{g['grade']} day {pt['horizon_days']}: p10 {lo}, median {mid}, p90 {hi}")
    assert n > 0, f"{path.name} has no trajectory points"
    assert not bad, f"{path.name}: {len(bad)} crossed interval(s) of {n}:\n  " + "\n  ".join(bad[:10])


def test_predict_stays_ordered_when_the_conformal_width_is_negative():
    """The conformal step cannot re-cross what rearrangement ordered."""
    from app.api.track_b import _forecaster, _state

    st = _state()
    code = "MOIL-BAL-01"
    fc = _forecaster(code, st["end"])
    saved = (dict(fc.conformal_width), dict(fc.conformal_width_default))
    try:
        for key in list(fc.conformal_width):
            fc.conformal_width[key] = -1000.0
        fc.conformal_width_default[code] = -1000.0
        bad = []
        for (mine, g), series in st["series"].items():
            if mine != code:
                continue
            for h, p in fc.predict(code, g, st["end"], list(range(1, 15)), series, st["cov"]).items():
                if not (0 <= p["q10"] <= p["q50"] <= p["q90"]):
                    bad.append(f"{g} h={h}: {p['q10']:.1f} / {p['q50']:.1f} / {p['q90']:.1f}")
        assert not bad, "crossed after a negative conformal width:\n  " + "\n  ".join(bad[:10])
    finally:
        fc.conformal_width.clear(); fc.conformal_width.update(saved[0])
        fc.conformal_width_default.clear(); fc.conformal_width_default.update(saved[1])
