"""
Production shortfall projection — bounded additive drag model.

Deterministic arithmetic over rainfall, equipment downtime and blasting
readiness. There is no Prophet or XGBoost model here and neither library is a
dependency of this project; the module was previously named as though there
were. Naming now matches what the code actually does.
"""
from typing import Dict, Any, List
import math
from datetime import datetime, timedelta

class ProductionForecastingModel:
    def __init__(self):
        self.model_name = "nakshatra-drag-model-v1"

    def forecast_production(
        self,
        planned_monthly_tonnes: float,
        current_daily_rate: float,
        rainfall_14d_mm: float,
        downtime_hours_weekly: float,
        blasting_ready: bool,
        days_horizon: int = 14,
    ) -> Dict[str, Any]:
        daily_target = planned_monthly_tonnes / 30.0

        # Disruption factor calculation (0.0 to 0.6)
        weather_drag = min(0.35, (rainfall_14d_mm / 150.0) * 0.35) if rainfall_14d_mm > 60 else 0.02
        downtime_drag = min(0.30, (downtime_hours_weekly / 40.0) * 0.30)
        blasting_drag = 0.0 if blasting_ready else 0.15

        total_drag = min(0.55, weather_drag + downtime_drag + blasting_drag)
        effective_efficiency = max(0.45, 1.0 - total_drag)

        base_date = datetime.now()
        trajectory: List[Dict[str, Any]] = []

        total_predicted = 0.0
        total_planned = 0.0

        for i in range(1, days_horizon + 1):
            day_dt = base_date + timedelta(days=i)
            # Add day-of-week & dynamic noise variation
            noise = math.sin(i * 0.6) * 0.04
            daily_eff = max(0.40, min(1.10, effective_efficiency + noise))

            day_predicted = round(daily_target * daily_eff, 0)
            day_planned = round(daily_target, 0)

            total_predicted += day_predicted
            total_planned += day_planned

            trajectory.append({
                "day_index": i,
                "date": day_dt.strftime("%b %d"),
                "planned_tonnes": day_planned,
                "predicted_tonnes": day_predicted,
                "shortfall_tonnes": max(0.0, day_planned - day_predicted),
                "efficiency_pct": round(daily_eff * 100, 1),
            })

        projected_shortfall = max(0.0, total_planned - total_predicted)
        shortfall_pct = round((projected_shortfall / total_planned) * 100, 1) if total_planned > 0 else 0.0

        risk_level = "CRITICAL" if shortfall_pct >= 20.0 else "MODERATE" if shortfall_pct >= 10.0 else "NOMINAL"

        return {
            "model": self.model_name,
            "horizon_days": days_horizon,
            "total_planned_tonnes": round(total_planned, 0),
            "total_predicted_tonnes": round(total_predicted, 0),
            "projected_shortfall_tonnes": round(projected_shortfall, 0),
            "shortfall_percentage": shortfall_pct,
            "risk_level": risk_level,
            "drag_factors": {
                "weather_drag_pct": round(weather_drag * 100, 1),
                "equipment_downtime_drag_pct": round(downtime_drag * 100, 1),
                "blasting_delay_drag_pct": round(blasting_drag * 100, 1),
            },
            "trajectory": trajectory,
        }

forecasting_model = ProductionForecastingModel()
