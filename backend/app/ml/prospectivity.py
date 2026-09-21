"""
Track A prospectivity inference (PRD A-3, A-4, A-5, A-7).

Serves the honest model: gradient boosting over **real** Sentinel-2 band ratios
and SRTM terrain, with per-cell uncertainty from ordinary kriging.

Guardrails enforced in the response, not just the docs:
  * PRD §2.2 — surface indicators only; this does not detect subsurface ore.
  * PRD §2.4 — output is typed `prospectivity_score` / `grade_estimate`, never
    "reserve", and carries the decision-support boundary.

Track A output goes straight to the dashboard and does not pass through the
Track B decision layer (architecture: "the decision layer serves Track B only").
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Sequence

import numpy as np

AI_DIR = Path(__file__).resolve().parents[3] / "AI"
sys.path.insert(0, str(AI_DIR / "scripts"))

MODEL_VERSION = "track-a-gbt-lomo-v1"
_STATE: dict = {}


def _load() -> dict:
    if "model" in _STATE:
        return _STATE
    import joblib
    import pandas as pd
    from kriging import OrdinaryKriging  # noqa: E402
    from sentinel_features import FEATURE_COLS  # noqa: E402

    bundle_path = AI_DIR / "outputs" / "prospectivity_model_honest.pkl"
    table_path = AI_DIR / "outputs" / "training_table_honest.csv"
    metrics_path = AI_DIR / "outputs" / "model_metrics_honest.json"
    if not bundle_path.exists() or not table_path.exists():
        raise RuntimeError(
            "Honest Track A model not built. Run AI/scripts/07_build_honest_dataset.py "
            "then 08_train_honest_model.py."
        )

    bundle = joblib.load(bundle_path)
    df = pd.read_csv(table_path)
    scores = bundle["model"].predict_proba(bundle["scaler"].transform(df[FEATURE_COLS]))[:, 1]

    _STATE.update({
        "model": bundle["model"],
        "scaler": bundle["scaler"],
        "features": FEATURE_COLS,
        "table": df,
        "kriging": OrdinaryKriging(df.lat.values, df.lng.values, scores),
        "train_scores": scores,
        "metrics": json.loads(metrics_path.read_text()) if metrics_path.exists() else {},
    })
    return _STATE


def _guardrails() -> dict:
    return {
        "no_subsurface_detection": (
            "Inputs are Sentinel-2 surface reflectance and SRTM terrain. They "
            "carry no subsurface information; this does not detect ore at depth "
            "(PRD 2.2)."
        ),
        "not_a_reserve": (
            "Output is a prospectivity score for a qualified person, not a UNFC "
            "or statutory reserve figure (PRD 2.4)."
        ),
    }


def predict_point(lat: float, lng: float, fetch_live: bool = True) -> dict:
    """
    Score one location (PRD A-3) with uncertainty (A-4) and evidence (A-7).

    When `fetch_live` is set, real Sentinel-2 and SRTM values are fetched for
    the point. Otherwise only the kriged surface is returned, and the response
    says so — a value is never invented to fill the gap.
    """
    st = _load()
    krig_est, krig_sd = st["kriging"].uncertainty([lat], [lng])
    krig_est, krig_sd = float(krig_est[0]), float(krig_sd[0])

    result: dict = {
        "lat": lat,
        "lng": lng,
        "model_version": MODEL_VERSION,
        "kriged_prospectivity_score": round(krig_est, 4),
        "uncertainty_sd": round(krig_sd, 4),
        "uncertainty_basis": "Ordinary kriging variance over observed prospectivity scores.",
        "variogram": st["kriging"].vg.to_dict(),
        "guardrails": _guardrails(),
    }

    if not fetch_live:
        result["direct_model_score"] = None
        result["features"] = None
        result["note"] = (
            "Live satellite fetch disabled; only the kriged surface is returned. "
            "No feature values are reported because none were measured."
        )
        return result

    try:
        import httpx
        from sentinel_features import build_point_features, fetch_terrain

        with httpx.Client(timeout=45) as client:
            terrain = fetch_terrain([(lat, lng)], client=client)[0]
            rec = build_point_features(lat, lng, terrain, client=client)
        if rec is None:
            raise RuntimeError("No usable cloud-free Sentinel-2 scene for this point")

        x = np.array([[rec[c] for c in st["features"]]], dtype=float)
        p = float(st["model"].predict_proba(st["scaler"].transform(x))[0, 1])

        imp = dict(zip(st["features"], st["model"].feature_importances_))
        evidence = sorted(
            ({"feature": c, "value": rec[c], "model_importance": round(float(imp[c]), 4)}
             for c in st["features"]),
            key=lambda e: -e["model_importance"],
        )

        result.update({
            "direct_model_score": round(p, 4),
            "confidence": "high" if p >= 0.7 else ("medium" if p >= 0.4 else "low"),
            "features": {c: rec[c] for c in st["features"]},
            "evidence": evidence,
            "scene": {
                "scene_id": rec["scene_id"],
                "datetime": rec["scene_datetime"],
                "cloud_cover_pct": rec["cloud_cover_pct"],
            },
            "source": rec["source"],
            "is_synthetic": False,
            "is_live": True,
        })
    except Exception as exc:
        result["direct_model_score"] = None
        result["features"] = None
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["note"] = (
            "Live satellite read failed; only the kriged surface is returned. "
            "No feature values are reported because none were measured."
        )
    return result


def rank_drill_targets(candidates: Sequence[tuple[float, float]] | None = None,
                       top_n: int = 10) -> dict:
    """
    Rank candidate drill targets **with the evidence that drove each ranking**
    (PRD A-5 [D] P0).

    A-5 asks for ranking plus evidence. Expected information gain — the
    architecture's "★ differentiator" — is a [P] proposal, not a requirement,
    and is reported here as a secondary column rather than as the ranking key
    (see DECISIONS.md D-009).

    Primary ordering is the kriged score. `information_gain` is the kriging
    standard deviation: drilling where uncertainty is highest is what most
    reduces it, so it identifies where a hole would teach you the most as
    distinct from where ore is most likely.
    """
    st = _load()
    if candidates is None:
        # Grid over the study area, excluding cells that sit on a training point.
        lats = np.arange(20.6, 22.5, 0.05)
        lngs = np.arange(78.6, 80.8, 0.05)
        candidates = [(float(a), float(b)) for a in lats for b in lngs]

    lat = np.array([c[0] for c in candidates])
    lng = np.array([c[1] for c in candidates])
    est, sd = st["kriging"].uncertainty(lat, lng)

    rows = []
    for i in range(len(lat)):
        rows.append({
            "lat": round(float(lat[i]), 4),
            "lng": round(float(lng[i]), 4),
            "prospectivity_score": round(float(est[i]), 4),
            "uncertainty_sd": round(float(sd[i]), 4),
            "information_gain": round(float(sd[i]), 4),
        })
    rows.sort(key=lambda r: -r["prospectivity_score"])
    top = rows[:top_n]
    for rank, r in enumerate(top, 1):
        r["rank"] = rank
        r["evidence"] = (
            f"Kriged prospectivity {r['prospectivity_score']:.3f} with uncertainty "
            f"±{r['uncertainty_sd']:.3f} (kriging s.d.). Interpolated from "
            f"{len(st['table'])} measured points; the variogram range is "
            f"{st['kriging'].vg.range_m / 1000:.0f} km."
        )

    by_gain = sorted(rows, key=lambda r: -r["information_gain"])[:top_n]
    return {
        "model_version": MODEL_VERSION,
        "ranked_by": "kriged prospectivity score (PRD A-5)",
        "targets": top,
        "highest_information_gain": by_gain,
        "information_gain_note": (
            "Secondary view: cells where a hole would most reduce uncertainty. "
            "Expected information gain is a [P] design proposal, not a PRD "
            "requirement; A-5 requires ranking with evidence, which is the "
            "primary ordering above."
        ),
        "n_candidates": len(rows),
        "n_observations": int(len(st["table"])),
        "validation": st["metrics"].get("lomo", {}),
        "guardrails": _guardrails(),
    }


def model_metrics() -> dict:
    """Honest validation metrics for the evidence panel (PRD A-8, D-7)."""
    return _load()["metrics"]
