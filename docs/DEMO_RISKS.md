# Demo risks — what can fail, how it looks, what to do

Step by step through `docs/DEMO.md`. Every "how it shows" entry was either
observed in the cold-start or network-loss rehearsal (2026-10-06) or is read
from the code that produces it; nothing here is a guess about what the screen
might say.

**The rule for all of them:** say what the screen says. Every degraded state in
this product is labelled; none of them is a number made up to fill a gap, so the
honest sentence is always available.

---

## Before the demo

### Setup (once per machine)

| What can fail | How it shows | Fallback |
|---|---|---|
| No `python` command (macOS ships `python3` only) | `command not found: python` | Use `backend/.venv/bin/python` as DEMO.md now says; never a bare `python`. |
| Dependencies not installed | `No module named uvicorn`; `next: command not found` | `backend/scripts/setup_dev.sh`; `(cd frontend && npm ci && npm run build)`. |
| `npm run start` before a build | Next does not start without a production build in `.next` | `npm run build` first, and again after pulling code. |
| No network for the first build | the build fails fetching fonts from Google | Build once on a network; after that the cached build needs none (`docs/CI.md`). |
| Slow clone | the clone took 31 s and 252 s on two runs, same day, same machine (371 MB) | Clone the day before, not the morning of. |

### Freezing (`batch all`, `batch pitch`) and the day before (`batch tiles`)

| What can fail | How it shows | Fallback |
|---|---|---|
| Machine short of memory | the first forecasts fit in ~24 s, then each takes minutes (2026-10-08: 15–22 min a forecast, swap 7.5 of 8 GB, stopped at the time limit). Watch the per-forecast times; swap alone misleads (it grew 1.5 GB on a later run that fitted at full speed) | `scripts/check_memory.sh` before starting — macOS pressure must be *normal*. Mid-run: Ctrl-C, close apps, run `batch all` again; it resumes, skipping what is already written for the date. |
| Machine busy | `batch all` far slower than ~17 min (once: 5.8 hours) | Check `ps -Ao pid,%cpu,comm -r \| head -5` first; run it on a quiet machine. |
| A step fails partway | `batch all` prints `FAIL` / `MISMATCH` and exits 1 | `git checkout -- backend/artifacts data/synthetic`, then `(cd backend && .venv/bin/python -m app.api.batch check)`. The committed set is consistent; its forecast window will be in the past (test:dates says so). |
| The date not carried to demo day | *(fixed, D-042)* — before the fix: `/readyz` 503 forever, forecasts silently refitted for the old window | Check the backend's first line: `[dataset] end date <the frozen date in docs/PITCH_FIGURES.md>`. |
| Regenerated after the freeze | every figure moves under the slides; `batch pitch-check` reports MISMATCH (and CI fails) | Roll back to the committed frozen set (`git checkout -- backend/artifacts data/synthetic`). Regenerate only to re-freeze: all five steps in DEMO.md, and new slides. |
| The frozen dataset fails a check on a **presented** figure | `batch all` succeeds but a suite covering something on screen fails on the new dataset | Do not freeze it. Roll back and fix the cause; a dataset is not chosen because it passes. |
| The frozen dataset fails a check on a **withdrawn** figure | a check on P(shortfall) or the 14-day aggregation fails — as on 2026-10-06, where Balaghat's 14-day distribution came out narrower than independent days | Not a blocker since D-044: the figure is not on screen or in the pitch. Record it as a strict xfail for that end date, assertion unchanged, and quote the failure in the PR. |
| A slow network while fetching tiles | `batch tiles` reports *N tile(s) failed* and exits 1 (it used to die with a traceback and no manifest — fixed) | Run it again: it reuses every tile on disk and fetches only the failed ones (rehearsal: 368 tiles, 60 s). |
| Planetary Computer down while fetching tiles | layers reported skipped | Re-run later. Without a cache the imagery layers are live-only — see network loss below. |

### Pre-flight

| What can fail | How it shows | Fallback |
|---|---|---|
| A port is taken | `check_port.sh` prints the owner's PID, start time and command, and refuses | Stop that process (`kill <pid>`), or `--kill` if it is yours. |
| Artifacts produced by other code or another dataset | `/readyz` 503; mines `warming`, then `ready` after the refit (~25 s a mine, two at a time) — or `stale` with an `identity_mismatch` reason. While it refits, the backend can be too busy to answer telemetry: the console adds a red *"DEGRADED — FastAPI service layer unreachable: … timeout"* beside the blue "Computing" (`docs/evidence/console-forecast-warming.png`) | Let it finish (two to three minutes), or regenerate with `batch all`. Never present while it is warming. |
| Artifacts disagree on the dataset | `/readyz` 503 with `dataset_consistency` naming the odd kind out | Regenerate everything together (`batch all`) or roll back; never one kind alone. |
| No `SESSION_SECRET` | auth routes return 500 | Start the frontend with the line in DEMO.md; the console does not need auth. |
| `test:e2e` fails | names the failed checks (cards, drill-down, backtest, actions) | Do not present a red screen. Read the check; DEF-1-class failures mean the console cannot render data. |
| `test:dates` fails | the forecast window has ended | Re-freeze (DEMO.md, all five steps, new slides) or present with the console's own sentence: *"This forecast's window has already ended."* |
| `test:map` fails, `--pc-blocked` passes | Planetary Computer unreachable from here | The demo runs from the tile cache, labelled CACHED; say so. |
| Both map checks fail | no live imagery and no cache | `batch tiles` again; or present Track A on the model layers only (they do not need Planetary Computer). |

