# Nakshatra-X — Scripted Demo (≈3 minutes)

**Route:** `/console` · **Pilot:** Balaghat (Track B), Dongri Buzurg (Track A)
**Requirements exercised:** D-1…D-8, N-3, N-6, N-8, B-5, B-6, B-10, C-1…C-5, A-3, A-4, A-5, A-7

---

## Before you start

Everything below runs from the repository root unless a block says `cd`. Where a
block says *terminal*, give it its own: the servers stay in the foreground.

Commands use `backend/.venv/bin/python`, not `python`. The venv is what has the
dependencies, and on macOS there is often no `python` command at all — only
`python3`. The first cold-start rehearsal from a fresh clone stopped right there,
on the first command this document used to give.

### Once, on a new machine — install and build

```bash
backend/scripts/setup_dev.sh                  # Python 3.13 venv at backend/.venv
(cd frontend && npm ci && npm run build)      # dependencies, then the production build
```

Rebuild (`npm run build`) after pulling new code; `npm run start` serves the
last build. The build downloads its fonts from Google the first time, so do this
with a network (`docs/CI.md`).

Measured in two fresh clones on 2026-10-06 (8-core laptop): the clone took
31 s and 252 s (371 MB; same machine, same day — it is the network), then
`setup_dev.sh` 18–20 s, `npm ci` 4–5 s, `npm run build` 7–8 s, with this
machine's package caches already warm. A machine that has never downloaded these
packages takes several minutes longer. Clone the day before, not the morning of.

### The day before — regenerate every artifact, together

**Do this once, the day before the demo.** One command, about seventeen minutes,
and it is the difference between a forecast that covers next fortnight and one
that covers a fortnight that has already been and gone.

```bash
(cd backend && NAKSHATRA_DATA_END_DATE=$(date +%F) .venv/bin/python -m app.api.batch all)
```

`all` regenerates the sample CSVs, all ten forecasts, the committed backtest(s)
**and the calibration shown beside P(shortfall)** from **one** dataset, then
verifies they agree and prints the identity it used. Check the dates it prints
before you trust it.

**You do not set the date again tomorrow.** `batch all` records it with the
artifacts (`data/synthetic/_dataset_identity.json`), and the backend serves the
recorded dataset whenever `NAKSHATRA_DATA_END_DATE` is unset (`DECISIONS.md`
D-042); its first log line says which date it is serving. It did not use to:
the first cold-start rehearsal regenerated for 6 October, started the backend as
this document said, and watched it refit all ten forecasts for the old window
over the new ones while `/readyz` stayed 503 — the step undone by the next one.

The calibration is in `all` because it describes the dataset too. A new end date
changes the dataset, and the console refuses a calibration measured on a
different one — so leaving it out would have put "Calibration unavailable:
measured on a different model" on screen on demo day.

**Regenerate them together, never one kind at a time.** Forecasts, backtests and
the exported samples are all built from the same generated dataset. Regenerated
separately they drift, and a screen showing a forecast next to a backtest MAPE is
then comparing two datasets under one label — nothing in the numbers would look
wrong. `/readyz` checks the agreement and reports any mine whose artifact
disagrees as `stale` rather than `ready`; `.venv/bin/python -m app.api.batch check` answers
the same question from the command line.

Measured on a quiet 8-core laptop with the default two fit threads: samples
0.5 s, forecasts 25 s each (250 s for ten), backtest 216 s, calibration 525 s
(it refits at 24 origins) — **about 17 minutes** in total. The cold-start
rehearsals measured 1,065 s on a quiet machine and 1,134 s with other work
running (2026-10-06).

**Run it on a quiet machine.** This is CPU-bound and it is the one step that
punishes contention. One run here took **5.8 hours** instead of 8 minutes because
macOS `mediaanalysisd` had been sitting at 211% CPU for seventeen hours. The
output was byte-identical — same MAPE, same coverage — it just took ninety-seven
times as long. Check `ps -Ao pid,%cpu,comm -r | head -5` before you start.

#### Regenerating the day before is safe — and why

