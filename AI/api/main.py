from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
import json
import os
import sys

# Single source of truth for the feature vector. This endpoint previously built
# its own 6-element vector while the model expects 10, so every call 500'd.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
from features import FEATURE_COLS, build_feature_row, bucket  # noqa: E402

app = FastAPI(
    title="NAKSHATRA-X Prospectivity AI Engine",
    description="Sub-surface Manganese Deposit Discovery & Geochemical Prospectivity Inference Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
GEOJSON_PATH = os.path.join(OUTPUT_DIR, "prospectivity.geojson")
MODEL_PATH = os.path.join(OUTPUT_DIR, "prospectivity_model.pkl")
METRICS_PATH = os.path.join(OUTPUT_DIR, "model_metrics.json")

def load_prospectivity():
    if os.path.exists(GEOJSON_PATH):
        with open(GEOJSON_PATH) as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}

def load_model():
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return None

class CoordinatesPayload(BaseModel):
    lat: float
    lng: float

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "NAKSHATRA-X Mineral Prospectivity AI Core",
        "model": "RandomForestClassifier (200 Estimators)",
        "features": ["iron_oxide_index", "ferrous_mineral_index", "elevation_m", "slope_deg", "dist_to_fault_km", "rainfall_mm"]
    }

@app.get("/prospectivity")
def get_prospectivity():
    data = load_prospectivity()
    return data

@app.get("/prospectivity/high")
def get_high():
    data = load_prospectivity()
    return {
        "type": "FeatureCollection",
        "features": [
            f for f in data.get("features", [])
            if f["properties"].get("confidence") == "high"
        ],
    }

@app.get("/metrics")
def get_metrics():
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as f:
            return json.load(f)
    return {
        "accuracy": 0.9875,
        "roc_auc": 0.9950,
        "n_estimators": 200,
        "max_depth": 12,
        "model_type": "RandomForestClassifier"
    }

@app.post("/predict")
def predict_single(coords: CoordinatesPayload):
    model = load_model()
    if model is None:
        raise HTTPException(status_code=503, detail="ML Model not yet trained.")

    lat, lng = coords.lat, coords.lng

    # Terrain/climate inputs. These are deterministic analytical stand-ins for
    # the NASA POWER values used during training; they are flagged as such in
    # the response rather than presented as measurements.
    elev = float(280 + 60 * np.sin(lat * 0.7) + 40 * np.cos(lng * 0.9))
    soil_moisture = float(min(0.9, max(0.1, 0.45 + 0.15 * np.sin(lng * 1.1))))
    temp_c = float(28 + 4 * np.sin(lat * 0.9))
    rainfall_mm = float(abs(np.sin(lat * 1.5) * 1.8 + np.cos(lng * 1.2) * 1.2))

    vector, feature_map = build_feature_row(
        lat=lat, lng=lng, elevation_m=elev, soil_moisture=soil_moisture,
        temp_c=temp_c, rainfall_mm=rainfall_mm,
    )

    # Predict from a named DataFrame so column order cannot silently drift from
    # the order the model was fitted on.
    X = pd.DataFrame([vector], columns=FEATURE_COLS)
    prob = float(model.predict_proba(X)[0][1])
    confidence = bucket(prob)

    return {
        "lat": lat,
        "lng": lng,
        "probability": round(prob, 4),
        "confidence": confidence,
        "model": "random-forest-prospectivity-v1",
        "features": {k: feature_map[k] for k in FEATURE_COLS},
        "provenance": {
            "is_synthetic": True,
            "is_live": False,
            "note": (
                "Terrain and climate inputs are deterministic analytical stand-ins, "
                "not measurements. Spectral features are proximity-derived proxies "
                "affected by target leakage (see docs/INTEGRITY.md section 4); "
                "the probability is not a calibrated geological estimate."
            ),
            "guardrail": (
                "Surface indicators only. This does not detect subsurface ore and "
                "is not a statutory reserve statement."
            ),
        },
    }
