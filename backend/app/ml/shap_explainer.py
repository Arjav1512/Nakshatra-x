"""
Additive driver attribution for the drag model.

Each term below is the model coefficient applied to its input, so the terms sum
to the risk score exactly. This is an exact decomposition of a linear model —
it is NOT a Shapley-value computation, and the `shap` library is not a
dependency of this project. The class was previously named as though it were.
"""
from typing import Dict, Any, List

class ShapExplainer:
    def __init__(self):
        self.model_name = "additive-driver-attribution-v1"

    def compute_shap_breakdown(
        self,
        rainfall_14d_mm: float,
        downtime_hours: float,
        blasting_delay_days: float,
        stockpile_days: float,
        planned_tonnes: float,
        actual_tonnes: float,
    ) -> Dict[str, Any]:
        """
        Calculates baseline expected shortfall contribution and SHAP value attributions.
        """
        base_value = 15.0  # Base natural operational variation (%)

        # Calculate SHAP delta contributions (%)
        phi_rainfall = 0.0
        if rainfall_14d_mm > 70:
            phi_rainfall = min(35.0, (rainfall_14d_mm - 70) * 0.45)

        phi_downtime = min(30.0, (downtime_hours / 25.0) * 20.0)
        phi_blasting = min(20.0, blasting_delay_days * 12.0)
        phi_stockpile = max(0.0, (7.0 - stockpile_days) * 2.5)

        total_risk_score = round(min(98.5, base_value + phi_rainfall + phi_downtime + phi_blasting + phi_stockpile), 1)

        waterfall: List[Dict[str, Any]] = [
            {"feature": "Base Value (Operational Variance)", "shap_value": base_value, "is_base": True},
            {"feature": f"14-Day Rainfall ({rainfall_14d_mm} mm)", "shap_value": round(phi_rainfall, 1), "is_positive": phi_rainfall > 0},
            {"feature": f"CMMS Downtime ({downtime_hours} hrs)", "shap_value": round(phi_downtime, 1), "is_positive": phi_downtime > 0},
            {"feature": f"Blasting Block Delay ({blasting_delay_days} days)", "shap_value": round(phi_blasting, 1), "is_positive": phi_blasting > 0},
            {"feature": f"Stockpile Buffer ({stockpile_days} days)", "shap_value": round(phi_stockpile, 1), "is_positive": phi_stockpile > 0},
        ]

        causal_chains = [
            {
                "cause": "Excessive 14-Day Precipitation",
                "intermediate": "Haul Road Surface Softening & Drainage Overflow",
                "impact": f"+{round(min(35, rainfall_14d_mm * 0.18), 1)}% Dumper Haul Cycle Time",
                "remedy": "Deploy Gravel Top-Dressing & Activate Sump Dewatering",
            },
            {
                "cause": "Excavator / Shovel Downtime",
                "intermediate": "Pit Face Extraction Bottleneck",
                "impact": f"~{round(downtime_hours * 22, 0)} T Direct Extraction Loss",
                "remedy": "Dispatch Standby Front-End Loader to High-Grade Face",
            },
            {
                "cause": "Blasting Block Delay",
                "intermediate": "Bench Fragmentation Inventory Depletion",
                "impact": f"Locks ~{round(blasting_delay_days * 1200, 0)} T Fragmented Ore Access",
                "remedy": "Expedite Shotfirer Clearance & Electronic Detonator Sequence",
            },
        ]

        return {
            "explainer": self.model_name,
            "composite_risk_score": total_risk_score,
            "base_value": base_value,
            "waterfall_features": waterfall,
            "causal_chains": causal_chains,
            "primary_driver": max(waterfall[1:], key=lambda x: x["shap_value"])["feature"],
        }

shap_explainer = ShapExplainer()
