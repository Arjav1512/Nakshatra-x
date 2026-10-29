# NAKSHATRA-X

**Decision support for MOIL's manganese mines: where to prospect, and whether
production will meet plan.**

Built for Smart India Hackathon 2026, Problem Statement SIH26009 (Ministry of
Steel / MOIL Limited).

> **Status: a working demonstrator that runs locally.** Nothing is hosted.
> MOIL's operational data is proprietary, so all of it here is synthetic and
> labelled as such. The outputs are decision support, not statutory reserve
> figures.

---

## Two tracks

The problem statement bundles two questions with different data, methods and
users. They are kept apart.

### Track A: where to prospect (horizon: years)

The model is a gradient-boosted classifier, `track-a-gbt-lomo-v1`. It scores
surface indicators measured from Sentinel-2 L2A reflectance (band ratios for
iron oxide, ferrous iron, clay alteration and vegetation) and from SRTM terrain
(elevation, and slope computed in metres). It is trained on MOIL's known mine
locations against sampled background points.

Ordinary kriging turns the point scores into a surface with a **per-cell
uncertainty**. Drill targets are ranked by kriged prospectivity, and each one
carries the evidence behind its rank.

Two rules are enforced by test, because breaking them is how the first version
of this model failed:
- no feature may be a function of distance to a known mine;
- latitude and longitude are not features.

That first version is archived in `archive/track-a-leaky/`, with a README
explaining why. Full detail is in `docs/TRACK_A.md`.

### Track B: will production meet plan (horizon: days to weeks)

The forecaster is `nakshatra-gbt-cqr-v1`: gradient-boosted quantile regression
with a conformal width correction. It gives a daily median and an 80% interval
for every mine and grade, and an expected shortfall in tonnes against plan. It
is always reported next to a seasonal-naive baseline that it has to beat.

Corrective actions pass through a **hard-constraint engine** (blasting windows,
shift windows, equipment relocation), so the system never recommends something
physically impossible. Around the forecast sit:
- an ore-blending linear program;
- a what-if scenario panel, "Mine twin", which uses the same constraint engine;
- a rainfall-context view.

### What is real and what is synthetic

| Data | Status | Source |
|---|---|---|
| Track A inputs: surface reflectance, elevation, slope | **Measured** | Sentinel-2 L2A (Planetary Computer), SRTM |
| Track A labels | **Real** | MOIL mine locations |
| GSI lithology | **Missing**: the source was unreachable, so it is omitted, not substituted | — |
| Production, equipment events, blasting, plan targets | **Synthetic**, every row flagged `is_synthetic` and badged in the UI | Generator behind the published ingestion contract, `docs/INGESTION_CONTRACT.md` |
| Weather the forecaster was trained and backtested on | **Synthetic**, a covariate from the same generator | as above |
| Rainfall and temperature on the conditions tiles | **Live**, with a labelled synthetic fallback when the service is down | NASA POWER, Open-Meteo |
| Sentinel-2 scene metadata | **Live** | Earth Search STAC |
| Map imagery layers | **Live or cached**, labelled with the fetch date | Planetary Computer |

---

## How it is validated

- **Track A: leave-one-mine-out.** Each fold holds out an entire deposit, so
  the model is always scored on a mine it has never seen. That is the question
  a geologist asks: would this have found the next deposit? A random split is
  reported only for contrast, along with ablations by feature group. See
  `docs/TRACK_A.md`.
- **Track B: rolling-origin backtest.** The model is refit at every forecast
  origin and scored only on days it did not see. It is compared with the
  seasonal-naive baseline on error, and on whether its 80% intervals contain
  80% of outcomes. Calibration is measured across all mines and many origin
  dates, with cluster-bootstrap intervals. See `docs/BACKTEST.md` and
  `docs/CALIBRATION.md`.
- **Provenance.** Every number the API serves carries its source, vintage,
  model version and a live or synthetic flag. A backend test and two browser
  guards fail the build if one does not.
- **Artifacts match the code.** Each committed artifact records the
  fingerprint of the code that produced it, and CI fails if code and artifacts
  drift apart (`python -m app.api.batch check`).

## The figures

Every figure the project quotes is in **`docs/PITCH_FIGURES.md`**. That file is
written from what the API actually serves (`python -m app.api.batch pitch`),
and CI checks it against the served artifacts (`batch pitch-check`). This
README quotes no figure on purpose: take them from there, together with the
dataset window they belong to.

---

## Honest limits

