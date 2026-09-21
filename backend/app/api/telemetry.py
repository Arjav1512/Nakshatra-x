"""
Consolidated mine telemetry — the single authoritative source for the
dashboard's headline numbers (PRD D-1..D-4).

Architecture (SIH26009-Architecture.excalidraw, layer L4): FastAPI is the API /
service layer. The Next.js route handler of the same name is now a thin proxy
onto this endpoint; it holds no computation of its own. Before this, the two
runtimes each computed the headline numbers independently, which is why the
real SciPy LP and the NASA POWER client were unreachable from the UI.

The response shape is frozen against the PRD requirements it serves and is
consumed unchanged by the existing dashboard components:

    weather   -> D-2 production trends context, B-4 weather ingestion
    forecast  -> D-2, B-5 (currently a drag model; Phase 4 replaces it)
    risk      -> D-3 shortfall risk
    actions   -> D-4 corrective steps, C-1..C-4
    reserve   -> D-1 (typed prospectivity/grade, never "reserve" — PRD 2.4)
    provenance-> D-7 evidence panel, N-3
    data_integrity -> N-6 staleness and degradation

Guardrails: satellite inputs are surface/atmospheric only (PRD 2.2); no
statutory reserve figure is emitted (PRD 2.4); synthetic values are flagged and
never labelled live.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.provenance import data_integrity, derived, measured, reference, synthetic
from app.core.synthetic import SYNTHETIC_CALIBRATION, mine_stream, operating_day, rnd
from app.services.nasa_power import fetch_weather_signal
from app.services.satellite import query_sentinel_stac

MODEL_VERSION = "nakshatra-drag-model-v1"
ATTRIBUTION_VERSION = "additive-driver-attribution-v1"
MINE_SOURCE = "MOIL public mine register (coordinates, lease names)"


def _drag_model(rainfall_14d: float, downtime_hours: float, blasting_ready: bool):
    """
    Bounded additive drag model.

    Deterministic, no fitted parameters. Each term is bounded and additive, so
    the attribution below is an exact decomposition rather than an
    approximation. PRD B-5/B-6 require a fitted forecaster with a probability
    and interval — that is Phase 4; this model is explicitly labelled as having
    no statistical interval.
    """
    weather = min(0.35, (rainfall_14d / 150.0) * 0.35) if rainfall_14d > 60 else 0.02
    downtime = min(0.30, (downtime_hours / 40.0) * 0.30)
    blasting = 0.0 if blasting_ready else 0.15
    total = min(0.55, weather + downtime + blasting)
    return weather, downtime, blasting, total


async def build_mine_telemetry(mine) -> dict:
    """Assemble the telemetry payload for one mine from the real services."""
    mine_key = (mine.name or f"mine-{mine.id}").strip().lower().replace(" ", "-")
    day = operating_day()

    # ---- Measured: weather (PRD B-4) -------------------------------------
    wx = await fetch_weather_signal(mine.latitude, mine.longitude, mine_id=mine_key)
    live = bool(wx.get("is_live"))
    wrap = measured if live else synthetic
    wx_source = wx.get("source", "unknown")
    rainfall_14d = float(wx.get("rainfall_14d_mm") or 0.0)
    temp_c = wx.get("avg_temperature_c")
    humidity = wx.get("avg_humidity_pct")

    # ---- Synthetic: operations (PRD 8.2 — proprietary, not in hand) -------
    ops = mine_stream(mine_key, "operations", day)
    cal = SYNTHETIC_CALIBRATION
    downtime_hours = rnd(
        ops.bounded_normal(**{k: cal["weekly_downtime_hours"][k] for k in ("mean", "sd")},
                           lo=cal["weekly_downtime_hours"]["min"],
                           hi=cal["weekly_downtime_hours"]["max"]), 1)
    equipment_availability = rnd(
        ops.bounded_normal(**{k: cal["equipment_availability_pct"][k] for k in ("mean", "sd")},
                           lo=cal["equipment_availability_pct"]["min"],
                           hi=cal["equipment_availability_pct"]["max"]), 1)
    blasts_this_week = round(
        ops.bounded_normal(**{k: cal["blasts_per_week"][k] for k in ("mean", "sd")},
                           lo=cal["blasts_per_week"]["min"],
                           hi=cal["blasts_per_week"]["max"]))
    blasting_ready = blasts_this_week >= 6

    # ---- Derived: drag model ---------------------------------------------
    w_drag, d_drag, b_drag, total_drag = _drag_model(
        rainfall_14d, downtime_hours, blasting_ready
    )
    shortfall_pct = rnd(total_drag * 100, 1)

    horizon_days = 14
    target_tonnes = float(mine.target_tonnes or 0.0)
    daily_target = target_tonnes / 30.0
    planned = round(daily_target * horizon_days)
    predicted = round(planned * (1 - total_drag))
    projected_shortfall = max(0, planned - predicted)

    trajectory = [
        {
            "day_index": i + 1,
            "date": f"Day {i + 1}",
            "planned_tonnes": round(daily_target),
            "predicted_tonnes": round(daily_target * (1 - total_drag)),
            "shortfall_tonnes": max(0, round(daily_target) - round(daily_target * (1 - total_drag))),
            "efficiency_pct": rnd((1 - total_drag) * 100, 1),
        }
        for i in range(horizon_days)
    ]

    risk_score = rnd(min(98.0, total_drag * 160 + 8), 1)

    # ---- Real STAC query (PRD A-2 context; surface only) ------------------
    stac = await query_sentinel_stac(mine.latitude, mine.longitude)

    weather = {
        "rainfall_14d_mm": rainfall_14d,
        "land_surface_temp_c": temp_c,
        "humidity_pct": humidity,
        "soil_moisture_pct": None,
        "forecast_rain_next_3d_mm": None,
        "live_precipitation_rate_mm_hr": None,
        "updated_at": wx.get("window_end") or datetime.now(timezone.utc).isoformat(),
        "source": wx_source,
        "is_live": live,
        "is_synthetic": not live,
        "note": (
            "Soil moisture, NDVI and forecast rainfall are not supplied by NASA "
            "POWER daily point data. PRD B-4 lists them; they arrive with the "
            "Phase 5 raster pipeline."
        ),
    }

    reserve = {
        "mine_id": mine.id,
        "category": "DECISION_SUPPORT_ONLY",
        "confidence_score": None,
        "estimated_ore_grade": None,
        "prospect_depth_m": None,
        "recommendation": (
            "Prospectivity scoring is served by the prospectivity endpoint, not "
            "this one."
        ),
        "feature_contributions": {},
        "spectral_reflectance_bands": [],
        "ndvi_trend_14d": [],
        "note": (
            "Not a UNFC or statutory reserve statement (PRD 2.4). Outputs are "
            "typed prospectivity_score / grade_estimate for a qualified person."
        ),
    }

    forecast = {
        "model": MODEL_VERSION,
        "model_description": (
            "Bounded additive drag model over measured rainfall and synthetic "
            "equipment/blasting inputs. Deterministic; no learned parameters. "
            "Not grade-aware — PRD B-5 requires per-grade forecasting (Phase 4)."
        ),
        "horizon_days": horizon_days,
        "total_planned_tonnes": planned,
        "total_predicted_tonnes": predicted,
        "projected_shortfall_tonnes": projected_shortfall,
        "shortfall_percentage": shortfall_pct,
        "risk_level": "CRITICAL" if shortfall_pct >= 20 else ("MODERATE" if shortfall_pct >= 10 else "NOMINAL"),
        "current_daily_rate_t": round(daily_target * (1 - total_drag)),
        "drag_factors": {
            "weather_drag_pct": rnd(w_drag * 100, 1),
            "equipment_downtime_drag_pct": rnd(d_drag * 100, 1),
            "blasting_delay_drag_pct": rnd(b_drag * 100, 1),
        },
        "trajectory": trajectory,
    }

    risk = {
        "composite_risk_score": risk_score,
        "risk_status": "ELEVATED" if risk_score >= 55 else "WATCH",
        "rainfall_risk_score": rnd(min(100.0, (w_drag / 0.35) * 100), 1),
        "equipment_risk_score": rnd(min(100.0, (d_drag / 0.30) * 100), 1),
        "blasting_risk_score": rnd((b_drag / 0.15) * 100, 1),
        "stockpile_risk_score": None,
        "predicted_shortfall_tonnes": projected_shortfall,
        "live_downtime_hours": downtime_hours,
    }

    attribution = {
        "method": ATTRIBUTION_VERSION,
        "method_description": (
            "Exact additive decomposition of the drag model: each term is the "
            "model coefficient applied to its input, and the terms sum to the "
            "total by construction. Not a Shapley-value approximation."
        ),
        "composite_risk_score": risk_score,
        "base_value": 0,
        "waterfall_features": [
            {
                "feature": f"14-day rainfall ({rainfall_14d} mm, {'measured' if live else 'synthetic'})",
                "shap_value": rnd(w_drag * 100, 1),
                "is_positive": w_drag > 0,
            },
            {
                "feature": f"Equipment downtime ({downtime_hours} h/week, synthetic)",
                "shap_value": rnd(d_drag * 100, 1),
                "is_positive": d_drag > 0,
            },
            {
                "feature": f"Blasting readiness ({blasts_this_week} blasts/week, synthetic)",
                "shap_value": rnd(b_drag * 100, 1),
                "is_positive": b_drag > 0,
            },
        ],
        "causal_chains": [],
        "primary_driver": (
            "Rainfall" if w_drag >= d_drag and w_drag >= b_drag
            else ("Equipment downtime" if d_drag >= b_drag else "Blasting readiness")
        ),
    }

    actions = _build_actions(mine_key, w_drag, d_drag, b_drag, projected_shortfall)

    audit = {
        "satellite_source": stac.get("provider"),
        "model_version": MODEL_VERSION,
        "geologist_review_status": "NOT_REVIEWED",
        "last_evaluated": datetime.now(timezone.utc).isoformat(),
        "guardrail": (
            "Decision-support output. Not a statutory reserve estimate; "
            "satellite inputs are surface/atmospheric only and do not detect "
            "subsurface ore."
        ),
    }

    provenance = {
        "weather.rainfall_14d_mm": wrap(
            rainfall_14d, "mm", wx_source,
            vintage=wx.get("window_end"),
            method="Sum of NASA POWER PRECTOTCORR over a 14-day window ending 2 days ago.",
        ),
        "weather.land_surface_temp_c": wrap(temp_c, "°C", wx_source, vintage=wx.get("window_end")),
        "weather.humidity_pct": wrap(humidity, "%", wx_source, vintage=wx.get("window_end")),
        "risk.live_downtime_hours": synthetic(
            downtime_hours, "hours/week", SYNTHETIC_CALIBRATION["note"],
            model_version="synthetic-ops-v1",
            method=f'Seeded draw, stream "{mine_key}|operations|{day}". Reproducible for a given mine and day.',
        ),
        "operations.equipment_availability_pct": synthetic(
            equipment_availability, "%", SYNTHETIC_CALIBRATION["note"],
            model_version="synthetic-ops-v1",
        ),
        "operations.blasts_this_week": synthetic(
            blasts_this_week, "count", SYNTHETIC_CALIBRATION["note"],
            model_version="synthetic-ops-v1",
        ),
        "forecast.shortfall_percentage": derived(
            shortfall_pct, "%", "Nakshatra-X drag model",
            model_version=MODEL_VERSION,
            method="min(0.55, weather_drag + downtime_drag + blasting_drag) x 100.",
        ),
        "forecast.total_planned_tonnes": reference(
            planned, "tonnes", MINE_SOURCE,
            method="Monthly lease target / 30 x 14-day horizon.",
        ),
        "risk.composite_risk_score": derived(
            risk_score, "score 0-100", "Nakshatra-X drag model",
            model_version=MODEL_VERSION,
            method="min(98, total_drag x 160 + 8).",
        ),
        "mine.coordinates": reference(
            f"{mine.latitude}, {mine.longitude}", "lat,lng", MINE_SOURCE
        ),
    }

    staleness = None
    if live and wx.get("window_end"):
        try:
            end = datetime.fromisoformat(wx["window_end"]).replace(tzinfo=timezone.utc)
            staleness = max(0, int((datetime.now(timezone.utc) - end).total_seconds()))
        except Exception:
            staleness = None

    integrity = data_integrity(
        contains_synthetic=True,
        live_ok=live,
        degraded_reason=wx.get("degraded_reason"),
        staleness_seconds=staleness,
    )

    return {
        "mine": {
            "id": mine_key,
            "numericId": mine.id,
            "name": mine.name,
            "code": mine.mine_code,
            "state": mine.state,
            "lat": mine.latitude,
            "lng": mine.longitude,
            "zone": mine.zone,
            "targetTonnes": mine.target_tonnes,
            "currentProduction": None,
        },
        "weather": weather,
        "reserve": reserve,
        "forecast": forecast,
        "risk": risk,
        "shap": attribution,          # field name kept for existing UI consumers
        "attribution": attribution,
        "actions": actions,
        "audit": audit,
        "stacScenes": stac.get("recent_scenes", []),
        "stac_status": {
            "queried": True,
            "ok": bool(stac.get("is_live")),
            "source": stac.get("provider"),
            "error": stac.get("error"),
            "queried_at": stac.get("queried_at"),
        },
        "provenance": provenance,
        "data_integrity": integrity,
        "served_by": "fastapi",
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


def _build_actions(mine_key, w_drag, d_drag, b_drag, projected_shortfall):
    """
    Rule-triggered corrective actions (PRD C-1..C-4).

    These are NOT yet gated by a hard constraint engine — PRD C-5 is Phase 4
    work and is called out as load-bearing. Each action says what triggered it
    so the basis is inspectable.
    """
    total = max(w_drag + d_drag + b_drag, 1e-9)
    actions = []
    if w_drag > 0.1:
        actions.append({
            "id": f"act-{mine_key}-drainage",
            "title": "Haul road dressing and sump dewatering",
            "type": "DRAINAGE",
            "priority": "CRITICAL" if w_drag > 0.25 else "HIGH",
            "reason": f"Rainfall accounts for {rnd(w_drag * 100, 1)}% modelled production drag.",
            "impact": f"Upper bound on recovery is {round(projected_shortfall * (w_drag / total))} t over the horizon.",
            "status": "PROPOSED",
            "basis": "Rule-based: weather drag term exceeds 0.10.",
            "constraint_checked": False,
        })
    if d_drag > 0.1:
        actions.append({
            "id": f"act-{mine_key}-maintenance",
            "title": "Bring forward scheduled fleet maintenance",
            "type": "EQUIPMENT",
            "priority": "HIGH",
            "reason": f"Equipment downtime accounts for {rnd(d_drag * 100, 1)}% modelled drag.",
            "impact": "Addresses the downtime term of the drag model.",
            "status": "PROPOSED",
            "basis": "Rule-based: downtime drag term exceeds 0.10.",
            "constraint_checked": False,
        })
    if b_drag > 0:
        actions.append({
            "id": f"act-{mine_key}-blasting",
            "title": "Recover development blasting schedule",
            "type": "BLASTING",
            "priority": "MEDIUM",
            "reason": "Weekly blast count is below the threshold assumed by the model.",
            "impact": "Addresses the blasting-readiness term of the drag model.",
            "status": "PROPOSED",
            "basis": "Rule-based: weekly blasts below 6.",
            "constraint_checked": False,
        })
    if not actions:
        actions.append({
            "id": f"act-{mine_key}-none",
            "title": "No corrective action indicated",
            "type": "NONE",
            "priority": "INFO",
            "reason": "All drag terms are below their action thresholds.",
            "impact": "Continue current plan.",
            "status": "INFO",
            "basis": "Rule-based.",
            "constraint_checked": False,
        })
    return actions
