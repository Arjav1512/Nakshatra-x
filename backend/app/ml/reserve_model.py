"""
Heuristic surface-indicator prospectivity score.

This is a hand-written weighted scoring function over surface indicators, not a
trained classifier: the module imports only `math`. It was previously named
"XGBoost / Random Forest Reserve Hotspot Classifier", which no code here
supports. The trained scikit-learn model lives in AI/ and is the one to use for
real predictions.

Guardrail: surface indicators carry no subsurface information. Output is
decision-support prioritisation for where to drill, never a reserve statement.
"""
from typing import Dict, Any, List
import math

class ReserveHotspotModel:
    def __init__(self):
        self.model_name = "heuristic-surface-indicator-score-v1"
        self.features = ["ndvi", "soil_moisture", "land_surface_temp", "swir_anomaly", "geological_prior"]

    def predict_reserve_hotspot(
        self,
        ndvi: float,
        soil_moisture: float,
        land_temp: float,
        swir_anomaly: float = 0.78,
        historical_grade_pct: float = 38.5,
    ) -> Dict[str, Any]:
        """
        Calculates prospectivity score (0 - 100), category, and estimated reserve depth.
        Surface proxy characteristics of manganese-bearing gondite/ore horizons:
        - Higher spectral SWIR absorption
        - Characteristic soil moisture retention in fractured ore zones
        - Moderate NDVI with thermal anomaly contrast
        """
        # Base confidence calculation from multi-spectral proxy weights
        w_swir = 0.35 * min(100.0, swir_anomaly * 100.0)
        w_moisture = 0.25 * min(100.0, (soil_moisture / 50.0) * 100.0)
        w_temp = 0.20 * max(0.0, 100.0 - abs(land_temp - 33.5) * 8.0)
        w_ndvi = 0.10 * min(100.0, (ndvi / 0.8) * 100.0)
        w_grade = 0.10 * min(100.0, (historical_grade_pct / 45.0) * 100.0)

        raw_score = w_swir + w_moisture + w_temp + w_ndvi + w_grade
        confidence_pct = round(max(20.0, min(96.8, raw_score)), 1)

        if confidence_pct >= 75.0:
            category = "PRIORITY_VALIDATION"
            recommendation = "Immediate diamond core drilling recommended (50m grid)."
            estimated_ore_grade = f"{round(36.0 + (confidence_pct - 75.0) * 0.4, 1)}% Mn (High Grade)"
            prospect_depth_m = f"{round(45 + (100 - confidence_pct) * 1.2, 0)}m - {round(120 + (100 - confidence_pct) * 1.8, 0)}m"
        elif confidence_pct >= 55.0:
            category = "INVESTIGATE"
            recommendation = "Secondary exploration: Infill geophysical IP resistivity & magnetic survey."
            estimated_ore_grade = f"{round(28.0 + (confidence_pct - 55.0) * 0.4, 1)}% Mn (Medium Grade)"
            prospect_depth_m = f"{round(60 + (100 - confidence_pct) * 1.5, 0)}m - {round(160 + (100 - confidence_pct) * 2.0, 0)}m"
        else:
            category = "MONITOR"
            recommendation = "Satellite change detection monitoring & surface baseline mapping."
            estimated_ore_grade = f"{round(20.0 + confidence_pct * 0.15, 1)}% Mn (Low/Siliceous Grade)"
            prospect_depth_m = "> 150m (Deep / Uncorrelated Horizon)"

        feature_contributions = {
            "SWIR Spectral Anomaly": round(w_swir, 1),
            "Soil Moisture Retention": round(w_moisture, 1),
            "Thermal Signature (LST)": round(w_temp, 1),
            "Vegetation Stress (NDVI)": round(w_ndvi, 1),
            "Historical Borehole Support": round(w_grade, 1),
        }

        return {
            "model": self.model_name,
            "confidence_score": confidence_pct,
            "category": category,
            "recommendation": recommendation,
            "estimated_ore_grade": estimated_ore_grade,
            "prospect_depth_m": prospect_depth_m,
            "feature_contributions": feature_contributions,
            "requires_drilling_validation": True,
        }

reserve_model = ReserveHotspotModel()
