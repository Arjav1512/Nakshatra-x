from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from sqlalchemy.orm import Session
from app.db.session import get_db, resolve_mine_code
from app.models.mine import MineSite
from app.schemas.mine import MineCreate, MineResponse
from app.services.nasa_power import fetch_weather_signal
from app.services.satellite import query_sentinel_stac
from app.api.track_b import NoBacktest, backtest_mine, forecast_mine, forecast_status, recommend_actions, warm_forecast
from app.api.forecast_store import Warming
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.ml.map_layers import tile_layers
from app.ml.tile_cache import cache_status, read_tile
from app.ml.prospectivity import (
    measured_points,
    model_metrics,
    predict_point,
    rank_drill_targets,
    scored_grid,
)
from app.api.response_provenance import header
from app.api.telemetry import MINE_SOURCE, build_mine_telemetry
import csv
import io

router = APIRouter(prefix="/api/v1")


def _mine_code_or_404(mine_id: int) -> tuple[str, str]:
    """
    Resolve mine_id -> (code, name) and release the DB connection immediately.

    These three routes used `Depends(get_db)`, which holds a session for the
    whole request. On /forecast that meant holding a connection across a ~42 s
    model fit that never touched the database — ten concurrent forecasts held
    ten idle connections and /mines could not get one.
    """
    resolved = resolve_mine_code(mine_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail="Mine not found")
    return resolved


def _warming_response(exc: Warming) -> JSONResponse:
    """
    503 that says what is happening and when to come back.

    A bare 503 is indistinguishable from a broken service — that ambiguity is
    what FEATURE_BACKLOG B-2 recorded, and what made the console report failure
    while it was merely cold.
    """
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": str(max(1, int(exc.eta_seconds)))},
        content={
            "status": "warming",
            "mine_code": exc.mine_code,
            "eta_seconds": round(exc.eta_seconds, 1),
            "queued_ahead": exc.queued,
            "detail": (
                f"The forecast for {exc.mine_code} is being computed. This is a "
                f"cold start, not a failure — retry in about "
                f"{exc.eta_seconds:.0f}s, or poll /api/v1/readyz."
            ),
        },
    )


def _track_a_header(result: dict) -> dict:
    """The provenance of a Track A score: the same model the grid serves."""
    return header(
        "Ordinary kriging over a gradient-boosting model of measured Sentinel-2 "
        "L2A band ratios and SRTM terrain",
        "derived", model_version=result.get("model_version"),
    )


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
    # Every model named here is read from the constant that model stamps on its
    # own output, and every source is one the code calls — nothing is typed in.
    # This list used to name a "random-forest-prospectivity-v1
    # (RandomForestClassifier)" that does not exist, leave out the forecaster
    # that does, and list USGS Landsat-8, which nothing reads
    # (test_route_table.py::test_health_names_only_what_runs).
    from app.api.telemetry import ATTRIBUTION_VERSION, MODEL_VERSION as CONDITIONS_MODEL
    from app.ml.forecaster import MODEL_VERSION as FORECASTER
    from app.ml.prospectivity import MODEL_VERSION as PROSPECTIVITY

    return {
        "status": "ok",
        "service": "NAKSHATRA-X MOIL Space Intelligence Engine",
        "competition": "Smart India Hackathon 2026",
        "problem_id": "26009",
        "organization": "MOIL Ltd. / Ministry of Steel",
        "models_active": [
            f"{PROSPECTIVITY} (Track A prospectivity: gradient boosting, validated leave-one-mine-out)",
            f"{FORECASTER} (Track B forecaster: gradient-boosted quantile regression, conformalised)",
            f"{CONDITIONS_MODEL} (mine-conditions trajectory: deterministic additive drag model)",
            f"{ATTRIBUTION_VERSION} (exact linear decomposition of the drivers)",
            "ore blend optimiser (SciPy linprog, HiGHS)",
        ],
        "telemetry_sources": [
            "NASA POWER daily meteorology",
            "Open-Meteo forecast weather",
            "Earth Search STAC (Sentinel-2 L2A scene metadata)",
            "Microsoft Planetary Computer (Sentinel-2 L2A, Copernicus DEM)",
        ],
    }

