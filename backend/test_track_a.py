"""
Track A tests (PRD A-2, A-3, A-4, A-5).

The point of these is the leakage guard: the previous pipeline's ~0.98 AUC came
from features computed as a function of distance to the mine coordinates, which
are the positive labels. These tests make that class of failure detectable.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
AI = Path(__file__).resolve().parents[1] / "AI"
sys.path.insert(0, str(AI / "scripts"))

from kriging import OrdinaryKriging, to_local_metres  # noqa: E402
from sentinel_features import FEATURE_COLS  # noqa: E402

TABLE = AI / "outputs" / "training_table_honest.csv"


def test_no_feature_is_distance_to_a_mine():
    """
    The leakage guard.

    For every feature, correlation with distance-to-nearest-mine must be weak.
    The old proxy features were affine in that distance, so they would have
    correlated near-perfectly and this test would have caught them.
    """
    df = pd.read_csv(TABLE)
    pos = df[df.label == 1]

    def min_dist_km(lat, lng):
        d = []
        for _, m in pos.iterrows():
            x1, y1 = to_local_metres(np.array([lat]), np.array([lng]), m.lat, m.lng)
            d.append(float(np.hypot(x1[0], y1[0])) / 1000.0)
        return min(d)

    dist = np.array([min_dist_km(r.lat, r.lng) for r in df.itertuples()])
    worst, worst_r = None, 0.0
    for c in FEATURE_COLS:
        r = abs(float(np.corrcoef(df[c].values, dist)[0, 1]))
        if r > worst_r:
            worst, worst_r = c, r
    assert worst_r < 0.75, (
        f"feature '{worst}' correlates {worst_r:.2f} with distance to the nearest "
        "mine — that is the leakage the old pipeline had"
    )
    print(f"✓ No feature is a proxy for distance to a mine "
          f"(strongest |r| = {worst_r:.2f} on '{worst}')")


def test_coordinates_are_not_features():
    assert "lat" not in FEATURE_COLS and "lng" not in FEATURE_COLS
    assert not any("dist" in c or "fault" in c or "proximity" in c for c in FEATURE_COLS), FEATURE_COLS
    print(f"✓ Feature set excludes coordinates and any distance term: {FEATURE_COLS}")


def test_features_are_real_measurements():
    """Every row must name the scene it was measured from."""
    df = pd.read_csv(TABLE)
    assert df.is_synthetic.eq(False).all(), "Track A features must be measured, not synthetic"
    assert df.scene_id.notna().all() and df.scene_id.str.len().gt(10).all()
    assert df.cloud_cover_pct.le(15).all(), "a cloudy scene would corrupt the reflectance"
    print(f"✓ All {len(df)} rows carry a real Sentinel-2 scene id "
          f"(max cloud {df.cloud_cover_pct.max():.1f}%)")


def test_kriging_uncertainty_rises_away_from_data():
    """PRD A-4: per-cell uncertainty, not a bare score."""
    df = pd.read_csv(TABLE)
    rng = np.random.default_rng(0)
    values = rng.random(len(df))
    ok = OrdinaryKriging(df.lat.values, df.lng.values, values)

    _, sd_at = ok.uncertainty([float(df.lat.iloc[0])], [float(df.lng.iloc[0])])
    _, sd_far = ok.uncertainty([24.5], [76.0])  # well outside the sampled area
    assert sd_far[0] > sd_at[0], "kriging variance must grow away from observations"
    assert np.isfinite(sd_at[0]) and np.isfinite(sd_far[0])
    print(f"✓ A-4 uncertainty rises away from data: sd {sd_at[0]:.3f} at an "
          f"observation vs {sd_far[0]:.3f} far outside")


def test_honest_auc_is_reported_and_modest():
    """
    The headline metric must be the LOMO figure, and it must be materially
    below the leaked 0.98 — otherwise something is still leaking.
    """
    import json
    m = json.loads((AI / "outputs" / "model_metrics_honest.json").read_text())
    assert m["validation"] == "leave-one-mine-out"
    auc = m["lomo"]["auc"]
    assert 0.5 < auc < 0.95, f"LOMO AUC {auc} is implausible for 10 positives"
    assert auc < 0.95, "an AUC this high suggests leakage has returned"
    lo, hi = m["lomo"]["auc_ci95"]
    assert lo < auc < hi
    print(f"✓ Honest LOMO AUC {auc} (95% CI [{lo}, {hi}]), vs ~0.98 from the leaked pipeline")
    print(f"    ablation: {m['ablation_lomo_auc']}")


if __name__ == "__main__":
    test_coordinates_are_not_features()
    test_features_are_real_measurements()
    test_no_feature_is_distance_to_a_mine()
    test_kriging_uncertainty_rises_away_from_data()
    test_honest_auc_is_reported_and_modest()
    print("\nALL TRACK A TESTS PASSED.")
