# Nakshatra-X — Scripted Demo (≈3 minutes)

**Route:** `/console` · **Pilot:** Balaghat (Track B), Dongri Buzurg (Track A)
**Requirements exercised:** D-1…D-8, N-3, N-6, N-8, B-5, B-6, B-10, C-1…C-5, A-3, A-4, A-5, A-7

---

## Before you start

Two processes. The console reads live service-layer state; there is no mock path.

```bash
# terminal 1 — FastAPI service layer (architecture L4)
cd backend && python -m uvicorn app.main:app --port 8000

# terminal 2 — Next.js
cd frontend && BACKEND_URL=http://127.0.0.1:8000 \
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  npm run start
```

Open **http://localhost:3000/console**.

> If you skip `SESSION_SECRET`, auth routes return 500 by design — the app fails
> closed rather than signing cookies with a guessable key. The console itself
> does not need auth.

### Check the console actually works before you present

With both processes up:

```bash
cd frontend && npm run test:e2e
```

This drives `/console` in headless Chrome and asserts what this script is about
to show: ten portfolio cards each with a probability and a provenance badge, the
drill-down chain through forecast, per-grade breakdown, backtest and
constraint-checked actions, and zero 5xx responses. Expect `PASS — 18/18`.

It exists because of DEF-1 (`docs/DECISIONS.md` D-028): a duplicate mine
register keyed by slug meant the console could not render a single number, while
every API-level check stayed green because they all used numeric ids. Run this,
not curl, to know the demo will work.

The first forecast for each mine costs roughly 40 s cold and a few milliseconds
warm. **Warm the cache before presenting**, or the portfolio will still be
filling in while you talk:

```bash
for i in $(seq 1 10); do curl -s -o /dev/null \
  "http://localhost:8000/api/v1/mines/$i/forecast"; done
```

---

## 0:00 — Frame the problem (20 s)

The header states the thesis before any number appears:

> *Two tracks, as the problem statement implies but does not say: Track B predicts production shortfall over days to months, Track A ranks where to prospect over years. Satellite data is used for what it can measure — weather and surface geology. Nothing here claims to see ore underground.*

**Say:** the PS names rainfall, soil moisture, vegetation index and land surface
temperature. Every one is a surface or atmospheric signal. Balaghat works at
roughly 383 m. We do not claim to see through rock, and PRD §2.2 is why.

---

## 0:20 — Portfolio (25 s)

Ten mines, each showing **P(shortfall)** and expected tonnes short. Balaghat is
marked as the Track B pilot (PRD §13 Q4).

**Point out:** the risk strip is computed per mine by the forecaster — not a
status colour someone typed in. Cards read `computing…` until their forecast
returns, then show a real probability.

**Click Balaghat.**

---

## 0:45 — Mine conditions, and the honesty marker (20 s)

Four condition tiles: 14-day rainfall, land surface temperature, equipment
downtime, blasts this week.

**This is the moment that earns trust.** Rainfall carries a green **LIVE**
badge; downtime and blast count carry an amber **SYNTHETIC** badge.

**Say:** MOIL's operational records are proprietary and no dataset ships with
this PS (PRD §8.2). So we published an ingestion contract MOIL can map onto,
and generate operational data to it — flagged in the API, flagged in the UI,
never labelled live. Weather is genuinely measured.

**Click `+ evidence`** under rainfall → source *NASA POWER Analysis-Ready API*,
vintage, model version, method, and how old the reading is.

---

## 1:05 — Track B: the shortfall (30 s)

Four headline tiles: plan target, expected production, expected shortfall,
worst-grade P(shortfall).

**Grade matters.** Click through the grade chips — `ferro_manganese`,
`silico_manganese`, `blast_furnace`, `dioxide` each carry their own probability.

**Say:** PRD §3 — a shortfall in one grade is not fungible with a surplus in
another, so B-5 makes per-grade forecasting P0. These are four different
forecasts, not one number relabelled.

The chart shows the median with its **80% prediction interval**, and the
**dashed amber line is the seasonal-naive baseline** the model has to beat.

---

## 1:35 — The backtest (30 s) ← *the credibility moment*

**Click "Run rolling-origin backtest".** It takes a minute; say this while it runs:

> Most teams show an accuracy number from a random split. That is wrong for a
> time series — it lets the model see the future. This refits at every origin
> and scores only on held-out days.

Result:

| | MAPE | Coverage |
|---|---|---|
| GBT + conformal | ~10–12% | **0.82** |
| Seasonal-naive | ~15% | — |