@router.get("/healthz")
def healthz():
    """Liveness only: the process is up and serving. Never touches the DB."""
    return {"status": "ok"}


@router.get("/readyz")
def readyz():
    """
    Readiness: can this process serve a forecast for every mine right now?

    Liveness and readiness are separate on purpose. The process answers /healthz
    within milliseconds of starting, long before any artifact exists; a load
    balancer that used liveness as readiness would send traffic to a backend
    that can only reply "warming".
    """
    codes = [m["mine_code"] for m in DEFAULT_MINES]
    st = forecast_status(codes)

    # Per-mine readiness is not enough. Ten forecasts can each be individually
    # fresh and still have been generated from a different dataset than the
    # backtest sitting next to them on screen — same code, different seed or a
    # different end date, and every number looks plausible. Agreement across
    # artifact kinds is checked here, and disagreement is not ready.
    from app.api.batch import dataset_consistency

    consistency = dataset_consistency()
    st["dataset_consistency"] = consistency
    if not consistency["consistent"]:
        st["ready"] = False
        stale = {r["path"] for r in consistency["artifacts"] if not r["consistent"]}
        for m in st["mines"]:
            if f"{m['mine_code']}_14d.json" in stale and m["status"] == "ready":
                m["status"] = "stale"
                m["fresh"] = False
                st["mines_ready"] -= 1

    return JSONResponse(status_code=200 if st["ready"] else 503, content=st)


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
            "provenance": header(MINE_SOURCE, "reference"),
        }
        for mine in mines
    ]

