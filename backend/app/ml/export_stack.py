"""
Export the landing page's data stack from the honest Track A pipeline.

    python -m app.ml.export_stack

WHY THIS EXISTS
---------------
The landing page shows an exploded stack of layers. Every layer in it has to be
something this pipeline actually produced, or it is decoration pretending to be
evidence — which is what the map's six removed layers were.

`AI/outputs/prospectivity.geojson` looked like the obvious source and is not:
it carries `dist_to_fault_km`, `temp_c` and `rainfall_mm`, features the honest
rebuild dropped precisely because they leaked the labels or do not exist, and it
has 1,326 cells against the current model's 1,710. It is output from a
superseded model. Shipping it would put last pipeline's numbers under this
pipeline's name.

So the stack is generated here, from the model that is actually loaded:

  measured   the 50 training points, with their real Sentinel-2 band ratios and
             SRTM terrain — the evidence the model was fitted on
  surface    the kriged prospectivity score over the study grid
  spread     the kriging standard deviation for the same cells

A fourth layer — Sentinel-2 true-colour imagery for the belt — is deliberately
absent. Producing it means fetching and mosaicking L2A scenes for the whole
study area, which this pipeline does not do; an invented raster would be exactly
the fabrication this page is meant to demonstrate the absence of.
"""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / "frontend" / "public" / "data" / "prospectivity-stack.json"


def build() -> dict:
    import numpy as np

    from app.ml.prospectivity import MODEL_VERSION, _load, model_metrics

    st = _load()
    df = st["table"]

    lats = np.arange(20.6, 22.5, 0.05)
    lngs = np.arange(78.6, 80.8, 0.05)
    grid = [(float(a), float(b)) for a in lats for b in lngs]
    lat = np.array([c[0] for c in grid])
    lng = np.array([c[1] for c in grid])
    est, sd = st["kriging"].uncertainty(lat, lng)

    metrics = model_metrics()

    # Rounded hard: this is drawn at a few hundred pixels, and four decimals of
    # a probability is payload nobody can see.
    cells = [
        {"y": round(float(a), 3), "x": round(float(b), 3),
         "p": round(float(e), 3), "sd": round(float(s), 3)}
        for (a, b), e, s in zip(grid, est, sd)
    ]

    points = [
        {
            "y": round(float(r.lat), 3),
            "x": round(float(r.lng), 3),
            "label": int(r.label),
            "iron_oxide": round(float(r.iron_oxide_ratio), 4),
            "slope_deg": round(float(r.slope_deg), 2),
            "ndvi": round(float(r.ndvi), 4),
        }
        for r in df.itertuples()
    ]

    return {
        "generated_from": "app.ml.export_stack",
        "model_version": MODEL_VERSION,
        "validation": metrics.get("validation"),
        "lomo_auc": metrics.get("lomo", {}).get("auc"),
        "bounds": {"minY": 20.6, "maxY": 22.45, "minX": 78.6, "maxX": 80.75},
        "layers": [
            {
                "id": "measured",
                "name": "Measured points",
                "source_kind": "measured",
                "source": "Sentinel-2 L2A band ratios and SRTM terrain, per training point",
                "note": f"{len(points)} points the model was fitted on. Bands and terrain are measured; the site labels are public MOIL mine locations.",
            },
            {
                "id": "surface",
                "name": "Prospectivity surface",
                "source_kind": "derived",
                "source": f"Ordinary kriging over the fitted model ({MODEL_VERSION})",
                "note": f"{len(cells)} cells at 0.05 degrees. A surface prospectivity score, not a grade and not a reserve (PRD 2.4).",
            },
            {
                "id": "spread",
                "name": "Kriging uncertainty",
                "source_kind": "derived",
                "source": "Kriging standard deviation for the same cells",
                "note": "Where the surface is least constrained by a measurement. Shown because a score without its spread is not a result.",
            },
        ],
        "points": points,
        "cells": cells,
    }


def main() -> int:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"{OUT.relative_to(OUT.parents[3])}: {len(data['cells'])} cells, "
          f"{len(data['points'])} points, {size_kb:.0f} KB")
    if size_kb > 3072:
        print("  OVER BUDGET: the landing stack must stay under 3 MB")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
