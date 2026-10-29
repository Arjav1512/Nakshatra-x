# Deployment & Operations

PRD **N-1** (latency), **N-2** (nightly batch), **N-5** (on-premise), **N-6** (degradation).

---

## Topology

Two processes. The Next.js app holds no model code — every headline number is
computed in the FastAPI service layer (architecture L4) and proxied.

```
browser ──► Next.js (3000)  ──►  FastAPI (8000)  ──►  NASA POWER · Open-Meteo
             /console                │                 Earth Search STAC
             /api/v1/* proxies       │                 Planetary Computer
                                     └──►  artifacts/  (precomputed backtests)
```

`BACKEND_URL` tells the proxies where FastAPI lives. If it is unreachable every
panel reports **unavailable with a reason** and no number is invented (N-6).

### Running it

```bash
# 1. service layer
cd backend && python -m uvicorn app.main:app --port 8000

# 2. nightly batch (see N-2 below) — first run also warms the cache
cd backend && python -m app.api.batch backtest

# 3. web
cd frontend && BACKEND_URL=http://127.0.0.1:8000 \
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  npm run start
```

### Hosting

**Nothing is hosted.** The product runs locally, set up and checked by the
pre-flight in `docs/DEMO.md` ("Pre-flight — run this before every demo"). The
repository carries no deploy configuration: the Vercel and Netlify files were
removed in #39 because neither platform had deployed `main`, and neither hosts
what the FastAPI service needs: a long-running process with a writable disk. A
frontend-only deploy is not a working product. Every
`/api/v1/*` route proxies FastAPI, so without it every panel reports
unavailable.

A hosted deployment has to run both processes together, with `BACKEND_URL`
pointing the Next.js server at FastAPI.

**FastAPI service (`backend/`)**

- **Python 3.12 or newer.** `rasterio` 1.5 requires 3.12. CI,
  `backend/scripts/setup_dev.sh` and the demo all use 3.13.
- **The committed artifacts.** `backend/artifacts/` must have been produced by
  the code being deployed: `python -m app.api.batch check` passes. At start-up
  the service recomputes any forecast artifact that is missing or stale, and
  takes a warm lock in the same directory, so the directory must be writable.
- **A writable database.** Either SQLite (the default `DATABASE_URL`,
  `sqlite:///./moil.db`, resolved from `backend/`) or Postgres through a
  `postgresql+psycopg://` `DATABASE_URL`.
- **`JWT_SECRET`** when `ENVIRONMENT=production`. The settings refuse to load
  with the placeholder value.
- **A long-running process, not a serverless function.** A cold forecast fit
  takes more than a minute (N-1 below).

**Next.js app (`frontend/`)**

- **`SESSION_SECRET`** of at least 32 characters. In production the app
  refuses to issue sessions without it (see Secrets below). It is read by the
  Next.js server, not by FastAPI.
- **`BACKEND_URL`**, the address of the FastAPI service.
- `npm ci && npm run build && npm run start`.

---

## N-2 — nightly batch, on-demand re-run

The rolling-origin backtest refits the model at **every origin**. That is minutes
of work and does not belong on a request path, which is exactly why the PRD
specifies *"nightly batch; on-demand re-run available"*.

```bash
python -m app.api.batch backtest                # all mines
python -m app.api.batch backtest MOIL-BAL-01    # one mine
```

Suggested cron, after the data refresh:

```cron
15 2 * * *  cd /srv/nakshatra/backend && python -m app.api.batch backtest
```

The job writes `backend/artifacts/backtests/<MINE>_<span>d_<step>step.json`. The
API serves that artifact and reports `served_from` (`memory` / `artifact` /
`computed`) plus `artifact_age_hours`, so the UI can state how old the figure is
instead of implying it was just calculated.

On-demand re-run, on the FastAPI service: `GET /api/v1/mines/{id}/backtest?compute=true`.
It returns **403** unless the server sets `ALLOW_ONDEMAND_BACKTEST=1`. The
Next.js proxy at the same path does not forward `compute`.

**If no artifact exists**, the endpoint returns **404** and names the mines that
do have one, rather than blocking for minutes behind a spinner. A miss is
reported, not hidden.

---

## N-1 — latency

Target: **< 2 s p95 on cached results.** Measured with
`backend/measure_latency.py`, 12 warm samples per endpoint, nearest-rank p95:

| Endpoint | Cold | Warm p95 | N-1 |
|---|---|---|---|
| `GET /mines` | 0.016 s | **0.001 s** | pass |
| `GET /mines/1/telemetry` | 1.692 s | **0.003 s** | pass |
| `GET /mines/1/forecast` | 96.505 s | **0.246 s** | pass |
| `GET /mines/1/recommendations` | 0.204 s | **0.213 s** | pass |
| `GET /mines/1/backtest` | 0.004 s | **0.002 s** | pass |
| `GET /prospectivity/metrics` | 0.024 s | **0.001 s** | pass |
| `GET /prospectivity/drill-targets` | 0.010 s | **0.009 s** | pass |
| `GET /prospectivity/predict` | 0.001 s | **0.001 s** | pass |

**8/8 meet N-1 warm.** Cold and warm are reported separately because N-1's
qualifier is *cached*; conflating them would either flatter the warm path or
condemn the cached one.

The honest shape of it:

- Forecast, recommendations, prospectivity and drill-targets are warm-fast and
  meet the target once the per-process model cache is populated.
- The **first** call after a restart pays for dataset generation and model
  fitting. That is a cold-start cost, not a steady-state one.
- The **backtest** cannot meet 2 s computed — hence the batch above. Served from
  its artifact it is a file read.

### Warming a fresh process

A restart empties the in-process cache. To avoid a user paying the cold cost:

```bash
curl -s localhost:8000/api/v1/mines/1/forecast >/dev/null   # fits and caches
curl -s localhost:8000/api/v1/prospectivity/metrics >/dev/null
```

Run these from the deploy script after the service comes up.

---

## N-5 — on-premise

Nothing in the decision path requires a managed cloud service:

| Dependency | Role | Offline behaviour |
|---|---|---|
| NASA POWER | observed weather | degrades to flagged synthetic |
| Open-Meteo | forecast weather | degrades to flagged synthetic |
| Earth Search STAC | scene metadata | empty list, never fabricated IDs |
| Planetary Computer | Sentinel-2 pixels (Track A build step) | offline build uses the cached feature table |
| Supabase | auth / profiles only | not on the decision path |

Model fitting, the constraint engine, kriging and the ingestion contract are all
local. The weather and imagery sources are external by nature — they are
satellites — and every one degrades with the reason stated.

---

## Secrets

- `SESSION_SECRET` is read from the environment only. In production a missing or
  short value **throws** rather than falling back to a known key, so session
  routes fail closed.
- `.env.example` holds placeholders only, verified by grep for live key patterns.
- No credentials are hardcoded in source.

> Secrets previously committed to this repository's history (a Supabase anon key
> and a Firebase web config) were removed from the working tree in Phase 1.
> History rewriting is out of scope here — **rotate those keys** at the provider.

---

## Lint

`next lint` was removed in Next 16, so `npm run lint` pointed at a command that
no longer exists and the project had **no working lint at all**. ESLint cannot
be used here either: `eslint-config-next` requires typescript-eslint, which does
not support TypeScript 7 (this project is on 7.0.2), and downgrading TypeScript
to satisfy a linter is the wrong trade.

Linting now runs on **Biome**, which parses TypeScript natively with no
`typescript` dependency:

```bash
cd frontend && npm run lint       # biome lint src
```

`tsc --noEmit` runs in the same gate and is the stricter type check.