- **P(shortfall) is withdrawn.** It is computed from the 14-day aggregate of
  the daily forecasts, and that aggregate was measured unsound on every dataset
  tried (D-043, `docs/QUANTILE_CROSSING.md`). Its band covers fewer outcomes
  than it claims, and the error has no consistent direction a reader could
  correct for. Two replacement estimators were pre-registered, and neither
  passed its rule (D-045, `docs/SHORTFALL_PROBABILITY.md`). So the console does
  not show it, and the pitch does not quote it. The API still computes it, so a
  future fix can be measured against exactly what is served. It comes back
  only when a fix passes a pre-registered test (D-044, `docs/DECISIONS.md`).
- **The daily intervals are close to calibrated, not calibrated.** How close
  depends on the dataset window (`docs/CALIBRATION.md`).
- **Track A is softer than its headline.** There are few positives, part of
  what the model learns is the terrain mines are built on, several deposits
  score low, and lithology is missing (`docs/TRACK_A.md`, `docs/READINESS.md`
  §5).
- **The operational data is synthetic.** The forecaster's margin over its
  baseline is partly a property of the generator. It shows that the pipeline
  is sound, not how the model would do on MOIL's operations.
- **Some services have no offline fallback.** The basemap goes blank without a
  network. While a cold backend refits, the console can show the service as
  degraded. The demo pre-flight exists for both (`docs/DEMO.md`).
- **It is not hosted.** A hosted deployment has to run the Next.js app and the
  FastAPI service together (`docs/DEPLOYMENT.md`, "Hosting").
- **Keys from the repository's early history must be rotated** at the provider
  before any shared deployment (`docs/SECURITY_FIXES.md`).

### Guardrails

1. **No subsurface ore detection from satellite.** The inputs are surface and
   atmospheric only.
2. **No statutory UNFC reserve figures.** The outputs are decision support for
   a qualified person.
3. **Constraints are enforced, not learned.** The recommender never proposes
   the physically impossible.
4. **Every number carries provenance:** source, vintage, model version,
   uncertainty, and a live or synthetic flag.

---

## Run it locally

You need Node 22 and Python 3.12 or newer. CI and the demo use Python 3.13.

```bash
backend/scripts/setup_dev.sh                  # backend/.venv, with the test dependencies
(cd frontend && npm ci && npm run build)      # frontend dependencies and the production build
```

Then follow the pre-flight in `docs/DEMO.md` ("Pre-flight — run this before
every demo"). It does three things:
- checks the ports and that the figures still match what is served;
- starts FastAPI on `http://localhost:8000` and the app on
  `http://localhost:3000`;
- checks that the console works before anyone presents it.

`docs/CI.md` lists every test suite and how to run it.

## Repository layout

```
frontend/   Next.js app: pages, components, and /api/v1 route handlers that proxy FastAPI
backend/    FastAPI service: forecaster, backtest, constraint engine, Track A serving, tests
AI/         Track A: feature extraction, training, and the served model's outputs
archive/    the retired, leaky Track A pipeline, kept as a record
database/   SQL schemas (Postgres; PostGIS planned, not installed)
docs/       decisions, validation reports, demo script, CI, deployment
scripts/    port and memory checks, CI helpers
```

## Documentation

| Read | For |
|---|---|
| `docs/DEMO.md` | Setting up, the pre-flight, and the demo script |
| `docs/PITCH_FIGURES.md` | Every quotable figure, and its source |
| `docs/TRACK_A.md` | Prospectivity: method, validation, limits |
| `docs/BACKTEST.md`, `docs/CALIBRATION.md` | Track B validation |
| `docs/SHORTFALL_PROBABILITY.md` | Why P(shortfall) stays withdrawn |
| `docs/INGESTION_CONTRACT.md` | The schema MOIL's real data would map onto |
| `docs/DECISIONS.md` | The decision log, including pre-registrations |
| `docs/READINESS.md` | The current assessment against the PRD |
| `docs/INTEGRITY.md` | Fabrications found and removed |
| `docs/DEPLOYMENT.md`, `docs/CI.md` | Operating it, and the gates every change passes |
| `docs/SECURITY_FIXES.md` | Authentication fixes, and the keys to rotate |

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Leaflet · Recharts ·
FastAPI · SQLAlchemy · scikit-learn · SciPy · Supabase · PostgreSQL (PostGIS
planned, not installed).

## Team and credits

Smart India Hackathon 2026 · Problem Statement SIH26009 · Ministry of Steel /
MOIL Limited.
