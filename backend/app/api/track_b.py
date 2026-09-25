"""
Track B endpoints — forecast, shortfall probability, constraint-gated actions
and the backtest report (PRD B-5, B-6, B-7, B-10, C-1..C-5, N-8).

The dataset and fitted models are built once and cached per process: fitting is
seconds and the backtest is minutes, so neither belongs on a request path. PRD
N-2 anticipates this ("nightly batch; on-demand re-run available") — the cache
stands in for the batch until a scheduler exists, and `refresh` forces a re-run.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from datetime import date, datetime, timedelta, timezone

from app.core.provenance import data_integrity, derived, reference, synthetic
from app.ingestion.generator import MINES, generate_all
from app.ml.backtest import rolling_origin_backtest
from app.ml.constraints import (
    ActionType,
    ConstraintEngine,
    MineContext,
    ProposedAction,
)
from app.ml.forecaster import (
    BASELINE_VERSION,
    MODEL_VERSION,
    NOMINAL_COVERAGE,
    ProductionForecaster,
    build_covariates,
    build_series,
    seasonal_naive,
    shortfall_probability,
)

_LOCK = threading.Lock()
_STATE: dict = {}

SYNTHETIC_NOTE = (
    "Trained on synthetic operational data generated to the published ingestion "
    "contract (docs/INGESTION_CONTRACT.md). MOIL's real production, equipment and "
    "blasting records are proprietary (PRD 8.2). Metrics describe the model's "
    "behaviour on this dataset, not MOIL's operations."
)


def _state() -> dict:
    with _LOCK:
        if "series" not in _STATE:
            d = generate_all()
            _STATE["dataset"] = d
            _STATE["series"] = build_series(d["production_by_mine_grade_period"])
            _STATE["cov"] = build_covariates(
                d["rainfall_mm_by_day"], d["equipment_event"], d["blast_record"]
            )
            _STATE["opencast"] = {m.code: (m.mine_type.value == "opencast") for m in MINES}
            _STATE["mines"] = {
                m.code: MineContext(m.code, m.mine_type.value, m.latitude, m.longitude)
                for m in MINES
            }
            _STATE["plan"] = d["plan_target"]
            _STATE["end"] = date.fromisoformat(d["window"]["end"])
            _STATE["forecasters"] = {}
            _STATE["backtests"] = {}
        return _STATE


def _forecaster(mine_code: str, origin: date) -> ProductionForecaster:
    st = _state()
    key = (mine_code, origin.isoformat())
    if key not in st["forecasters"]:
        st["forecasters"][key] = ProductionForecaster().fit(
            st["series"], st["cov"], train_end=origin, opencast=st["opencast"]
        )
    return st["forecasters"][key]


def _plan_target(mine_code: str, grade: str, start: date, end: date) -> float:
    """Sum plan targets overlapping the window, pro-rated by day."""
    st = _state()
    total = 0.0
    for p in st["plan"]:
        if p.mine_code != mine_code:
            continue
        g = p.grade if isinstance(p.grade, str) else (p.grade.value if p.grade else None)
        if g != grade:
            continue
        lo, hi = max(p.period_start, start), min(p.period_end, end)
        if lo > hi:
            continue
        days_in_period = (p.period_end - p.period_start).days + 1
        overlap = (hi - lo).days + 1
        total += float(p.target_tonnes) * overlap / max(days_in_period, 1)
    return total


def compute_forecast(mine_code: str, horizon_days: int = 14, grade: str | None = None) -> dict:
    """
    Fit and forecast. EXPENSIVE — about 42 s per mine, and the first call in a
    process also generates the 58,083-row synthetic dataset.

    This must never be called on a request path. It is invoked only by the
    warmer in forecast_store, which bounds concurrency and guarantees one flight
    per mine. `forecast_mine` below is the read-only server.
    """
    st = _state()
    origin = st["end"]
    fc = _forecaster(mine_code, origin)
    if mine_code not in fc.models:
        raise ValueError(f"No fitted model for {mine_code}")

    horizons = list(range(1, horizon_days + 1))
    window_start = origin + timedelta(days=1)
    window_end = origin + timedelta(days=horizon_days)

    grades = sorted({k[1] for k in st["series"] if k[0] == mine_code})
    if grade:
        grades = [g for g in grades if g == grade]

    per_grade = []
    portfolio_target = 0.0
    portfolio_expected = 0.0
    for g in grades:
        series = st["series"][(mine_code, g)]
        preds = fc.predict(mine_code, g, origin, horizons, series, st["cov"])
        target = _plan_target(mine_code, g, window_start, window_end)
        risk = shortfall_probability(preds, target_tonnes=target)
        baseline_total = sum(
            seasonal_naive(series, origin + timedelta(days=h)) for h in horizons
        )
        portfolio_target += target
        portfolio_expected += risk["expected_cumulative_tonnes"]
        per_grade.append({
            "grade": g,
            "plan_target_tonnes": round(target, 1),
            "shortfall": risk,
            "baseline_cumulative_tonnes": round(baseline_total, 1),
            "trajectory": [
                {
                    "horizon_days": h,
                    "date": (origin + timedelta(days=h)).isoformat(),
                    "p10_tonnes": round(preds[h]["q10"], 1),
                    "median_tonnes": round(preds[h]["q50"], 1),
                    "p90_tonnes": round(preds[h]["q90"], 1),
                    "baseline_tonnes": round(seasonal_naive(series, origin + timedelta(days=h)), 1),
                }
                for h in horizons
            ],
        })

    return {
        "mine_code": mine_code,
        "model_version": MODEL_VERSION,
        "baseline_version": BASELINE_VERSION,
        "forecast_origin": origin.isoformat(),
        "window": {"start": window_start.isoformat(), "end": window_end.isoformat()},
        "horizon_days": horizon_days,
        "interval": {"nominal_coverage": NOMINAL_COVERAGE, "quantiles": [0.1, 0.5, 0.9]},
        "grades": per_grade,
        "portfolio": {
            "plan_target_tonnes": round(portfolio_target, 1),
            "expected_cumulative_tonnes": round(portfolio_expected, 1),
            "expected_shortfall_tonnes": round(max(0.0, portfolio_target - portfolio_expected), 1),
        },
        "provenance": {
            "forecast": synthetic(
                round(portfolio_expected, 1), "tonnes", SYNTHETIC_NOTE,
                model_version=MODEL_VERSION,
                method=(
                    "Per-mine quantile gradient boosting with conformalised prediction "
                    "intervals; grade is a model feature. Features use only "
                    "information available at the forecast origin."
                ),
            ),
            "plan_target": synthetic(
                round(portfolio_target, 1), "tonnes", SYNTHETIC_NOTE,
                model_version="nakshatra-synthetic-v1",
            ),
        },
        "data_integrity": data_integrity(
            contains_synthetic=True, live_ok=True,
            degraded_reason=None, staleness_seconds=None,
        ),
        "guardrail": (
            "Decision support for production planning. Not a statutory reserve "
            "statement, and not a commitment."
        ),
    }


from app.api.forecast_store import (
    Warming,
    artifact_identity,
    eta_seconds,
    identity_matches,
    is_fresh,
    read_artifact,
    status as store_status,
    warm,
)

BACKTEST_CACHE_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "backtests"


def _backtest_cache_path(mine_code: str, span_days: int, step_days: int) -> Path:
    return BACKTEST_CACHE_DIR / f"{mine_code}_{span_days}d_{step_days}step.json"


def compute_backtest(mine_code: str, span_days: int = 150, step_days: int = 14) -> dict:
    """
    Run the rolling-origin backtest and persist it.

    This is the expensive path: the model is refitted at every origin, which
    takes minutes. PRD N-2 anticipates exactly this shape — "nightly batch;
    on-demand re-run available" — so it is a batch job, not a request path.
    Invoke it from `python -m app.api.batch backtest`.
    """
    st = _state()
    end = st["end"]
    res = rolling_origin_backtest(
        st["series"], st["cov"], mine_code,
        test_start=end - timedelta(days=span_days), test_end=end,
        horizons=(1, 3, 7, 14), origin_step_days=step_days,
        opencast=st["opencast"],
    ).to_dict()
    res["note"] = SYNTHETIC_NOTE
    res["computed_at"] = datetime.now(timezone.utc).isoformat()
    res["data_window_end"] = end.isoformat()
    res["served_from"] = "computed"
    # Same identity block as a forecast artifact, for the same reason: this is
    # persisted and committed, and a backtest carrying last month's MAPE under
    # this month's model_version is worse than having no backtest. It previously
    # recorded only `data_window_end`, so a change of seed, model or library
    # left it silently servable.
    res["artifact_identity"] = artifact_identity()

    BACKTEST_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _backtest_cache_path(mine_code, span_days, step_days)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(res, indent=2))
    tmp.replace(path)
    return res


def backtest_mine(mine_code: str, span_days: int = 150, step_days: int = 14,
                  allow_compute: bool = True) -> dict:
    """
    Serve the backtest (PRD B-10, surfaced in the UI per N-8).

    Read order: process memory -> persisted artifact -> compute.

    PRD N-1 is "< 2 s p95 **on cached results**". A full run cannot meet that
    and pretending otherwise would be dishonest, so the result is precomputed
    by the batch job and served from disk; the response carries `served_from`
    and `computed_at` so the UI can state how old it is rather than implying it
    was just calculated.

    `allow_compute=False` makes the endpoint return 503 instead of blocking for
    minutes when no artifact exists — a miss is reported, not hidden behind a
    long spinner.
    """
    st = _state()
    key = (mine_code, span_days, step_days)
    if key in st["backtests"]:
        cached = dict(st["backtests"][key])
        cached["served_from"] = "memory"
        return cached

    path = _backtest_cache_path(mine_code, span_days, step_days)
    if path.exists():
        res = json.loads(path.read_text())
        matches, reason = identity_matches(res)
        if not matches:
            # Refused, not served. A stale backtest is the most quotable number
            # in the product — "MAPE 11.67%, coverage 0.812" goes on the landing
            # page — so serving one produced by other code or another dataset
            # would put a figure nobody can reproduce in front of an audience.
            raise ValueError(
                f"The stored backtest for {mine_code} was produced by a different "
                f"dataset or build ({reason}). Regenerate with "
                f"`python -m app.api.batch all`, or roll back with "
                f"`git checkout -- backend/artifacts` (docs/DEMO.md)."
            )
        res["served_from"] = "artifact"
        age_h = None
        try:
            computed = datetime.fromisoformat(res["computed_at"])
            if computed.tzinfo is None:
                computed = computed.replace(tzinfo=timezone.utc)
            age_h = round((datetime.now(timezone.utc) - computed).total_seconds() / 3600, 1)
        except Exception:
            pass
        res["artifact_age_hours"] = age_h
        # PRD N-6: state staleness rather than letting it pass silently.
        res["staleness_note"] = (
            f"Precomputed {age_h} h ago by the batch job." if age_h is not None
            else "Precomputed; age unknown."
        )
        st["backtests"][key] = res
        return res

    if not allow_compute:
        raise ValueError(
            "No precomputed backtest for this mine. Run "
            "`python -m app.api.batch backtest` (PRD N-2 nightly batch)."
        )
    res = compute_backtest(mine_code, span_days=span_days, step_days=step_days)
    st["backtests"][key] = res
    return res


def recommend_actions(mine_code: str, horizon_days: int = 14) -> dict:
    """
    Corrective actions (PRD C-1..C-3), each carrying its expected effect (C-4)
    and gated by the hard constraint engine (C-5).

    Candidates are generated from the forecast's drivers, then filtered. An
    action that violates a constraint is removed, and the rejection is reported
    separately so the reasoning stays auditable.
    """
    # Forecast first, deliberately. It reads an artifact and raises Warming if
    # the mine is not ready, so an unwarmed mine costs one file stat. _state()
    # below generates the 58,083-row dataset on first call in a process; doing
    # it before the readiness check would pay that cost for a request that is
    # about to 503 anyway.
    fx = forecast_mine(mine_code, horizon_days=horizon_days)
    st = _state()
    engine = ConstraintEngine(st["mines"])
    ctx = st["mines"].get(mine_code)
    origin = st["end"]

    shortfall = fx["portfolio"]["expected_shortfall_tonnes"]
    p_short = max((g["shortfall"]["p_shortfall"] for g in fx["grades"]), default=0.0)

    candidates: list[ProposedAction] = []
    if shortfall > 0:
        # C-2: bring a blast forward into the next legal window.
        blast_at = datetime.combine(origin + timedelta(days=1), datetime.min.time()).replace(
            hour=6 if (ctx and ctx.mine_type == "underground") else 9, minute=30
        )
        candidates.append(ProposedAction(
            id=f"{mine_code}-blast-advance",
            action_type=ActionType.BLAST_RESCHEDULE,
            mine_code=mine_code,
            description="Advance the next development blast into the earliest permitted window.",
            proposed_at=blast_at,
            expected_recovery_tonnes=shortfall * 0.25,
        ))
        # C-1: extend a shift.
        candidates.append(ProposedAction(
            id=f"{mine_code}-shift-extend",
            action_type=ActionType.RESCHEDULE_SHIFT,
            mine_code=mine_code,
            description="Extend the day shift to recover lost face time.",
            additional_hours=4.0,
            expected_recovery_tonnes=shortfall * 0.30,
        ))
        # C-3: relocate a unit from the nearest mine, with a realistic window.
        others = [m for m in st["mines"].values() if m.mine_code != mine_code]
        if others and ctx:
            from app.ml.constraints import haversine_km
            nearest = min(others, key=lambda m: haversine_km(ctx.latitude, ctx.longitude, m.latitude, m.longitude))
            candidates.append(ProposedAction(
                id=f"{mine_code}-relocate",
                action_type=ActionType.EQUIPMENT_RELOCATION,
                mine_code=mine_code,
                description=f"Redeploy a loader from {nearest.mine_code} for the remainder of the horizon.",
                equipment_id="LOADER-STANDBY",
                equipment_class="loader",
                from_mine=nearest.mine_code,
                to_mine=mine_code,
                available_hours=48.0,
                expected_recovery_tonnes=shortfall * 0.20,
            ))

    approved, rejected = engine.gate(candidates)

    # C-4: every surviving action states its expected effect and assumptions.
    for a in approved:
        recovery = a["expected_recovery_tonnes"]
        a["expected_effect"] = {
            "recovery_tonnes": recovery,
            "delta_shortfall_probability": round(
                -min(p_short, p_short * (recovery / shortfall)) if shortfall > 0 else 0.0, 4
            ),
            "assumptions": [
                "Recovery is proportional to the driver's share of the modelled gap.",
                "No compounding with other approved actions is assumed.",
                "Constraint check reflects the operating rules in app/ml/constraints.py, "
                "which are documented assumptions rather than quoted regulation.",
            ],
        }

    return {
        "mine_code": mine_code,
        "forecast_origin": origin.isoformat(),
        "expected_shortfall_tonnes": shortfall,
        "max_grade_shortfall_probability": round(p_short, 4),
        "approved_actions": approved,
        "rejected_actions": rejected,
        "constraint_engine": {
            "version": "nakshatra-constraint-engine-v1",
            "enforced_not_learned": True,
            "scope": ["shift_hours", "blast_window", "blast_separation",
                      "equipment_compatibility", "relocation_feasibility"],
            "excluded": ["ventilation — PRD 4 non-goal 6"],
        },
        "guardrail": (
            "Actions failing a hard constraint are removed, not downgraded "
            "(PRD C-5). Rejections are listed with their reason."
        ),
    }


# ---------------------------------------------------------------------------
# Serving path
# ---------------------------------------------------------------------------

def forecast_mine(mine_code: str, horizon_days: int = 14, grade: str | None = None) -> dict:
    """
    Serve a persisted forecast. Never computes.

    Read order: process memory -> artifact on disk -> raise Warming.

    Raising rather than computing is the point of this change. A request that
    computes is a request that holds a connection for 42 s, cannot be cancelled
    when the client leaves, and duplicates work its neighbour is already doing.
    A request that reports "warming" costs nothing and tells the caller what to
    do next.
    """
    cached = read_artifact(mine_code, horizon_days)
    if cached is not None:
        if grade:
            cached = dict(cached)
            cached["grades"] = [g for g in cached.get("grades", []) if g.get("grade") == grade]
        return cached

    # Not on disk. Make sure exactly one flight is producing it, then report.
    warm(mine_code, horizon_days, compute_forecast)
    eta, queued = eta_seconds(mine_code, horizon_days)
    raise Warming(mine_code, eta, queued)


def warm_forecast(mine_code: str, horizon_days: int = 14):
    """Start (or join) the flight for this mine. Returns its Future."""
    return warm(mine_code, horizon_days, compute_forecast)


def forecast_status(mine_codes: list[str], horizon_days: int = 14) -> dict:
    return store_status(mine_codes, horizon_days)
