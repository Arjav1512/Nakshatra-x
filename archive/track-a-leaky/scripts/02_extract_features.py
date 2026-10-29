import pandas as pd
import numpy as np
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
import real_data_client  # noqa: E402
# Feature definitions live in one place. This file previously kept its own copy
# of KNOWN_FAULTS and the spectral proxy formulas.
from features import (  # noqa: E402
    FEATURE_COLS,
    build_feature_row,
    dist_to_fault_km,
)

dataset_path = os.path.join(OUTPUT_DIR, "dataset_points.csv")
if not os.path.exists(dataset_path):
    import subprocess
    subprocess.run(["python3", os.path.join(BASE_DIR, "scripts", "01_make_dataset.py")], check=True)

points = pd.read_csv(dataset_path)

real_data = real_data_client.fetch_many(coords, progress_label="training points")

rows = []
for (idx, row), real in zip(points.iterrows(), real_data):
    lat, lng, label = row["lat"], row["lng"], row["label"]

    _, feature_map = build_feature_row(
        lat=lat,
        lng=lng,
        elevation_m=real["elevation_m"],
        soil_moisture=real["soil_moisture"],
        temp_c=real["land_temp_c"],
        rainfall_mm=real["rainfall_mm_monsoon"],
    )

    rows.append({
        "name": row["name"],
        "lat": lat,
        "lng": lng,
        "label": label,
        **{col: feature_map[col] for col in FEATURE_COLS},
        "soil_moisture": real["soil_moisture"],
        "data_source_live": real["is_live"],
    })

features_df = pd.DataFrame(rows)
train_table_path = os.path.join(OUTPUT_DIR, "training_table.csv")
features_df.to_csv(train_table_path, index=False)

live_count = int(features_df["data_source_live"].sum())
print(f"[SUCCESS] Extracted features for {len(features_df)} points "
      f"({live_count} from live NASA POWER API, {len(features_df) - live_count} fallback).")
print(f"Saved training table to {train_table_path}")