The backend decides an artifact is stale by **identity alone**: its dataset
identity (generator, contract, seed, end date) or its code fingerprint (model
version, every module in the forecast's import chain, library versions) differs
from the code that is running. That is the only thing that changes what an
artifact says — the generator is seeded, so recomputing matching inputs gives
the same numbers. **Age never triggers a recompute.**

It used to. Freshness was a 24-hour window on the file's modification time, so
artifacts regenerated the day before had crossed it by the time the demo
started, and the backend refitted all ten forecasts at startup: `/readyz` at
503 and "Computing" on every card while it refitted ten forecasts two at a time
(about two minutes on a quiet machine, by the timings above), for byte-identical
numbers under a new date. Now they are served the moment the backend is up.

Re-running is harmless too. `batch all` skips every artifact whose identity
already matches, and rewrites nothing that comes out the same, so a second run
with the same date changes no file and finishes in seconds. A file's `vintage`,
`computed_at` or `generated_at` is therefore when its content last changed, not
when someone last ran the batch. `batch all --force` recomputes everything
anyway — a determinism check — and still leaves identical output untouched.

Age is still shown, never acted on. While the window is current, the forecast
panel says "generated N h ago", read from the artifact's own `vintage` (a
checkout resets file times, so the file cannot say). `/readyz` carries an `age_warning` once the oldest forecast is more
than 48 hours old, which means it was not regenerated the day before; pre-flight
step 2 prints it. It does not affect readiness. What matters on the day is
whether the forecast window has ended, and `npm run test:dates` checks exactly
that.

#### Map tiles — so the imagery survives the network

The three imagery layers (Sentinel-2 true colour, the iron-oxide ratio and the
Copernicus DEM) come from Microsoft Planetary Computer. Fetch a local copy the
day before, so a hall with bad wifi does not take them off the map:

```bash
(cd backend && .venv/bin/python -m app.api.batch tiles)
```

Measured: **39.3 MB, 470–560 s** — 2,625 tiles, z6 to z12 over the study area. That
is every zoom the map flies to (it opens at 8.5, a selected mine is 11, a clicked
one 12); past z12 the layers are live-only. It goes to `backend/.tile-cache/`,
which is gitignored, with a manifest recording each layer's licence, required
attribution and fetch date.

**If it reports failed tiles, run it again.** A slow network can fail a tile;
the run counts it, finishes, writes the manifest and exits 1 with a message. A
re-run reuses every tile on disk and fetches only the failed ones — in the
rehearsal, 368 tiles in 60 s. (It used to die with a traceback on the first
timeout, leaving no manifest; fixed in the same pass.) Separate from `all` on purpose: it downloads from
someone else's service rather than rebuilding anything from the commit.

**What the map does with it.** It always asks Planetary Computer first. If a tile
fails or times out, it reads the same tile from the cache and the layer's legend
changes from **LIVE** to **CACHED · fetched <date>** — the date the tiles were
actually fetched, never today's. The licensor's notice stays in the legend and in
the map's attribution line either way. If Planetary Computer forgets a mosaic
(its registrations are evicted), the map re-registers once and carries on live.

#### If regeneration fails, roll back

The previous artifact set is committed in git, so it is always the fallback:

```bash
git checkout -- backend/artifacts data/synthetic     # back to the committed set
(cd backend && .venv/bin/python -m app.api.batch check)   # confirm it agrees
```

`batch all` verifies at the end and tells you to do exactly this if the check
fails. Nothing is deleted along the way — each artifact is written to a temporary
file and renamed into place — so a crashed run leaves the previous artifact in
place rather than a half-written one. Demo with the committed set if you have to:
the console will say the window has already ended, which is honest and
survivable. An inconsistent set is not.

**Why this step exists.** A forecast's origin is the last day of actuals, and the
synthetic generator's end date is a committed constant — it has to be, or the
dataset would change overnight and no artifact would be reproducible. The
consequence is that the committed artifacts cover a window fixed at the date in
`DEFAULT_DATA_END_DATE` (currently 2026-09-20, so 21 Sep – 4 Oct 2026). On any
later day that window is in the past.

Nothing shifts the displayed dates without regenerating the forecast. If you skip
this step the console says so in plain words — *"This forecast's window has
already ended"* — rather than presenting a stale fortnight as a plan. That is
survivable; it is not what you want on stage. `docs/DECISIONS.md` D-030 records
why it works this way.

Regenerating with a new date changes the artifact identity, so `git status` will
show the forecasts, the backtest, the calibration and the samples as modified.
Running it again with the same date changes nothing further. Commit them or
don't, as you prefer — but do not edit them.

### Pre-flight — run this before every demo

In order, in three terminals. Do not start talking until every one is green.

```bash
# Terminal 1 — 0. ports: nothing left over from an earlier session; then
#              1. the backend. One worker, and do not set NAKSHATRA_SKIP_WARM.
scripts/check_port.sh 8000 "FastAPI" && scripts/check_port.sh 3000 "Next.js"
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000
```

Its first line names the dataset it serves —
`[dataset] end date … — recorded by batch all …`. It should be the date you
regenerated for.

