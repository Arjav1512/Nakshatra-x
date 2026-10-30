import numpy as np
import pandas as pd
import joblib
import json
import os
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
import real_data_client  # noqa: E402
from features import FEATURE_COLS, build_feature_row, bucket  # noqa: E402

model_path = os.path.join(OUTPUT_DIR, "prospectivity_model.pkl")
if not os.path.exists(model_path):
    import subprocess
    subprocess.run(["python3", os.path.join(BASE_DIR, "scripts", "03_train_model.py")], check=True)

model = joblib.load(model_path)

# Feature definitions come from the shared module — this file previously kept
# its own copy, which is how api/main.py drifted to a 6-element vector.
feature_cols = FEATURE_COLS

# Study area grid (Central India Manganese Corridor: Balaghat - Nagpur - Bhandara - Sausar)
LAT_MIN, LAT_MAX = 20.5, 22.5
LNG_MIN, LNG_MAX = 78.5, 80.8
step = 0.06  # ~6.5 km grid resolution

lats = np.arange(LAT_MIN, LAT_MAX, step)
lngs = np.arange(LNG_MIN, LNG_MAX, step)

grid_coords = [(lat, lng) for lat in lats for lng in lngs]
print(f"Fetching real live terrain + climate data (NASA POWER) for {len(grid_coords)} grid cells...")
real_data = real_data_client.fetch_many(grid_coords, progress_label="grid cells")

grid_features = []
print(f"Scoring prospectivity across spatial grid ({len(lats)} x {len(lngs)} = {len(grid_coords)} inference points)...")

for (lat, lng), real in zip(grid_coords, real_data):
    vector, _ = build_feature_row(
        lat=lat,
        lng=lng,
        elevation_m=real["elevation_m"],
        soil_moisture=real["soil_moisture"],
        temp_c=real["land_temp_c"],
        rainfall_mm=real["rainfall_mm_monsoon"],
    )
    grid_features.append(vector)

X_df = pd.DataFrame(grid_features, columns=feature_cols)
probs = model.predict_proba(X_df)[:, 1]

feature_list = []
timestamp_now = datetime.now(timezone.utc).isoformat()

for (lat, lng), p, feat in zip(grid_coords, probs, grid_features):
    conf = bucket(float(p))
    feature_list.append({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [round(lng, 5), round(lat, 5)],
        },
        "properties": {
            "probability": round(float(p), 4),
            "confidence": conf,
            "iron_oxide_index": round(float(feat[0]), 4),
            "ferrous_mineral_index": round(float(feat[1]), 4),
            "swir_b11_reflectance": round(float(feat[2]), 4),
            "swir_b12_reflectance": round(float(feat[3]), 4),
            "ndvi": round(float(feat[4]), 4),
            "elevation_m": round(float(feat[5]), 1),
            "slope_deg": round(float(feat[6]), 1),
            "dist_to_fault_km": round(float(feat[7]), 2),
            "temp_c": round(float(feat[8]), 1),
            "rainfall_mm": round(float(feat[9]), 1),
            "timestamp": timestamp_now,
        },
    })

geojson = {
    "type": "FeatureCollection",
    "metadata": {
        "generated_by": "NAKSHATRA-X Real-Time ML Engine",
        "model": "RandomForestClassifier (200 Estimators, Cross-Validated)",
        "data_sources": "NASA POWER (real elevation + T2M/TS/PRECTOTCORR/GWETTOP climatology), GSI structural fault coordinates",
        "grid_resolution": "0.06 deg (~6.5 km)",
        "features_count": len(feature_list),
        "high_priority_count": sum(1 for f in feature_list if f["properties"]["confidence"] == "high"),
        "medium_priority_count": sum(1 for f in feature_list if f["properties"]["confidence"] == "medium"),
        "low_priority_count": sum(1 for f in feature_list if f["properties"]["confidence"] == "low"),
        "generated_at": timestamp_now
    },
    "features": feature_list,
}

geojson_path = os.path.join(OUTPUT_DIR, "prospectivity.geojson")
with open(geojson_path, "w") as f:
    json.dump(geojson, f, indent=2)

print(f"\n[SUCCESS] Generated GeoJSON with {len(feature_list)} inference points to {geojson_path}")