---

## During the demo

| Beat | What can fail | How it shows | Fallback |
|---|---|---|---|
| 0:00 frame | — | The thesis is static text. | — |
| 0:20 portfolio | Backend still warming | cards read `computing…`, blue, with an ETA | Wait; it is a designed state, not an error. Pre-flight should have caught it. |
| 0:20 portfolio | Backend down | every panel reads **unavailable** with the reason; no number invented | Restart the backend; meanwhile this *is* the N-6 demonstration. |
| 0:45 conditions | NASA POWER / Open-Meteo unreachable | rainfall and temperature switch from LIVE to **SYNTHETIC** fallback values, under a red *"DEGRADED — live upstream unavailable. Displayed values are synthetic and must not be read as observations."*; `+ evidence` says the same | Say: weather degrades honestly; the operational tiles were always synthetic and say so. |
| 1:05 daily calibration | Calibration artifact stale (regenerated without the calibration) | "Calibration unavailable: The calibration was measured on a different model…" beside the chart, and no figure on the landing band | Regenerate with `batch all` — calibration is part of it. |
| 1:05 the withdrawn probability | A judge asks where P(shortfall) went, or has read PRD B-6 | The tile where it was says *"Withdrawn while under validation"* and links to the finding; there is no number to defend | Answer from `JURY_QA.md` Q16: we found it unsound ourselves, pre-registered a fix, it failed, so it is off the screen until one passes. Never quote a figure for it from memory. |
| 1:05–1:35 figures | The script's numbers are not the screen's | Prevented by the freeze: DEMO.md, JURY_QA.md and the slides quote `docs/PITCH_FIGURES.md`, and `batch pitch-check` (and CI) fail if it and what is served differ. It happened before the freeze — the rehearsal served 6 Oct (MAPE 11.00%) while the script said 11.67% | Run `batch pitch-check` in the pre-flight; if it fails, the slides are wrong, not the screen. |
| 1:35 backtest | Opened a non-pilot mine | "Validated on the pilot mine (Balaghat)" with a link | Designed state; click through to Balaghat. |
| 2:05 actions | Expecting a rejected action | The panel reads *"No candidate violated a constraint this run."* | Do not promise a rejection here; the next beat shows one. |
| 2:20 Mine twin | Forgetting to run again | *(fixed)* changing a control now clears the old verdict at once and says *"Inputs changed — run again"*; before the fix the old "passed" stayed on screen | Click **Run what-if simulation** after every change. |
| 2:20 Mine twin | Backend down | "Simulation unavailable" with the service's answer (e.g. *"The scenario service answered 503."*); no verdict | Restart the backend. |
| 2:30 Track A | Planetary Computer unreachable | the three imagery layers draw from the tile cache, labelled **CACHED · fetched <date>**; without a cache they are listed **unavailable** | Use the model layers (score, uncertainty, measured points); they need no external service. |
| 2:30 Track A | Basemap (ESRI) unreachable | the map background is **blank** (0 of 16 basemap tiles); the model layers still draw over it | Say: the basemap is context, not data; the layers on it are served locally. |
| 2:30 Track A | "fetch live Sentinel-2" ticked with no network | answers at once with the kriged score and *"Live satellite read failed; only the kriged surface is returned."* — no feature values | Leave it unticked offline; the stored features score instantly. |
| 2:55 close | — | Export CSV is generated in the browser from what is on screen. | — |
| any | Laptop sleeps, backend killed | console panels go **unavailable** | Keep the machine awake; restart the backend (1–2 s to ready on matching artifacts). |
| any | Projector at an odd resolution | every route is captured at 375, 768, 1280 and 1920 px (`frontend/tools/capture.js`) | Use browser zoom; nothing depends on a fixed width. |

---

## Network loss

Rehearsed 2026-10-06 after a complete pre-flight: every external service made
unreachable for the backend (`NAKSHATRA_OFFLINE=1`, dead proxies), the Next server
(its upstreams at the discard port, DNS for localhost only) and the browser
(Chrome resolving only localhost), the servers restarted that way, and the whole
script walked with `tools/demo-walk.js`. **All 24 beats passed.**

| Survives | Does not |
|---|---|
| every forecast, the backtest and the calibration (artifacts) | live weather — SYNTHETIC fallback, red DEGRADED banner |
| the three model map layers | the ESRI basemap — blank, no cache |
| the three imagery layers, **from the tile cache**, labelled CACHED | live Sentinel-2 scoring — kriged score only, said so |
| Mine twin and its constraint engine | STAC scene metadata — `/satellite` answers `is_live: false` with the error |
| the fonts — served by the app (`npm run test:fonts` passes offline) | sign-in (Supabase) — fails closed; not needed for the console |

**Before a real demo, do it for real once:** complete the pre-flight, turn Wi-Fi
off, and walk the script. The rehearsal above isolated the app's processes from
the network; it could not switch off this machine's, and a real cut also loses
anything a process held in memory — which the rehearsal approximated by
restarting the servers offline, the harsher case.