```bash
# Terminal 2 — 2. readiness: every mine "ready", every artifact on one dataset.
until curl -sf http://localhost:8000/api/v1/readyz >/dev/null; do sleep 1; done
curl -s http://localhost:8000/api/v1/readyz | python3 -m json.tool | head -20
#    Informational: warns if the oldest forecast is over 48 h, i.e. it was not
#    regenerated the day before. Not a failure — but run test:dates below.
curl -s http://localhost:8000/api/v1/readyz | python3 -c 'import json,sys; print(json.load(sys.stdin)["age_warning"] or "artifact age: ok")'
#            3. the frontend.
cd frontend && BACKEND_URL=http://127.0.0.1:8000 \
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  npm run start
```

```bash
# Terminal 3 — 4. the browser checks.
cd frontend && npm run test:e2e && npm run test:dates
#            5. the map: every layer draws, is not blank and credits its
#               licensor — then the same with Planetary Computer blocked,
#               which proves the tile cache.
npm run test:map && npm run test:map -- --pc-blocked
```

Open **http://localhost:3000/console**. If you skip `SESSION_SECRET`, auth
routes return 500 by design — the app fails closed rather than signing cookies
with a guessable key. The console itself does not need auth.

Measured in the cold-start rehearsal (2026-10-06, artifacts regenerated the
"day before"): `/readyz` green 2.8 s after the backend started, serving the
regenerated dataset with no refit; the frontend answering 0.5 s after start;
`test:e2e` 64 s, `test:dates` 27 s, `test:map` 7 s, `test:map -- --pc-blocked`
6 s — under two minutes from an empty terminal to all green.

If `test:map` fails but `-- --pc-blocked` passes, Planetary Computer is down or
unreachable from the hall and the demo will run from the cache — labelled as
such. If both fail, run `(cd backend && .venv/bin/python -m app.api.batch tiles)` again.

`npm run test:dates` is the one that catches a forgotten regeneration: it asserts
the console shows the forecast's real origin and window dates, marks the forecast
as not live, and never implies a rolling fortnight.