**Say two things.** First, the model beats the baseline — the comparison is
like-for-like, same origins and targets. Second, and rarer: the 80% interval
covers **82%** of actuals. PRD §11 calls calibration out specifically —
*"do 70%-confidence predictions come true 70% of the time? Almost no team will
measure this."* Getting there took four attempts; `docs/BACKTEST.md` reports all
of them including the two that failed.

---

## 2:05 — Constraint-gated actions (25 s)

Approved actions in green, each with its expected effect, its ΔP(shortfall), its
**stated assumptions**, and the list of **checks it passed**.

**On the rejection panel — read what is actually on screen.** With the current
synthetic operational data, no candidate action violates a constraint at any of
the ten mines, so the panel reads:

> *No candidate violated a constraint this run. The engine still ran — see its
> scope below.*

Do not promise a list of rejected actions; there is not one to show. The line
above is the better point anyway:

> PRD §6.3 says a recommender that suggests blasting during a statutory rest
> period, or moving a shovel 200 km overnight, discredits the system in one
> demo. So the engine checks both, and it reports when it rejected nothing
> rather than going quiet — an empty result and an engine that never ran look
> identical otherwise. When a candidate *is* rejected, it is removed rather than
> shown with a warning, and the panel names the rule it broke.

**Verified 2026-09-24:** `rejected_actions` is empty for all ten mines. If you
want a live rejection on stage, you need operational inputs that push a
candidate outside `shift_hours` or `blast_window` — that is a data-generation
change, not a UI one.

Footer line: `enforced, not learned · scope: shift_hours, blast_window,
blast_separation, equipment_compatibility, relocation_feasibility · excluded:
ventilation — PRD §4 non-goal 6`.

**Say:** the architecture diagram listed ventilation. The PRD makes it a
non-goal. The PRD wins.

---

## 2:30 — Track A: prospectivity (25 s)

**Click "Track A · prospectivity".**

Three tiles: **LOMO AUC 0.85**, spectral-only 0.60, slope-only 0.51.

**Say the honest version:**

> 0.85, and the confidence interval is 0.72–0.95 — ten positives cannot support
> a tighter claim. The earlier pipeline reported 0.98, but its features were
> computed from distance to the known mines, which are the labels. That number
> measured leakage. This one comes from real Sentinel-2 band ratios and SRTM
> terrain, validated by holding out an entire deposit at a time.

**Point at the amber panel** — spectral-only is 0.60, so the geological signal
is thinner than the headline suggests, and GSI lithology (the feature most
likely to carry real geology) was unreachable and is therefore *omitted, not
substituted*.

Ranked drill targets below, each with **kriging uncertainty**. Expand
`evidence for rank 1`.

**Say:** a probability describes the feature values at a cell. Kriging variance
says whether anything was measured nearby. A cell can be promising *and*
uncertain — that distinction is what decides where a rig goes.

**Click "Dongri Buzurg (opencast pilot)" then "Score"** — the real model runs.
Tick *fetch live Sentinel-2* to read pixels during the demo (slower).

---

## 2:55 — Close (10 s)

Footer states the four guardrails. **Export CSV** — every row carries
`source`, `source_kind`, `vintage`, `model_version`, `uncertainty`,
`is_synthetic`, so a figure pasted into a planning deck still says where it
came from.

**Closing line:**

> Real weather, a real optimiser that reports infeasible, a calibrated
> forecaster with a published backtest, and a prospectivity model whose
> weaknesses we measured rather than hid. The operational data is synthetic and
> the UI says so on every tile.

---

## If something is down

Stop FastAPI and reload. The console still renders; every panel reads
**unavailable** with the reason, and no number is invented to fill the gap —
PRD N-6. The blend optimiser returns 503 rather than a heuristic dressed up as
a solve.

Verified:

```
/api/v1/mines/1/forecast            HTTP 503 | nextjs-degraded | numeric fields returned: none
/api/v1/prospectivity/metrics       HTTP 503 | nextjs-degraded | numeric fields returned: none
/console                            HTTP 200  (renders, no dead end)
```

---

## Likely questions

**"Is the production data real?"** No, and we say so on every tile. MOIL's
records are proprietary (PRD §8.2). We publish the schema MOIL maps onto and
generate to it, calibrated to their published ~1.1–1.3 Mt/yr. Weather and
satellite data are real.

**"Can you see ore from space?"** No. Nobody can at 383 m. We use satellite data
for surface geology and weather, which is what the PS actually names.

**"Is 0.85 good?"** It is honest. The CI is 0.72–0.95 on ten deposits, the
spectral-only ablation is 0.60, and we publish both.

**"What happens when MOIL gives you real data?"** Rows land in the same schema
with `is_synthetic: false`, and the amber badges turn green. Nothing else
changes — that is the point of the contract.
