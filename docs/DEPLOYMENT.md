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

On-demand re-run: `GET /api/v1/mines/{id}/backtest?compute=true`.

**If no artifact exists**, the endpoint returns **503 with instructions** rather
than blocking for minutes behind a spinner. A miss is reported, not hidden.

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

## Static assets — the hero animation

`public/frames` holds 788 JPEGs (~145 MB) driving the landing scroll animation.
Both `.vercelignore` files previously excluded it, so the animation 404'd in
production while working locally. The exclusions are gone and both files carry a
comment explaining why they must not come back.

Verified against a production build (`next start`), not dev:

```
/frames/frame_0001.jpg -> HTTP 200  195809 bytes  image/jpeg
/frames/frame_0394.jpg -> HTTP 200  208488 bytes  image/jpeg
/frames/frame_0788.jpg -> HTTP 200  213047 bytes  image/jpeg
/frames/frame_9999.jpg -> HTTP 404            (control: 404s still work)
landing page: <link rel="preload" href="/frames/frame_0001.jpg" as="image" …>
```

If deployment size becomes a constraint, host the sequence externally or encode
it as a video — do not silently re-add the ignore rule.

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
