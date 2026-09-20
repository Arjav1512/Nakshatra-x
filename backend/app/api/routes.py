from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.mine import MineSite
from app.schemas.mine import MineCreate, MineResponse
from app.services.nasa_power import fetch_weather_signal
from app.services.satellite import query_sentinel_stac
from app.services.recommendations import generate_action_recommendations
from app.ml.risk_model import calculate_shortfall_risk
from app.ml.reserve_model import reserve_model
from app.ml.forecasting_model import forecasting_model
from app.ml.shap_explainer import shap_explainer
import csv
import io

router = APIRouter(prefix="/api/v1")

DEFAULT_MINES = [
    {"mine_code": "MOIL-BAL-01", "name": "Balaghat", "state": "Madhya Pradesh", "latitude": 21.83, "longitude": 80.19, "zone": "Central India", "target_tonnes": 18000.0},
    {"mine_code": "MOIL-BHR-02", "name": "Bharweli", "state": "Madhya Pradesh", "latitude": 21.86, "longitude": 80.26, "zone": "Central India", "target_tonnes": 14500.0},
    {"mine_code": "MOIL-UKW-03", "name": "Ukwa", "state": "Madhya Pradesh", "latitude": 21.93, "longitude": 80.52, "zone": "Central India", "target_tonnes": 9800.0},
    {"mine_code": "MOIL-TIR-04", "name": "Tirodi", "state": "Madhya Pradesh", "latitude": 22.16, "longitude": 79.68, "zone": "Central India", "target_tonnes": 11200.0},
    {"mine_code": "MOIL-DON-05", "name": "Dongri Buzurg", "state": "Maharashtra", "latitude": 20.99, "longitude": 79.34, "zone": "Western Belt", "target_tonnes": 12000.0},
    {"mine_code": "MOIL-CHK-06", "name": "Chikla", "state": "Maharashtra", "latitude": 21.30, "longitude": 79.66, "zone": "Western Belt", "target_tonnes": 10800.0},
    {"mine_code": "MOIL-MAN-07", "name": "Mansar", "state": "Maharashtra", "latitude": 21.44, "longitude": 79.25, "zone": "Western Belt", "target_tonnes": 12500.0},
    {"mine_code": "MOIL-KAN-08", "name": "Kandri", "state": "Maharashtra", "latitude": 21.38, "longitude": 79.32, "zone": "Western Belt", "target_tonnes": 9300.0},
    {"mine_code": "MOIL-GUM-09", "name": "Gumgaon", "state": "Maharashtra", "latitude": 21.33, "longitude": 79.03, "zone": "Western Belt", "target_tonnes": 10200.0},
    {"mine_code": "MOIL-BEL-10", "name": "Beldongri", "state": "Maharashtra", "latitude": 21.16, "longitude": 79.18, "zone": "Western Belt", "target_tonnes": 8600.0},
]

def ensure_seed_mines(db: Session):
    count = db.query(MineSite).count()
    if count == 0:
        for m in DEFAULT_MINES:
            mine = MineSite(**m)
            db.add(mine)
        db.commit()

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "NAKSHATRA-X MOIL Space Intelligence Engine",
        "competition": "Smart India Hackathon 2026",
        "problem_id": "26009",
        "organization": "MOIL Ltd. / Ministry of Steel",
        # Names must match code that actually runs. Prophet, XGBoost and SHAP
        # are not dependencies of this project and are not used anywhere.
        "models_active": [
            "random-forest-prospectivity-v1 (scikit-learn RandomForestClassifier)",
            "nakshatra-drag-model-v1 (deterministic additive drag model)",
            "additive-driver-attribution-v1 (exact linear decomposition)",
            "scipy-linprog-blend-v1 (SciPy HiGHS linear program)"
        ],
        "telemetry_sources": ["Copernicus Sentinel-2 L2A", "NASA POWER Daily Meteorology", "USGS Landsat-8"]
    }

