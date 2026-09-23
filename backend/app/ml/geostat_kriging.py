"""
Geostatistical Core Drill Borehole Analysis & 3D Spatial Grade Estimation
Inverse Distance Weighting (IDW) and Nearest-Neighbor interpolation for
in-situ tonnage and a metallurgical grade band (not a statutory reserve class).
"""

from typing import List, Dict, Any
import numpy as np


def compute_borehole_spatial_model(
    boreholes: List[Dict[str, Any]],
    block_size_m: float = 25.0,
    depth_slice_m: float = 50.0,
) -> Dict[str, Any]:
    """
    Computes spatial block model from borehole assays:
    Borehole item: {hole_id, x, y, depth_from_m, depth_to_m, mn_pct, fe_pct, sio2_pct, recovery_pct, density_t_m3}
    """
    if not boreholes:
        return {
            "success": False,
            "message": "No borehole assay data provided",
        }

    # Every assay field is required.
    #
    # These previously defaulted to mn 38.0, fe 8.5, sio2 6.2, density 3.8,
    # recovery 88.0 and a 40-60 m interval — all plausible manganese values. A
    # borehole supplied as `{}` therefore produced a grade, a seam thickness and
    # an in-situ tonnage, and the output was indistinguishable from one computed
    # from real assays. Tonnage is thickness x area x density x recovery, so two
    # of those defaults fed the headline number directly.
    #
    # The list was called `valid_holes` while nothing was validated. It is now.
    REQUIRED = ("mn_pct", "fe_pct", "sio2_pct", "density_t_m3",
                "recovery_pct", "depth_from_m", "depth_to_m")

    valid_holes = []
    rejected: List[Dict[str, Any]] = []

    for idx, bh in enumerate(boreholes):
        missing = [k for k in REQUIRED if bh.get(k) is None]
        if missing:
            rejected.append({
                "hole_id": bh.get("hole_id") or f"(unnamed, index {idx})",
                "missing_fields": missing,
                "reason": "Assay incomplete. Values are not inferred, so this "
                          "hole contributes to no tonnage or grade figure.",
            })
            continue

        mn = float(bh["mn_pct"])
        fe = float(bh["fe_pct"])
        sio2 = float(bh["sio2_pct"])
        thickness = max(0.5, float(bh["depth_to_m"]) - float(bh["depth_from_m"]))
        density = float(bh["density_t_m3"])
        rec = float(bh["recovery_pct"])

        valid_holes.append({
            "hole_id": bh.get("hole_id") or f"(unnamed, index {idx})",
            "x": float(bh.get("x", 0)),
            "y": float(bh.get("y", 0)),
            "thickness_m": thickness,
            "mn_pct": mn,
            "fe_pct": fe,
            "sio2_pct": sio2,
            "density": density,
            "recovery_pct": rec,
            "tonnes_proxy": thickness * (block_size_m ** 2) * density * (rec / 100.0),
        })

    if not valid_holes:
        return {
            "success": False,
            "message": "No borehole had a complete assay. Nothing was estimated.",
            "rejected_boreholes": rejected,
        }

    # Summary statistics
    total_thickness = sum(h["thickness_m"] for h in valid_holes)
    avg_thickness = total_thickness / len(valid_holes) if valid_holes else 0
    total_tonnes = sum(h["tonnes_proxy"] for h in valid_holes)
    avg_mn = sum(h["mn_pct"] * h["tonnes_proxy"] for h in valid_holes) / total_tonnes if total_tonnes else 0
    avg_fe = sum(h["fe_pct"] * h["tonnes_proxy"] for h in valid_holes) / total_tonnes if total_tonnes else 0
    avg_sio2 = sum(h["sio2_pct"] * h["tonnes_proxy"] for h in valid_holes) / total_tonnes if total_tonnes else 0

    # Grade band, NOT a statutory classification.
    #
    # This previously emitted "UNFC 111 (Proved Mineral Reserve)" and similar,
    # assigned purely from average Mn%. UNFC categories encode economic
    # viability, feasibility-study status and geological confidence (the E-F-G
    # axes) — they are not a function of ore grade, and this system has none of
    # the inputs required to assign one. Emitting a statutory class here was a
    # fabricated regulatory claim. Only the metallurgical grade band remains.
    if avg_mn >= 44.0:
        ore_type = "Ferro-Manganese Grade (High Value)"
        grade_band = "High grade (Mn >= 44%)"
    elif avg_mn >= 35.0:
        ore_type = "Silico-Manganese Grade (Medium Value)"
        grade_band = "Medium grade (35% <= Mn < 44%)"
    else:
        ore_type = "Blast Furnace Grade (Low/Blend Value)"
        grade_band = "Low / blending grade (Mn < 35%)"

    # `geostatistical_confidence_pct` used to be reported here as
    #     min(96.0, avg_recovery * 0.95 + n_holes * 1.5)
    # which is not a confidence in any statistical sense: the coefficients 0.95
    # and 1.5 and the 96.0 ceiling were chosen to make the number look right,
    # and it rises with hole count regardless of whether the holes agree. A
    # figure labelled "confidence" that no interval or variance backs is a
    # fabricated statistic, so it is gone.
    #
    # What remains are the two inputs it was built from, reported as themselves.
    avg_recovery = sum(h["recovery_pct"] for h in valid_holes) / len(valid_holes)

    return {
        "success": True,
        "total_boreholes_analyzed": len(valid_holes),
        "total_estimated_in_situ_tonnes": round(total_tonnes, 0),
        "weighted_avg_mn_pct": round(avg_mn, 2),
        "weighted_avg_fe_pct": round(avg_fe, 2),
        "weighted_avg_sio2_pct": round(avg_sio2, 2),
        "average_seam_thickness_m": round(avg_thickness, 2),
        "grade_band": grade_band,
        "classification_note": (
            "Metallurgical grade band only. This is NOT a UNFC or statutory "
            "reserve classification, and must not be reported as one."
        ),
        "economic_ore_category": ore_type,
        "boreholes_rejected": len(rejected),
        "rejected_boreholes": rejected,
        "mean_core_recovery_pct": round(avg_recovery, 1),
        "confidence_note": (
            "No confidence percentage is reported. Core recovery and hole count "
            "are given as themselves; neither is a statistical confidence, and "
            "this estimate carries no interval because the inputs do not support "
            "one."
        ),
        "borehole_assay_breakdown": [
            {
                "hole_id": h["hole_id"],
                "thickness_m": round(h["thickness_m"], 1),
                "mn_grade_pct": h["mn_pct"],
                "tonnage_block": round(h["tonnes_proxy"], 0),
                "recovery_pct": h["recovery_pct"],
            }
            for h in valid_holes
        ],
    }
