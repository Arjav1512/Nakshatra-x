# NAKSHATRA-X

**AI + satellite decision-support for manganese reserve prospectivity and production-shortfall planning.**
Built for **Smart India Hackathon 2026 — Problem Statement SIH26009** (Ministry of Steel / MOIL Limited).

---

## Project status

> **Hackathon prototype.** This is a working demonstrator, not a production system.
> - **Live external data:** weather/climatology (NASA POWER, Open-Meteo) and satellite scene *metadata* (Sentinel-2 STAC) are fetched from real public APIs.
> - **Synthetic data:** MOIL operational data (borehole assays, production, equipment downtime, blasting logs) is **not public**, so it is **synthetic** in this build. Treat every operational number as illustrative.
> - **Not for statutory use:** outputs are prospectivity/decision-support only. They are **not** UNFC-classified reserve figures and must not be used for statutory reporting.
> - **Auth is demo-grade** and must be replaced before any non-local deployment (see *Security*).

A candid engineering audit of the current state lives alongside this repo; the **Roadmap** below is drawn from it.

---

## The problem (SIH26009)

MOIL, India's largest manganese producer, plans reserves and production mostly from manual surveys, drilling, and production records — slow, and prone to expected-vs-actual mismatches. The challenge: use geological, historical, equipment, and satellite inputs (rainfall, soil moisture, NDVI, land-surface temperature) to (1) map reserves more accurately, (2) predict production shortfalls, and (3) recommend corrective actions — all through one dashboard.

## Our approach: two products, one shell

The statement bundles two problems with different data, methods, and users. We keep them separate:

- **Track A — Reserve prospectivity (horizon: years).** Where is the ore likely to be? Surface geology + structure inform *where to prospect*. Satellite data is used only for what it can measure at the surface; **we do not claim to detect ore underground**, because no optical/thermal/SAR sensor can.
- **Track B — Production shortfall (horizon: days–months).** Will we hit target, and what do we do if not? Weather, equipment, and blasting constraints drive a forecast and corrective recommendations. This is the half MOIL can act on next month.

### Non-negotiable guardrails

1. **No subsurface ore detection from satellite** — the named inputs are surface/atmospheric only.
2. **No statutory UNFC reserve figures** — outputs are decision-support for a qualified person.
3. **Constraints are enforced, not learned** — the recommender must never propose the physically impossible.
4. **Every number carries provenance** — source, vintage, model version, uncertainty, and a synthetic/live flag.

> These are project principles. Parts of the current codebase do not yet meet them (see *Roadmap*); closing that gap is the priority.

---

## What works today

| Capability | Status | Notes |
|---|---|---|
| Interactive India / mine map with prospectivity overlay | ✅ Working | Leaflet; click any point for an indicative prospectivity score |
| Prospectivity classifier | ⚠️ Indicative | RandomForest over **structural (fault/lineament proximity) + terrain + NASA POWER climatology** proxies. Direct Sentinel-2 spectral ingestion is planned; treat scores as decision-support, not validated predictions |
| Live weather / climatology | ✅ Live data | NASA POWER + Open-Meteo, with caching, retries, and honest fallback |
| Satellite scene metadata | ✅ Live data | Sentinel-2 L2A via Earth Search STAC (metadata only, not pixel processing) |
| Ore-blending optimiser | ✅ Working | Correct cost-minimising linear program (SciPy HiGHS) meeting Mn/P/SiO₂ specs |
| Production-shortfall forecast, risk score, recommendations | 🧪 Heuristic placeholder | Currently rule-based over live weather; the **modelled** forecaster + backtest is on the roadmap |
| Dashboard, auth, PWA shell | ✅ Working (demo-grade auth) | Next.js 16 + React 19 |

Legend: ✅ real · ⚠️ real but limited · 🧪 placeholder pending real implementation.

---

## Architecture (as built)

```
frontend/  Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4
           ├─ Leaflet map, Recharts, react-globe.gl
           ├─ /api/v1/*  route handlers  (product API today)
           └─ Supabase (optional real auth/DB)

backend/   FastAPI service  — blending LP, borehole model, NASA POWER/STAC clients
           (runs and is tested; being consolidated as the single API — see Roadmap)

AI/        RandomForest prospectivity pipeline (dataset → features → train → grid → GeoJSON)
           + NASA POWER data client

database/  SQL schemas (Postgres/PostGIS target) + SQLite for local dev
```