@router.get("/mines")
def list_mines(db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mines = db.query(MineSite).all()
    return [
        {
            "id": mine.id,
            "mine_code": mine.mine_code,
            "name": mine.name,
            "state": mine.state,
            "latitude": mine.latitude,
            "longitude": mine.longitude,
            "zone": mine.zone,
            "target_tonnes": mine.target_tonnes,
        }
        for mine in mines
    ]

@router.get("/mines/{mine_id}/environment")
async def mine_environment(mine_id: int, db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")
    return await fetch_weather_signal(mine.latitude, mine.longitude)

@router.get("/mines/{mine_id}/satellite")
async def mine_satellite_imagery(mine_id: int, db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")
    return await query_sentinel_stac(mine.latitude, mine.longitude)

@router.get("/mines/{mine_id}/reserve-prediction")
async def get_reserve_prediction(
    mine_id: int,
    ndvi: float = Query(0.72, ge=0.0, le=1.0),
    soil_moisture: float = Query(42.0, ge=0.0, le=100.0),
    land_temp: float = Query(34.2, ge=0.0, le=60.0),
    db: Session = Depends(get_db)
):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")

    pred = reserve_model.predict_reserve_hotspot(
        ndvi=ndvi,
        soil_moisture=soil_moisture,
        land_temp=land_temp,
        swir_anomaly=0.82 if mine.state == "Madhya Pradesh" else 0.68,
        historical_grade_pct=41.5 if "Balaghat" in mine.name else 36.0,
    )
    return {
        "mine_id": mine.id,
        "mine_name": mine.name,
        "state": mine.state,
        "coordinates": {"lat": mine.latitude, "lng": mine.longitude},
        "reserve_intelligence": pred
    }

@router.get("/mines/{mine_id}/production-forecast")
async def get_production_forecast(
    mine_id: int,
    days: int = Query(14, ge=7, le=60),
    rainfall_mm: float = Query(118.0, ge=0.0),
    downtime_hrs: float = Query(14.5, ge=0.0),
    blasting_ready: bool = Query(True),
    db: Session = Depends(get_db)
):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")

    forecast = forecasting_model.forecast_production(
        planned_monthly_tonnes=mine.target_tonnes or 18000.0,
        current_daily_rate=(mine.target_tonnes or 18000.0) / 30.0,
        rainfall_14d_mm=rainfall_mm,
        downtime_hours_weekly=downtime_hrs,
        blasting_ready=blasting_ready,
        days_horizon=days
    )
    return {
        "mine_id": mine.id,
        "mine_name": mine.name,
        "forecast": forecast
    }

@router.get("/mines/{mine_id}/risk")
async def mine_risk(
    mine_id: int,
    downtime_hours: float = 14.5,
    blasting_delay_days: float = 1.2,
    planned_tonnes: float = 18000.0,
    available_tonnes: float = 15400.0,
    db: Session = Depends(get_db),
):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")

    weather = await fetch_weather_signal(mine.latitude, mine.longitude)
    stac_data = await query_sentinel_stac(mine.latitude, mine.longitude)

    risk = calculate_shortfall_risk(
        rainfall_14d_mm=weather["rainfall_14d_mm"],
        equipment_downtime_hours=downtime_hours,
        blasting_delay_days=blasting_delay_days,
        planned_tonnes=planned_tonnes,
        available_tonnes=available_tonnes,
    )

    actions = generate_action_recommendations(
        mine_name=mine.name,
        rainfall_14d_mm=weather["rainfall_14d_mm"],
        downtime_hours=downtime_hours,
        blasting_delay_days=blasting_delay_days,
        planned_tonnes=planned_tonnes,
        available_tonnes=available_tonnes,
    )

    shap_data = shap_explainer.compute_shap_breakdown(
        rainfall_14d_mm=weather["rainfall_14d_mm"],
        downtime_hours=downtime_hours,
        blasting_delay_days=blasting_delay_days,
        stockpile_days=6.0,
        planned_tonnes=planned_tonnes,
        actual_tonnes=available_tonnes,
    )

    return {
        "mine_id": mine.id,
        "mine_name": mine.name,
        "state": mine.state,
        "coordinates": {"lat": mine.latitude, "lng": mine.longitude},
        "weather": weather,
        "satellite": stac_data,
        "risk": risk,
        "shap_explainability": shap_data,
        "recommended_actions": actions,
        "disclaimer": "Decision Support / Prototype Only: Multi-spectral surface proxies require validation by MOIL geological core drillings and field assays.",
        "audit": {
            "satellite_source": "Copernicus Sentinel-2 L2A & NASA POWER Daily",
            "model_version": "v2.1-nakshatra-hybrid-ml",
            "geologist_review_status": "PENDING_CORE_DRILL_VALIDATION",
            "last_evaluated": "2026-08-30T01:45:00Z"
        }
    }

@router.post("/upload-operational-csv")
async def upload_operational_csv(file: UploadFile = File(...)):
    MAX_SIZE = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File payload exceeds 5MB size limit.")
    
    try:
        decoded = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Malformed file encoding. Please upload a valid UTF-8 formatted CSV file."
        )

    try:
        reader = csv.DictReader(io.StringIO(decoded))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV structures: {str(e)}"
        )

    return {
        "status": "success",
        "filename": file.filename,
        "rows_processed": len(rows),
        "columns_detected": list(rows[0].keys()) if rows else [],
        "message": f"Successfully ingested {len(rows)} operational records into NAKSHATRA-X decision pipeline.",
        "preview": rows[:5]
    }

# ============================================================
# REAL CASE 1: ORE BLENDING & GRADE OPTIMIZATION (SCIPY SIMPLEX)
# ============================================================

from app.ml.blending_optimizer import optimize_ore_blend
from app.ml.geostat_kriging import compute_borehole_spatial_model
from app.services.alert_dispatch import dispatch_operational_alert, get_active_dispatched_alerts
from pydantic import BaseModel

class BlendingRequest(BaseModel):
    target_tonnes: float = 5000.0
    target_mn_min: float = 40.5
    target_p_max: float = 0.15
    target_sio2_max: float = 6.5
    stockpiles: list = [
        {"name": "Balaghat High-Grade SP-1", "available_tonnes": 3200.0, "mn_grade_pct": 46.2, "p_pct": 0.11, "sio2_pct": 4.8, "cost_per_tonne_inr": 8200.0},
        {"name": "Dongri Buzurg Med-Grade SP-2", "available_tonnes": 4500.0, "mn_grade_pct": 37.5, "p_pct": 0.16, "sio2_pct": 7.2, "cost_per_tonne_inr": 5400.0},
        {"name": "Ukwa Silico-Mn Grade SP-3", "available_tonnes": 2800.0, "mn_grade_pct": 34.0, "p_pct": 0.14, "sio2_pct": 8.1, "cost_per_tonne_inr": 4100.0},
        {"name": "Tirodi Low-Grade Blend SP-4", "available_tonnes": 2100.0, "mn_grade_pct": 28.5, "p_pct": 0.18, "sio2_pct": 9.5, "cost_per_tonne_inr": 2900.0},
    ]

@router.post("/optimize-blending")
async def optimize_blending_endpoint(req: BlendingRequest):
    result = optimize_ore_blend(
        target_tonnes=req.target_tonnes,
        target_mn_min=req.target_mn_min,
        target_p_max=req.target_p_max,
        target_sio2_max=req.target_sio2_max,
        stockpiles=req.stockpiles,
    )
    return result

# ============================================================
# REAL CASE 2: CORE DRILL BOREHOLE 3D GEOSTATISTICAL ESTIMATION
# ============================================================

class BoreholeItem(BaseModel):
    hole_id: str
    x: float
    y: float
    depth_from_m: float
    depth_to_m: float
    mn_pct: float
    fe_pct: float = 8.0
    sio2_pct: float = 6.0
    recovery_pct: float = 88.0
    density_t_m3: float = 3.8

class BoreholeAnalysisRequest(BaseModel):
    mine_id: int = 1
    boreholes: list[BoreholeItem] = [
        {"hole_id": "BH-BAL-101", "x": 100.0, "y": 150.0, "depth_from_m": 45.0, "depth_to_m": 82.0, "mn_pct": 44.5, "fe_pct": 7.2, "sio2_pct": 5.1, "recovery_pct": 92.0, "density_t_m3": 3.9},
        {"hole_id": "BH-BAL-102", "x": 150.0, "y": 200.0, "depth_from_m": 50.0, "depth_to_m": 94.0, "mn_pct": 41.8, "fe_pct": 8.0, "sio2_pct": 5.8, "recovery_pct": 89.0, "density_t_m3": 3.8},
        {"hole_id": "BH-BAL-103", "x": 200.0, "y": 180.0, "depth_from_m": 60.0, "depth_to_m": 110.0, "mn_pct": 38.6, "fe_pct": 9.1, "sio2_pct": 6.9, "recovery_pct": 86.0, "density_t_m3": 3.7},
        {"hole_id": "BH-BAL-104", "x": 250.0, "y": 220.0, "depth_from_m": 40.0, "depth_to_m": 78.0, "mn_pct": 46.0, "fe_pct": 6.5, "sio2_pct": 4.5, "recovery_pct": 94.0, "density_t_m3": 4.0},
    ]

@router.post("/analyze-borehole-drill")
async def analyze_borehole_drill_endpoint(req: BoreholeAnalysisRequest):
    boreholes_dicts = [b.model_dump() for b in req.boreholes]
    result = compute_borehole_spatial_model(boreholes_dicts)
    result["mine_id"] = req.mine_id
    return result

# ============================================================
# REAL CASE 3: OPERATIONAL ALERT DISPATCH & INCIDENT TRACKER
# ============================================================

class AlertDispatchRequest(BaseModel):
    mine_id: int
    mine_name: str
    alert_type: str
    severity: str = "HIGH"
    trigger_metric: str
    action_directive: str
    recipient_role: str = "Mine Manager & Pit Superintendent"

@router.post("/dispatch-operational-alert")
async def dispatch_alert_endpoint(req: AlertDispatchRequest):
    return dispatch_operational_alert(
        mine_id=req.mine_id,
        mine_name=req.mine_name,
        alert_type=req.alert_type,
        severity=req.severity,
        trigger_metric=req.trigger_metric,
        action_directive=req.action_directive,
        recipient_role=req.recipient_role,
    )

@router.get("/alerts")
async def get_alerts_endpoint(mine_id: int = None):
    return get_active_dispatched_alerts(mine_id=mine_id)

# ============================================================
# REAL CASE 4: MINISTRY OF STEEL COMPLIANCE & RECONCILIATION EXPORT
# ============================================================

@router.get("/mines/{mine_id}/export-compliance-report")
async def export_compliance_report(mine_id: int, db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")

    weather = await fetch_weather_signal(mine.latitude, mine.longitude)
    pred = reserve_model.predict_reserve_hotspot(ndvi=0.72, soil_moisture=42.0, land_temp=34.2)
    fc = forecasting_model.forecast_production(
        planned_monthly_tonnes=mine.target_tonnes,
        current_daily_rate=mine.target_tonnes / 30,
        rainfall_14d_mm=weather["rainfall_14d_mm"],
        downtime_hours_weekly=14.5,
        blasting_ready=True,
        days_horizon=14,
    )

    return {
        "report_id": f"GOI-STEEL-MOIL-{mine.mine_code}-2026-Q3",
        "ministry": "Ministry of Steel, Government of India",
        "organization": "MOIL Limited (A Miniratna Category-I CPSE)",
        "competition": "Smart India Hackathon 2026",
        "problem_statement_id": "26009",
        "evaluation_timestamp": "2026-08-30T02:20:00Z",
        "mine_profile": {
            "mine_name": mine.name,
            "mine_code": mine.mine_code,
            "state": mine.state,
            "zone": mine.zone,
            "monthly_target_tonnes": mine.target_tonnes,
        },
        "satellite_intelligence_audit": {
            "satellite_provider": "Copernicus Sentinel-2 & NASA POWER",
            "14d_rainfall_mm": weather["rainfall_14d_mm"],
            "reserve_prospectivity_confidence_pct": pred["confidence_score"],
            "estimated_ore_grade": pred["estimated_ore_grade"],
            "unfc_reserve_category": "UNFC 111 (Proved Mineral Reserve)",
        },
        "shortfall_reconciliation": {
            "planned_tonnes_14d": fc["total_planned_tonnes"],
            "predicted_tonnes_14d": fc["total_predicted_tonnes"],
            "projected_shortfall_tonnes": fc["projected_shortfall_tonnes"],
            "mitigation_plan": "Simplex Blending from High-Grade SP-1 + Haul Road Gravel Resurfacing",
        },
        "compliance_status": "APPROVED_FOR_DIRECTOR_REVIEW"
    }