What the two states look like, so you can recognise them from the back of a
room: `docs/evidence/console-forecast-ready.png` (artifacts present — dated
window, LIVE badges on weather, SYNTHETIC and DERIVED on model output) and
`docs/evidence/console-forecast-warming.png` (cold backend — "Computing forecast
— about 32s", with the queue depth). The warming state is blue, not red: a
backend that is still computing is not a broken one.

`/readyz` returns 503 until every mine has a usable forecast artifact, and names
any mine that is `warming` or `failed` with the reason. It is the difference
between "give it another minute" and "something is broken" — worth thirty
seconds before an audience rather than finding out in front of one.

**Where the demo backend runs.** On a machine that stays awake: the laptop you
are presenting from, or an always-on host. Not a free-tier service that sleeps —
a cold container has no artifacts warmed in memory, and while it rebuilds them
the console shows every mine as "Computing". The artifacts are committed
precisely so a fresh process is fast, but a *sleeping* host still pays process
start plus whatever the platform charges for waking up.

**One worker.** `--workers 4` is fine but unnecessary here; a file lock means
only one process warms, and the others serve. Single-worker keeps the logs
readable.

**Never set `NAKSHATRA_SKIP_WARM=1`.** It disables startup warming and exists
only so a test can measure a genuinely cold backend. `test_demo_hardening.py`
asserts it appears in no shipped config.

### Check the console actually works before you present

With both processes up:

```bash
cd frontend && npm run test:e2e
```

This drives `/console` in headless Chrome and asserts what this script is about
to show: ten portfolio cards each with a probability and a provenance badge, the
drill-down chain through forecast, per-grade breakdown, backtest and
constraint-checked actions, and zero 5xx responses. Expect `PASS — 18/18`.

**The backtest no longer needs a click.** It is read from the artifact on load,
so the figures are on screen when you arrive at Balaghat. On the other nine mines
the panel says *"Validated on the pilot mine (Balaghat)"* and links to it — that
is a designed state, not a failure, and nothing there can start a 216 s
computation.

It exists because of DEF-1 (`docs/DECISIONS.md` D-028): a duplicate mine
register keyed by slug meant the console could not render a single number, while
every API-level check stayed green because they all used numeric ids. Run this,
not curl, to know the demo will work.

There is no cache to warm by hand any more. A request never computes a forecast:
it serves a committed artifact (measured p95 1.5 ms) or answers 503 `warming`
with an ETA, and the console shows a "Computing" state rather than an error. The
curl loop that used to live here — ten sequential requests to force the fits —
was a workaround for computation happening inside requests, and that is gone.

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

**Grade matters.** The per-grade breakdown lists ferro manganese, silico
manganese, blast furnace and dioxide, each with its own probability.

**Say:** PRD §3 — a shortfall in one grade is not fungible with a surplus in
another, so B-5 makes per-grade forecasting P0. These are four different
forecasts, not one number relabelled.

The chart shows the median with its **80% prediction interval**, and the
**dashed amber line is the seasonal-naive baseline** the model has to beat.

---

## 1:35 — The backtest (30 s) ← *the credibility moment*

The backtest is already on screen — it is read from the stored artifact when
the mine opens, so there is nothing to click and nothing to wait for. Say:

> Most teams show an accuracy number from a random split. That is wrong for a
> time series — it lets the model see the future. This refits at every origin
> and scores only on held-out days.

Result:

| | MAPE | Coverage |
|---|---|---|
| GBT + conformal, pilot mine | 11.67% | **0.812** |
| Seasonal-naive, pilot mine | 14.81% | — |
| GBT + conformal, all ten mines | 10.00% | **0.761** [0.733, 0.786] |

**The figures depend on the dataset.** The table quotes the committed artifacts
(data to 20 September). After the day-before regeneration the screen shows that
dataset's figures instead — in the rehearsal, regenerated for 6 October: pilot
MAPE 11.00% vs 13.22%, coverage 0.819; 14-day calibration 0.683. **Read the
numbers off the screen**, not off this page; the points below hold for both.

**Say two things, and scope the second one.** First, the model beats the
baseline — the comparison is like-for-like, same origins and targets. Second, and
rarer: the 80% interval covers **81%** of actuals (0.812) *on the pilot mine*. Do not
generalise that figure. Across all ten mines daily coverage is **0.761**
[0.733, 0.786] and the 14-day cumulative total is too narrow at **0.738**
[0.700, 0.777] — if a judge asks, that is the honest answer and it is written up
in `docs/CALIBRATION.md`. PRD §11 calls calibration out specifically —
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

## 2:20 — The constraint engine says no (15 s)

Open **Operations → Mine twin**. The what-if calculator starts on a feasible
plan: the 06:00–14:00 shift with no blast delay, which puts the blast inside the
permitted 06:00–07:00 window. Click **Run what-if simulation** — the constraint
check reads **passed**.

Now choose **+6H delay**. The old verdict disappears at once and the panel says
*Inputs changed — run again*: a result is only ever shown for the controls as
they are. Click **Run what-if simulation** again. The blast moves to 12:00,
outside both permitted windows, and the engine rejects it by name:

> *Proposed 12:00 is outside the underground inter-shift blasting windows
> (06:00-07:00, 14:00-15:00).*

Say the line: **constraints are enforced, never learned.** The arithmetic still
tells you what the extra tonnes would have been; the engine tells you the plan is
not allowed, and the two are shown separately because they answer different
questions. Point at the assumptions panel while you are there — every multiplier
is on screen, editable, and labelled as a planner assumption rather than a fitted
coefficient.

## 2:30 — Track A: prospectivity (25 s)

**Click "prospectivity" in the breadcrumb** (Portfolio / production risk ·
prospectivity). The track is part of where you are now, not a separate toggle.

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

**Say:** the score describes the feature values at a cell — it ranks cells, and
it is not a probability that ore is present (it even dips just below zero where
kriging extrapolates). Kriging variance says whether anything was measured
nearby. The layer switcher shows both, and the 50 measured points they were
built from. A cell can be promising *and*
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

## If the network goes

Rehearsed 2026-10-06: a complete pre-flight, then every external service made
unreachable for the backend, the Next server and the browser, and the whole
script walked — **all 24 beats pass**. What changes on screen:

- **Weather** turns SYNTHETIC with a red banner — *"DEGRADED — live upstream
  unavailable. Displayed values are synthetic and must not be read as
  observations."* Say so; it is the N-6 point made live.
- **Imagery layers** draw from the tile cache, labelled **CACHED · fetched
  <date>** — only if `batch tiles` ran the day before.
- **The basemap** is blank: it has no cache. The model layers still draw.
- **"fetch live Sentinel-2"** answers at once with the kriged score and *"Live
  satellite read failed; only the kriged surface is returned."* Leave it unticked.
- **Unchanged:** every forecast, the backtest, the calibration, the model layers,
  Mine twin and its constraint engine, and the fonts (served by the app).

The rehearsal cut the app off from the network rather than the machine, and
restarted the servers — the harsher case. **Before the real demo, do it once
for real:** complete the pre-flight, turn Wi-Fi off, walk the script. Every
failure mode, beat by beat, is in `docs/DEMO_RISKS.md`.

---

## Likely questions

The full set — fifteen hard questions with honest answers and their evidence —
is `docs/JURY_QA.md`. The four most likely:

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