> Note: the frontend currently serves most data from its own `/api/v1/*` routes; the FastAPI service in `backend/` holds the real optimiser and data clients and is being folded in as the single source of truth.

---

## Repository layout

```
frontend/          Next.js app (pages, components, API routes, libs)
backend/           FastAPI app (app/ml, app/services, app/api, tests)
AI/                ML pipeline scripts + trained model + outputs
database/          schema.sql, flood_alert_schema.sql, dev SQLite
```

---

## Quick start

### Frontend (the dashboard)

```bash
cd frontend
npm install
cp .env.example .env.local        # add your own Supabase / API keys
npm run dev                       # http://localhost:3000
npm run build                     # production build
```

### Backend (FastAPI API + real optimiser)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # defaults to local SQLite; no external DB required
uvicorn app.main:app --reload     # http://localhost:8000  (docs at /docs)
python test_api.py                # end-to-end smoke test (hits NASA POWER + STAC live)
```

### AI pipeline (regenerate prospectivity grid + model)

```bash
cd AI
pip install -r ../backend/requirements.txt   # pandas, numpy, scikit-learn, requests, joblib
python scripts/01_make_dataset.py
python scripts/02_extract_features.py
python scripts/03_train_model.py
python scripts/04_predict_grid.py
python scripts/05_export_geojson.py           # writes prospectivity.geojson for the frontend
```

Requires internet for NASA POWER. Outputs land in `AI/outputs/`.

---

## Data & provenance

| Source | Type | Real? |
|---|---|---|
| NASA POWER | Climatology / weather | Live (public API) |
| Open-Meteo | Current weather / soil moisture | Live (public API) |
| Sentinel-2 L2A (Earth Search STAC) | Scene metadata | Live (metadata only) |
| GSI Bhukosh, IBM Yearbook, MOIL reports | Geology / production baselines | Reference for calibration |
| Borehole assays, production, equipment, blasting logs | MOIL operational | **Synthetic** (proprietary; not public) |

The intended production path is a **documented ingestion contract** (versioned schemas MOIL can map real data onto) plus a **synthetic generator** that flags every generated row. Building that contract and flagging is a priority (see Roadmap).

---

## Roadmap

**Immediate**
- Replace demo-grade auth; remove hardcoded credentials; sign/verify sessions server-side.
- Stamp every API response with `source`, `vintage`, `is_live`, `is_synthetic`, and model version, and surface it in the evidence panel.
- Remove statutory `UNFC` labels from outputs; keep prospectivity scores + uncertainty.

**Core (make Track B real, on one pilot mine)**
- Publish the ingestion contract; add a calibrated synthetic generator that flags rows.
- Modelled shortfall forecaster (seasonal-naive baseline + gradient boosting) with prediction intervals and P(shortfall).
- Rolling-origin backtest (MAPE + interval coverage) surfaced in the UI.
- Hard-constraint engine (shift/blasting windows, equipment relocation feasibility) gating every recommendation.

**Track A**
- Real Sentinel-2 band ratios + DEM slope + GSI lithology as features; leave-one-mine-out validation; per-cell uncertainty.

**Integration**
- Consolidate to one backend; wire the real prospectivity model behind map-click prediction; ensure reproducibility (same inputs → same output).

**Later**
- Multi-mine portfolio, grade-aware forecasting, scenario comparison, accept/reject audit trail, InSAR subsidence overlay, PDF/Excel export, role-based views, on-premise deployment.

---

## Security

This is a prototype. Authentication is **demo-grade** and intended only for local evaluation. Before any shared or public deployment: replace the demo login, enforce server-side session verification, remove any default credentials, tighten database row-level security, and rotate all keys. **Do not expose this build to the public internet as-is.** Never commit real secrets — configure them via `.env.local` / `.env`.

---

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Leaflet · Recharts · FastAPI · SQLAlchemy · SciPy · scikit-learn · Supabase · PostgreSQL/PostGIS (target).

## Team & credits

Smart India Hackathon 2026 · Problem Statement SIH26009 · Ministry of Steel / MOIL Limited.
