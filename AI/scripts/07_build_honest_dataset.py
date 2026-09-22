"""
Build the Track A training table from REAL measurements (PRD A-1, A-2).

Positives are the ten MOIL mine locations. Negatives are sampled across the
Central Indian manganese belt, away from known deposits.

The leakage rule, restated because it is the whole point of this script:
**no feature may be a function of distance to a known mine, and latitude and
longitude are not features.** Negatives are spatially separated from positives
by construction, so feeding coordinates to the model would let it rediscover
the label from position. Only measured surface reflectance and terrain enter
the feature vector.

Run:  python AI/scripts/07_build_honest_dataset.py [--negatives 40]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import httpx
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sentinel_features import (  # noqa: E402
    FEATURE_COLS,
    build_point_features,
    fetch_terrain,
)

OUT_DIR = Path(__file__).resolve().parents[1] / "outputs"

# Positives: MOIL's producing mines. These are the labels — and, critically,
# they are NOT used to derive any feature.
POSITIVES = [
    ("Balaghat", 21.83, 80.19),
    ("Bharweli", 21.86, 80.26),
    ("Ukwa", 21.93, 80.52),
    ("Tirodi", 22.16, 79.68),
    ("Dongri Buzurg", 20.99, 79.34),
    ("Chikla", 21.30, 79.66),
    ("Mansar", 21.44, 79.25),
    ("Kandri", 21.38, 79.32),
    ("Gumgaon", 21.33, 79.03),
    ("Beldongri", 21.16, 79.18),
]

# Study area: the Central Indian manganese corridor.
LAT_MIN, LAT_MAX = 20.5, 22.5
LNG_MIN, LNG_MAX = 78.5, 80.8

#: Negatives are kept this far from any positive so the label is credible.
#: This distance shapes SAMPLING only; it never becomes a feature.
MIN_SEPARATION_KM = 20.0


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def sample_negatives(n: int, seed: int = 20260921) -> list[tuple[str, float, float]]:
    rng = np.random.default_rng(seed)
    out: list[tuple[str, float, float]] = []
    tries = 0
    while len(out) < n and tries < n * 200:
        tries += 1
        lat = float(rng.uniform(LAT_MIN, LAT_MAX))
        lng = float(rng.uniform(LNG_MIN, LNG_MAX))
        if any(haversine_km(lat, lng, p[1], p[2]) < MIN_SEPARATION_KM for p in POSITIVES):
            continue
        if any(haversine_km(lat, lng, o[1], o[2]) < 6.0 for o in out):
            continue
        out.append((f"neg-{len(out) + 1:03d}", round(lat, 5), round(lng, 5)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--negatives", type=int, default=40)
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()

    points = [(n, la, lo, 1) for n, la, lo in POSITIVES]
    points += [(n, la, lo, 0) for n, la, lo in sample_negatives(args.negatives)]
    print(f"Building features for {len(points)} points "
          f"({sum(p[3] for p in points)} positive, {len(points) - sum(p[3] for p in points)} negative)")

    print("Fetching SRTM terrain (elevation + slope)...")
    terrain = fetch_terrain([(p[1], p[2]) for p in points])

    rows = []
    skipped = []
    with httpx.Client(timeout=45) as client:
        for i, ((name, lat, lng, label), terr) in enumerate(zip(points, terrain), 1):
            rec = build_point_features(lat, lng, terr, client=client,
                                       use_cache=not args.no_cache)
            if rec is None:
                skipped.append(name)
                print(f"  [{i:3d}/{len(points)}] {name:16} SKIPPED — no usable scene")
                continue
            rec["name"] = name
            rec["label"] = label
            rows.append(rec)
            print(f"  [{i:3d}/{len(points)}] {name:16} label={label} "
                  f"iron={rec['iron_oxide_ratio']:.3f} ferrous={rec['ferrous_ratio']:.3f} "
                  f"ndvi={rec['ndvi']:+.3f} slope={rec['slope_deg']:.2f}deg "
                  f"cloud={rec['cloud_cover_pct']:.1f}%")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / "training_table_honest.csv"
    cols = ["name", "lat", "lng", "label"] + FEATURE_COLS + [
        "scene_id", "scene_datetime", "cloud_cover_pct", "source", "is_synthetic"
    ]
    with csv_path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    meta = {
        "n_points": len(rows),
        "n_positive": sum(r["label"] for r in rows),
        "n_negative": len(rows) - sum(r["label"] for r in rows),
        "skipped": skipped,
        "feature_cols": FEATURE_COLS,
        "leakage_note": (
            "No feature is a function of distance to a known mine, and lat/lng "
            "are excluded from the feature set. The previous pipeline derived "
            "every spectral value from proximity to the mine coordinates, which "
            "are the positive labels."
        ),
        "lithology_note": (
            "GSI lithology is NOT included: bhukosh.gsi.gov.in and "
            "geoportal.gsi.gov.in were unreachable. Omitted rather than "
            "substituted with an invented value."
        ),
        "sources": [
            "Sentinel-2 L2A surface reflectance via Microsoft Planetary Computer",
            "SRTM 30 m elevation via OpenTopoData",
        ],
    }
    (OUT_DIR / "training_table_honest.meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"\nWrote {csv_path.relative_to(Path(__file__).resolve().parents[2])} "
          f"({len(rows)} rows, {meta['n_positive']} positive)")
    if skipped:
        print(f"Skipped (no usable scene): {', '.join(skipped)}")


if __name__ == "__main__":
    main()
