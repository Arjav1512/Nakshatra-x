"""
Superseded. This script no longer exports anything.

WHY
---
It copied `AI/outputs/prospectivity.geojson` into `frontend/public/data/` and
`frontend/src/data/`, and the Next route served the latter. That file is output
from the model in `04_predict_grid.py` — the pre-honest pipeline — carrying
`dist_to_fault_km`, `temp_c` and `rainfall_mm`: two features the honest rebuild
in `07_build_honest_dataset.py` / `08_train_honest_model.py` dropped because
they leaked the labels, and one the model never had. 1,326 cells against the
honest model's 1,710.

So the map drew the superseded model's surface under the honest model's name,
with popups labelled "LIVE ML" and "Real-Time Telemetry" over a static file.

The surface is now served by `GET /api/v1/prospectivity/grid`, which scores the
grid with the model that is actually loaded and returns `model_version` and
`n_cells` with it. There is no committed copy to go stale.

The script is kept, and kept inert, as the record of how the copies got there.
Re-enabling it means re-introducing the defect; if a static export is ever
wanted, export from the honest model and carry its identity.
"""
import sys

print(__doc__)
sys.exit(
    "05_export_geojson.py is disabled: it published the superseded model's grid "
    "into the frontend. Use GET /api/v1/prospectivity/grid."
)

_DISABLED_ORIGINAL = """
import json
import os
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
ROOT_DIR = os.path.dirname(BASE_DIR)
# The Next.js app lives in frontend/. These copies previously landed in
# <repo>/public and <repo>/src, which the app never reads, so the map silently
# served a stale GeoJSON committed earlier.
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

src_geojson = os.path.join(OUTPUT_DIR, "prospectivity.geojson")

if not os.path.exists(src_geojson):
    import subprocess
    subprocess.run(["python3", os.path.join(BASE_DIR, "scripts", "04_predict_grid.py")], check=True)

with open(src_geojson, "r") as f:
    data = json.load(f)

features = data.get("features", [])
high = [f for f in features if f["properties"]["confidence"] == "high"]
med = [f for f in features if f["properties"]["confidence"] == "medium"]
low = [f for f in features if f["properties"]["confidence"] == "low"]

print("==================================================")
print("NAKSHATRA-X ML PIPELINE - GEOJSON EXPORT REPORT")
print("==================================================")
print(f"Total Gridded GeoJSON Features: {len(features)}")
print(f"High Prospectivity Sites (Red Glow, p >= 0.75):   {len(high)}")
print(f"Medium Prospectivity Sites (Amber, 0.45 <= p < 0.75): {len(med)}")
print(f"Background / Low Potential (Sage/Gray, p < 0.45):  {len(low)}")

# Sync GeoJSON into Next.js public and src/data directories for zero-latency client access
public_data_dir = os.path.join(FRONTEND_DIR, "public", "data")
src_data_dir = os.path.join(FRONTEND_DIR, "src", "data")

os.makedirs(public_data_dir, exist_ok=True)
os.makedirs(src_data_dir, exist_ok=True)

shutil.copyfile(src_geojson, os.path.join(public_data_dir, "prospectivity.geojson"))
shutil.copyfile(src_geojson, os.path.join(src_data_dir, "prospectivity.geojson"))

# Also copy model metrics
metrics_src = os.path.join(OUTPUT_DIR, "model_metrics.json")
if os.path.exists(metrics_src):
    shutil.copyfile(metrics_src, os.path.join(public_data_dir, "model_metrics.json"))
    shutil.copyfile(metrics_src, os.path.join(src_data_dir, "model_metrics.json"))

print(f"\n[OK] Synchronized GeoJSON to Next.js public/data and src/data directories.")
print("==================================================")

"""
