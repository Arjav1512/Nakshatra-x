import pandas as pd
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load known manganese points
known_path = os.path.join(DATA_DIR, "known_manganese.csv")
known = pd.read_csv(known_path)

LAT_MIN, LAT_MAX = 20.5, 22.5
LNG_MIN, LNG_MAX = 78.5, 80.8

np.random.seed(42)

# Augment positive points around known deposits (simulating ore seam extent on ~1-3 km radius)
augmented_positives = []
for idx, row in known.iterrows():
    augmented_positives.append({
        "name": row["name"],
        "lat": row["lat"],
        "lng": row["lng"],
        "label": 1
    })
    # Generate 5 cluster points around each known mine
    for k in range(5):
        lat_jitter = np.random.normal(0, 0.018)
        lng_jitter = np.random.normal(0, 0.018)
        augmented_positives.append({
            "name": f"{row['name']}_ext_{k+1}",
            "lat": round(row["lat"] + lat_jitter, 5),
            "lng": round(row["lng"] + lng_jitter, 5),
            "label": 1
        })

positives_df = pd.DataFrame(augmented_positives)

# Background points (assumed manganese-free regional points)
n_background = 450
background = pd.DataFrame({
    "name": [f"bg_{i}" for i in range(n_background)],
    "lat": np.random.uniform(LAT_MIN, LAT_MAX, n_background).round(5),
    "lng": np.random.uniform(LNG_MIN, LNG_MAX, n_background).round(5),
    "label": 0
})

# Filter out any background points that accidentally fell right on a known deposit (< 0.05 deg)
clean_bg = []
for idx, row in background.iterrows():
    min_dist = min(np.sqrt((row["lat"] - k_lat)**2 + (row["lng"] - k_lng)**2) for k_lat, k_lng in zip(known["lat"], known["lng"]))
    if min_dist > 0.05:
        clean_bg.append(row)

background_df = pd.DataFrame(clean_bg)

dataset = pd.concat([positives_df, background_df], ignore_index=True)
dataset = dataset.sample(frac=1, random_state=42).reset_index(drop=True)

out_path = os.path.join(OUTPUT_DIR, "dataset_points.csv")
dataset.to_csv(out_path, index=False)

print(f"Known ground truth deposits: {len(known)}")
print(f"Total positive deposit samples (with seam extent): {len(positives_df)}")
print(f"Clean background points: {len(background_df)}")
print(f"Total dataset size: {len(dataset)}")
print(f"Saved dataset to {out_path}")