@router.get("/mines/{mine_id}/environment")
async def mine_environment(mine_id: int, db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")
    signal = await fetch_weather_signal(mine.latitude, mine.longitude)
    # Measured when NASA POWER answered, the labelled synthetic fallback when
    # it did not — the same split telemetry uses for these three numbers.
    live = bool(signal.get("is_live"))
    return {
        **signal,
        "provenance": header(
            signal.get("source") or "weather signal (source not reported)", "measured" if live else "synthetic",
            vintage=signal.get("window_end"),
        ),
    }

@router.get("/mines/{mine_id}/telemetry")
async def mine_telemetry(mine_id: int, db: Session = Depends(get_db)):
    """
    Consolidated dashboard telemetry (PRD D-1..D-4).

    This is the authoritative source for the dashboard's headline numbers. The
    Next.js route of the same path proxies here and holds no computation.
    """
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")
    return await build_mine_telemetry(mine)


@router.get("/mines/{mine_id}/forecast")
def track_b_forecast(mine_id: int, horizon_days: int = Query(14, ge=1, le=60),
                     grade: str | None = None):
    """
    Per-mine per-grade forecast with intervals and P(cumulative < target).
    PRD B-5, B-6.

    Serves a persisted artifact. It never fits a model — see
    app/api/forecast_store.py for why.
    """
    mine_code, _ = _mine_code_or_404(mine_id)
    try:
        return forecast_mine(mine_code, horizon_days=horizon_days, grade=grade)
    except Warming as exc:
        return _warming_response(exc)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/mines/{mine_id}/backtest")
def track_b_backtest(mine_id: int, span_days: int = Query(150, ge=60, le=400),
                     step_days: int = Query(14, ge=7, le=60),
                     compute: bool = Query(False)):
    """
    Rolling-origin backtest: MAPE and interval coverage vs baseline.
    PRD B-10, N-8.

    Served from the precomputed artifact so the request meets N-1
    ("< 2 s p95 on cached results"). A full run takes minutes and belongs in the
    nightly batch (N-2): `python -m app.api.batch backtest`. Pass
    `?compute=true` to force an on-demand re-run, which N-2 also calls for.
    """
    mine_code, _ = _mine_code_or_404(mine_id)
    try:
        result = backtest_mine(mine_code, span_days=span_days,
                               step_days=step_days, allow_compute=compute)
        return {
            **result,
            "provenance": header(
                "Rolling-origin backtest on the seeded synthetic dataset: the model "
                "is refit before every origin and scored only on days it did not "
                "see. Metrics describe the model on this dataset, not MOIL's "
                "operations (PRD 8.2).",
                "synthetic", model_version=result.get("model_version"),
                vintage=result.get("computed_at"),
            ),
        }
    except NoBacktest as exc:
        # Not an error: only the pilot mine's backtest is committed, because a
        # full run is 216 s and belongs in the batch. The response names the
        # mines that do have one, and their ids, so the console can offer the
        # pilot rather than render a failure.
        # 404, not 503.
        #
        # 503 says "try again later"; this will never become available on a
        # retry, because nothing computes a backtest on request. The artifact
        # simply does not exist for this mine, which is what 404 means. It also
        # keeps a designed state out of the 5xx class that the browser
        # regression suite watches — a scope decision should not read as a
        # server fault to a monitor either.
        by_code = {m["mine_code"]: i + 1 for i, m in enumerate(DEFAULT_MINES)}
        return JSONResponse(
            status_code=404,
            content={
                "status": "no_backtest",
                "mine_code": exc.mine_code,
                "pilots": [
                    {"mine_code": c, "mine_id": by_code.get(c), "name": next(
                        (m["name"] for m in DEFAULT_MINES if m["mine_code"] == c), c)}
                    for c in exc.pilots
                ],
                "detail": str(exc),
                "note": (
                    "The rolling-origin backtest refits the model at every origin "
                    "(216 s per mine) and is precomputed by the batch job, not on "
                    "request. Only the pilot mine's artifact is committed."
                ),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/mines/{mine_id}/recommendations")
def track_b_recommendations(mine_id: int, horizon_days: int = Query(14, ge=1, le=60)):
    """Constraint-gated corrective actions. PRD C-1..C-5."""
    mine_code, _ = _mine_code_or_404(mine_id)
    try:
        result = recommend_actions(mine_code, horizon_days=horizon_days)
        from app.ml.forecaster import MODEL_VERSION as FORECASTER

        return {
            **result,
            "provenance": header(
                "Corrective actions generated from the Track B forecast of synthetic "
                "operational data and checked by the constraint engine; each "
                "expected effect is computed from that forecast.",
                "synthetic", model_version=FORECASTER,
            ),
        }
    except Warming as exc:
        return _warming_response(exc)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/prospectivity/predict")
def prospectivity_predict(lat: float = Query(..., ge=-90, le=90),
                          lng: float = Query(..., ge=-180, le=180),
                          live: bool = Query(True)):
    """Track A point prediction with uncertainty and evidence. PRD A-3, A-4, A-7."""
    try:
        result = predict_point(lat, lng, fetch_live=live)
        return {**result, "provenance": _track_a_header(result)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/prospectivity/drill-targets")
def prospectivity_targets(top_n: int = Query(10, ge=1, le=50)):
    """Ranked drill targets with the evidence behind each. PRD A-5."""
    try:
        result = rank_drill_targets(top_n=top_n)
        return {**result, "provenance": _track_a_header(result)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class ScenarioCheckRequest(BaseModel):
    """The controls a planner set in the what-if calculator."""

    mine_id: int
    shift_window: str = Field(..., pattern=r"^\d{2}-\d{2}$")
    blasting_delay_hours: int = Field(..., ge=0, le=24)
    redeploy: str
    dry_blast_tolerance_mm: int = Field(..., ge=0, le=100)


@router.post("/scenario/constraint-check")
def scenario_constraint_check(req: ScenarioCheckRequest):
    """
    Run a what-if scenario's controls through the constraint engine (PRD C-1..C-5).

    The calculator is arithmetic over stated assumptions, and arithmetic does
    not know that blasting at 02:00 is inside the statutory rest window. The
    engine already does: its vocabulary is exactly these controls —
    RESCHEDULE_SHIFT (C-1), BLAST_RESCHEDULE (C-2), EQUIPMENT_RELOCATION (C-3) —
    so a scenario that cannot legally be run is reported as such rather than
    quietly costed.

    Constraints are enforced, never learned (PRD guardrail 3).
    """
    from datetime import datetime, timedelta

    from app.ml.constraints import ENGINE_VERSION, ActionType, ConstraintEngine, MineContext, ProposedAction

    mine_code, mine_name = _mine_code_or_404(req.mine_id)
    meta = next((m for m in DEFAULT_MINES if m["mine_code"] == mine_code), None)
    ctx = MineContext(mine_code, "underground", meta["latitude"] if meta else 21.8,
                      meta["longitude"] if meta else 80.0)
    engine = ConstraintEngine({mine_code: ctx})

    # The blast lands at the start of the shift window, delayed by the chosen
    # hours — which is what puts it into or out of the rest window.
    start_hour = int(req.shift_window.split("-")[0])
    today = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    blast_at = today.replace(hour=start_hour) + timedelta(hours=req.blasting_delay_hours)

    actions = [
        ProposedAction(
            id="scenario-shift",
            action_type=ActionType.RESCHEDULE_SHIFT,
            mine_code=mine_code,
            description=f"Haulage shift window {req.shift_window}",
            additional_hours=float(int(req.shift_window.split("-")[1]) - start_hour) % 24,
        ),
        ProposedAction(
            id="scenario-blast",
            action_type=ActionType.BLAST_RESCHEDULE,
            mine_code=mine_code,
            description=f"Blast delayed {req.blasting_delay_hours} h",
            proposed_at=blast_at,
        ),
    ]
    if req.redeploy != "none":
        actions.append(
            ProposedAction(
                id="scenario-redeploy",
                action_type=ActionType.EQUIPMENT_RELOCATION,
                mine_code=mine_code,
                description=f"Redeploy {req.redeploy}",
                equipment_id=req.redeploy,
                equipment_class="shovel" if "shovel" in req.redeploy else "crusher",
                from_mine=mine_code,
                to_mine=mine_code,
                available_hours=12.0,
            )
        )

    results = []
    for a in actions:
        v = engine.check(a)
        results.append({
            "id": a.id,
            "action_type": a.action_type.value,
            "description": a.description,
            **v.to_dict(),
        })

    return {
        "mine_code": mine_code,
        "mine_name": mine_name,
        "feasible": all(r["feasible"] for r in results),
        "checks": results,
        "note": (
            "Constraints are enforced, never learned. A scenario that fails here "
            "cannot be run as configured, whatever the arithmetic says it would yield."
        ),
        "provenance": header(
            "The constraint engine's rules applied to the controls in this request",
            "derived", model_version=ENGINE_VERSION,
        ),
    }


@router.get("/prospectivity/grid")
def prospectivity_grid():
    """
    The honest prospectivity surface over the whole study grid (PRD A-3, A-4).

    Serves the model that is loaded. The map previously read a committed
    `prospectivity.geojson` — 1,326 cells from the superseded model, carrying
    features the honest rebuild dropped — and rendered it under this model's
    name. The response carries `model_version` and `n_cells` so a consumer can
    check rather than trust.
    """
    try:
        return scored_grid()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/prospectivity/measured")
def prospectivity_measured():
    """
    The training observations behind the surface (PRD A-3).

    The map can draw the kriged surface and the points it was kriged from. Only
    one of those is a measurement, and the layer switcher now lets a reader see
    both and tell them apart.
    """
    try:
        return measured_points()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/map/tile-layers")
def map_tile_layers(force: bool = False):
    """
    Raster tile layers from Planetary Computer, with provenance (PRD A-3).

    Always 200: a layer that cannot be produced comes back with
    `status: "unavailable"` and the upstream's reason. A 503 for the whole
    endpoint would lose the distinction between "no imagery at all" and "the DEM
    mosaic is refusing", and the screen needs to be able to say which.

    Each layer also carries what the local tile cache holds for it, so the map
    knows before it asks for a tile whether a fallback exists and what date to
    label it with.
    """
    payload = tile_layers(force=force)
    cache = cache_status()
    for layer in payload["layers"]:
        layer["cache"] = cache.get("layers", {}).get(
            layer["id"], {"available": False, "reason": cache.get("reason", "not cached")}
        )
    return {**payload, "cache": {k: v for k, v in cache.items() if k != "layers"}}


@router.get("/map/cached-tiles/{layer_id}/{z}/{x}/{y}")
def map_cached_tile(layer_id: str, z: int, x: int, y: int):
    """
    One tile from the local cache.

    The map uses this only after the live tiler has failed it, and the layer is
    relabelled "cached" before any of these are drawn — a cached pixel must never
    be presented as a live one. A tile that was never fetched is a 404, not a
    placeholder image.
    """
    hit = read_tile(layer_id, z, x, y)
    if hit is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"no cached tile for {layer_id} z{z}/{x}/{y}. The cache covers the "
                f"study area over its manifest's zoom range; run "
                f"`python -m app.api.batch tiles` to build it."
            ),
        )
    body, ctype = hit
    return Response(
        content=body,
        media_type=ctype,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Tile-Source": "local-cache",
        },
    )


@router.get("/calibration/cumulative")
def calibration_cumulative(mine_code: str | None = None):
    """
    How well the 14-day total is calibrated, for display beside P(shortfall).

    Served from a committed artifact built by
    `measure_cumulative_calibration.py artifact`, stamped with the identity of
    the model it measured. If the model being served is not that model, this
    says the calibration is stale and returns no figures — a coverage number
    measured on one model, shown beside another model's probability, would be
    a claim about something nobody measured.
    """
    import json as _json
    from pathlib import Path as _Path

    from app.api.forecast_store import identity_matches

    path = _Path(__file__).resolve().parents[2] / "artifacts" / "calibration" / "cumulative_coverage.json"
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail="No calibration artifact. Build it with measure_cumulative_calibration.py artifact.",
        )
    data = _json.loads(path.read_text())
    ok, reason = identity_matches(data)
    if not ok:
        return {
            "status": "stale",
            "reason": (
                f"The calibration was measured on a different model ({reason}). "
                "Not shown until it is re-measured."
            ),
            "doc": data.get("doc"),
        }
    mine = data.get("per_mine", {}).get(mine_code) if mine_code else None
    return {
        "status": "ok",
        "quantity": data["quantity"],
        "nominal_coverage": data["nominal_coverage"],
        "nominal_tail_frequency": data["nominal_tail_frequency"],
        # Read, not defaulted: an artifact without it is older than the field,
        # and the page then says "intervals" without claiming a level.
        "ci_level": data.get("ci_level"),
        "model_version": data["model_version"],
        "portfolio": data["portfolio"],
        "mine_code": mine_code,
        "mine": mine,
        "mine_note": (
            None if mine or not mine_code
            else f"No per-mine calibration recorded for {mine_code}."
        ),
        # Daily coverage and MAPE, portfolio-wide and for the requested mine.
        # Absent from artifacts measured before the harness wrote them.
        "daily": (
            {
                "quantity": data["daily"]["quantity"],
                "horizons_days": data["daily"]["horizons_days"],
                "portfolio": data["daily"]["portfolio"],
                "mine": data["daily"]["per_mine"].get(mine_code) if mine_code else None,
            }
            if data.get("daily") else None
        ),
        "window": data["window"],
        "method": data["method"],
        "generated_at": data["generated_at"],
        "artifact_identity": data.get("artifact_identity"),
        "records_sha256": data["records_sha256"],
        "doc": data["doc"],
        "provenance": data["provenance"],
    }


@router.get("/prospectivity/metrics")
def prospectivity_metrics():
    """Leave-one-mine-out validation metrics. PRD A-8, D-7."""
    try:
        result = model_metrics()
        return {
            **result,
            "provenance": header(
                "Leave-one-mine-out validation of the Track A model on measured "
                "Sentinel-2 L2A band ratios and SRTM terrain at the labelled sites: "
                "each deposit is held out in turn and scored by a model that never "
                "saw it.",
                "derived", model_version=result.get("model_version"),
            ),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/mines/{mine_id}/satellite")
async def mine_satellite_imagery(mine_id: int, db: Session = Depends(get_db)):
    ensure_seed_mines(db)
    mine = db.get(MineSite, mine_id)
    if not mine:
        raise HTTPException(status_code=404, detail="Mine not found")
    stac = await query_sentinel_stac(mine.latitude, mine.longitude)
    # Scene metadata exists only when STAC answered; then it is measured. When
    # it did not, the response has no scenes to attribute, and says so.
    if stac.get("is_live"):
        stac = {**stac, "provenance": header(stac.get("provider") or "Earth Search STAC", "measured",
                                              vintage=stac.get("queried_at"))}
    return stac

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
from pydantic import BaseModel, ConfigDict, Field


class StockpileItem(BaseModel):
    """One stockpile the caller wants blended. Every field is required."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., max_length=128)
    available_tonnes: float = Field(..., ge=0)
    mn_grade_pct: float = Field(..., ge=0, le=100)
    p_pct: float = Field(..., ge=0, le=100)
    sio2_pct: float = Field(..., ge=0, le=100)
    cost_per_tonne_inr: float = Field(..., ge=0)


class BlendingRequest(BaseModel):
    """
    What to blend, and to what specification. Every field is required.

    The same fault the borehole request had. This defaulted every field — a
    5,000 t target, 40.5% Mn, and four stockpiles named after real MOIL mines
    ("Balaghat High-Grade SP-1", 46.2% Mn, 3,200 t at Rs 8,200/t …) — so a
    caller who posted `{}` received an optimised blend plan for inventory and
    assays that do not exist. There is no stockpile register in this system;
    the stockpiles are the caller's to state.

    The defaults also hid a mismatch: the Next.js proxy sent `required_tonnes`,
    which this model silently ignored, so whatever tonnage the planner typed,
    the solver planned 5,000 t. Unknown fields are now a 422 rather than
    ignored, so a renamed field cannot fall back to an invented value again.
    """

    model_config = ConfigDict(extra="forbid")

    target_tonnes: float = Field(..., gt=0)
    target_mn_min: float = Field(..., ge=0, le=100)
    target_p_max: float = Field(..., ge=0, le=100)
    target_sio2_max: float = Field(..., ge=0, le=100)
    stockpiles: list[StockpileItem] = Field(..., min_length=1)


@router.post("/optimize-blending")
async def optimize_blending_endpoint(req: BlendingRequest):
    result = optimize_ore_blend(
        target_tonnes=req.target_tonnes,
        target_mn_min=req.target_mn_min,
        target_p_max=req.target_p_max,
        target_sio2_max=req.target_sio2_max,
        stockpiles=[s.model_dump() for s in req.stockpiles],
    )
    return {
        **result,
        "provenance": header(
            "SciPy linprog (HiGHS) over the stockpiles in this request. The grades, "
            "tonnages and costs are the caller's inputs; this system holds no "
            "stockpile register.",
            "derived",
        ),
    }

# ============================================================
# REAL CASE 2: CORE DRILL BOREHOLE 3D GEOSTATISTICAL ESTIMATION
# ============================================================

class BoreholeItem(BaseModel):
    """
    A borehole assay interval.

    Every field is required. `fe_pct`, `sio2_pct`, `recovery_pct` and
    `density_t_m3` previously defaulted to 8.0, 6.0, 88.0 and 3.8 — plausible
    manganese values — so a caller who omitted them still received a full grade
    and tonnage analysis. Tonnage is `thickness x area x density x recovery`,
    which meant in-situ tonnes could be computed from two numbers nobody
    measured, and the result was indistinguishable from a real one.

    An assay that was not taken is not an assay. Omitting a field is now a 422.
    """

    hole_id: str
    x: float
    y: float
    depth_from_m: float
    depth_to_m: float
    mn_pct: float
    fe_pct: float
    sio2_pct: float
    recovery_pct: float
    density_t_m3: float

class BoreholeAnalysisRequest(BaseModel):
    """
    `boreholes` is required and must be non-empty.

    This previously defaulted to four fully-specified boreholes
    (BH-BAL-101..104, Mn 38.6-46.0%). Calling the endpoint with an empty body
    therefore returned a complete in-situ tonnage and grade-band analysis for
    assays that do not exist, attributed to mine 1. Defaults that are also
    measurements are fabrications with a schema around them.
    """

    mine_id: int
    boreholes: list[BoreholeItem] = Field(..., min_length=1)

@router.post("/analyze-borehole-drill")
async def analyze_borehole_drill_endpoint(req: BoreholeAnalysisRequest):
    boreholes_dicts = [b.model_dump() for b in req.boreholes]
    result = compute_borehole_spatial_model(boreholes_dicts)
    result["mine_id"] = req.mine_id
    result["provenance"] = header(
        "Geostatistical estimate from the borehole assays in this request (the "
        "caller's inputs; no assay is supplied by this system).",
        "derived",
    )
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
