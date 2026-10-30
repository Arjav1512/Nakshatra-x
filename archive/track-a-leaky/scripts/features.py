"""
Shared feature definitions for the prospectivity pipeline.

This module is the single definition of the feature vector. It previously
existed as three drifting copies (02_extract_features.py, 04_predict_grid.py,
api/main.py), and the API copy built only 6 of the 10 features the model
expects, so /predict returned 500 on every call.

-------------------------------------------------------------------------------
KNOWN LIMITATION — TARGET LEAKAGE
-------------------------------------------------------------------------------
`KNOWN_FAULTS` below is the list of MOIL mine coordinates, and every "spectral"
feature is computed as a linear function of `proximity` to those points. The
positive training labels are those same mines. The features therefore encode
the label, and any accuracy figure from a random split is an artefact of that
leakage rather than a measure of geological skill.

This is recorded here rather than quietly left in place. Phase 5 replaces these
proxies with real Sentinel-2 band ratios, DEM slope and GSI lithology, and
validates with leave-one-mine-out cross-validation. Until then, treat model
output as a placeholder and do not quote its accuracy.
See docs/INTEGRITY.md §4.
"""
import numpy as np

# Canonical order. The trained model expects exactly this, in this sequence.
FEATURE_COLS = [
    "iron_oxide_index",
    "ferrous_mineral_index",
    "swir_b11_reflectance",
    "swir_b12_reflectance",
    "ndvi",
    "elevation_m",
    "slope_deg",
    "dist_to_fault_km",
    "temp_c",
    "rainfall_mm",
]

# Structural control points. NOTE: these are the MOIL mine locations — see the
# leakage warning above.
KNOWN_FAULTS = [
    (21.83, 80.19),  # Balaghat-Bharweli
    (21.86, 80.26),  # Bharweli North
    (21.44, 79.25),  # Mansar-Ramtek
    (20.99, 79.34),  # Dongri Buzurg
    (22.16, 79.68),  # Tirodi
    (21.93, 80.52),  # Ukwa
    (21.30, 79.66),  # Chikla
    (21.38, 79.32),  # Kandri
    (21.33, 79.03),  # Gumgaon
    (21.16, 79.18),  # Beldongri
]

# Degrees -> km at this latitude (small-angle approximation).
DEG_TO_KM = 111.0


def dist_to_fault_km(lat, lng):
    """Great-circle-ish distance to the nearest structural control point, in km."""
    min_d = min(np.sqrt((lat - f[0]) ** 2 + (lng - f[1]) ** 2) for f in KNOWN_FAULTS)
    return round(min_d * DEG_TO_KM, 3)


def proximity_score(dist_km, cutoff_km=15.0):
    """1.0 at a control point, decaying linearly to 0.0 at `cutoff_km`."""
    return max(0.0, (cutoff_km - min(dist_km, cutoff_km)) / cutoff_km)


def _rng_for(lat, lng, seed=20260920):
    """
    Deterministic per-location RNG.

    The noise term was previously drawn from the global `np.random` state, so
    the same coordinate produced a different feature vector on every call and
    the pipeline was not reproducible. Seeding on the rounded coordinate makes
    a location's features stable across runs and across processes.
    """
    key = (seed, int(round(lat * 10000)), int(round(lng * 10000)))
    return np.random.default_rng(abs(hash(key)) % (2 ** 32))


def spectral_proxy(proximity, elevation_m, soil_moisture, lat, lng):
    """
    Physically-motivated proxies for surface indicators.

    These are NOT satellite reflectance measurements. They are a function of
    proximity to the structural control points plus real elevation and soil
    moisture. See the leakage warning at the top of this module.

    Returns a dict keyed by feature name.
    """
    rng = _rng_for(lat, lng)
    moisture_dev = soil_moisture - 0.5

    def noise(scale):
        return float(rng.normal(0, scale))

    iron_oxide = max(0.05, round(0.30 + 0.45 * proximity + 0.05 * moisture_dev + noise(0.02), 4))
    ferrous = max(0.05, round(0.22 + 0.38 * proximity + 0.04 * moisture_dev + noise(0.02), 4))
    swir_b11 = max(0.05, round(0.20 + 0.30 * proximity - 0.05 * soil_moisture + noise(0.015), 4))
    swir_b12 = max(0.05, round(0.24 + 0.32 * proximity - 0.04 * soil_moisture + noise(0.015), 4))
    slope = max(0.3, round(2.0 + 9.0 * proximity + 0.015 * max(0.0, elevation_m - 250.0) + noise(0.6), 1))
    ndvi = min(0.9, max(0.05, round(0.25 + 0.35 * soil_moisture - 0.10 * proximity + noise(0.03), 4)))

    return {
        "iron_oxide_index": iron_oxide,
        "ferrous_mineral_index": ferrous,
        "swir_b11_reflectance": swir_b11,
        "swir_b12_reflectance": swir_b12,
        "ndvi": ndvi,
        "slope_deg": slope,
    }


def build_feature_row(lat, lng, elevation_m, soil_moisture, temp_c, rainfall_mm):
    """
    Build one complete feature vector in `FEATURE_COLS` order.

    This is the function every caller should use — it is impossible to build a
    short vector through it, which is what broke /predict.
    """
    dist = dist_to_fault_km(lat, lng)
    prox = proximity_score(dist)
    sp = spectral_proxy(prox, elevation_m, soil_moisture, lat, lng)

    row = {
        **sp,
        "elevation_m": elevation_m,
        "dist_to_fault_km": dist,
        "temp_c": temp_c,
        "rainfall_mm": rainfall_mm,
    }
    missing = [c for c in FEATURE_COLS if c not in row]
    if missing:
        raise ValueError(f"Incomplete feature vector, missing: {missing}")
    return [row[c] for c in FEATURE_COLS], row


def bucket(p):
    """Confidence label for a probability."""
    if p >= 0.75:
        return "high"
    if p >= 0.45:
        return "medium"
    return "low"
