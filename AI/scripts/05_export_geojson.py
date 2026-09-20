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
