# Jury questions — the hard ones, answered honestly

The sixteen questions a MOIL or ISRO jury is most likely to ask, and the ones we
would least like to be asked. Each answer is the honest one, with the evidence
behind it.

**The figures come from `docs/PITCH_FIGURES.md`.** Each one quoted here carries
a hidden `pitch:` key, and `backend/test_pitch_figures.py` fails if it differs
from that file, which fails if *it* differs from what the API serves. The file
holds the dataset frozen for the demo: actuals to 7 October 2026, forecast
window 8–21 October.

---

### 1. Can your system detect manganese underground from satellite data?

**No, and nobody can at these depths.** Balaghat is worked at roughly 383 m; no
optical, thermal or conventional SAR sensor images ore there. Every satellite
input the problem statement names — rainfall, soil moisture, vegetation index,
land surface temperature — is a surface or atmospheric signal. We use satellite
data for what it measures: weather, and surface geology for *prospectivity*
(Sentinel-2 band ratios, terrain). The problem statement's "sub-surface
indicators" come from drilling and geophysics, which is why the ingestion
contract has borehole, assay and lithology entities.

The console says so before it shows a number, and the claim was removed from the
code wherever it appeared, including an API description and a chatbot reply.

*Evidence:* `SIH26009-01-PRD.md` §2.2; `docs/READINESS.md` §3.1 (guardrail (a));
the console's thesis line.

### 2. Are your outputs UNFC-classified reserves?

**No.** In India a number called a "reserve" carries legal meaning under the UNFC
framework and the Minerals (Evidence of Mineral Contents) Rules, 2015, and needs
a competent person's assessment. This system produces a *prospectivity ranking*
with uncertainty, never a reserve class — PRD non-goal 1. A hardcoded "UNFC 111
(Proved Mineral Reserve)" and claims of upgrading UNFC 122 to 111 were found and
removed in earlier sweeps; the score itself is labelled "a ranking, not a
probability of ore".

*Evidence:* PRD §2.4 and §4 (non-goal 1); `docs/READINESS.md` §3.1 (guardrail (b)).

### 3. Is the production data real?

**No — and every tile says so.** MOIL's production, equipment and blasting
records are proprietary and no dataset ships with this problem statement (PRD
§8.2). We published the schema MOIL's data maps onto (ingestion contract
1.0.0), and generate operational data to it, calibrated to MOIL's published
~1.1–1.3 Mt a year. Every generated row carries `is_synthetic=true`; the UI
badges it SYNTHETIC. Weather and imagery are real.

**What follows from that, which we also say:** the forecaster's margin over its
baseline is partly a property of the generator, so it shows the pipeline is
sound, not how it would perform on MOIL's operations.

*Evidence:* `docs/INGESTION_CONTRACT.md`; `data/synthetic/README.md`;
`docs/READINESS.md` §5.

### 4. Are your prediction intervals calibrated?

**The daily bands are close to calibrated, and we measured how close.** We do
not call them calibrated.
- **On this dataset:**
  - On Balaghat's backtest the 80% daily interval holds
    **0.806**<!-- pitch:pilot.daily_coverage -->.
  - On the larger calibration backtest (24 origin dates) it holds
    **0.802**<!-- pitch:balaghat.daily_coverage -->
    **[0.742, 0.862]**<!-- pitch:balaghat.daily_coverage_ci --> for Balaghat.
  - Across all ten mines it holds
    **0.785**<!-- pitch:portfolio.daily_coverage -->
    **[0.761, 0.808]**<!-- pitch:portfolio.daily_coverage_ci -->.

  Both intervals include 0.80.
- **On the dataset before it** (actuals to 20 September), the portfolio figure
  was below nominal, an interval that excluded 0.80. So across windows the bands
  run at or slightly under their nominal coverage.

The console shows the portfolio and the mine beside the bands, with a verdict
computed from the interval, not written by hand.

**The 14-day total is a different matter, and it is why the probability of
shortfall is off the screen** (Q16). Its figures are measured and published in
`docs/QUANTILE_CROSSING.md`, but we do not quote them in the pitch: they describe
an aggregation we have found to be unsound.

*Evidence:* `docs/CALIBRATION.md`; `docs/DECISIONS.md` D-040, D-044;
`backend/artifacts/calibration/cumulative_coverage.json` (`daily`).

### 5. Your earlier version reported an AUC of 0.98. Why is it 0.85 now?

**Because 0.98 measured leakage, not geology.** The earlier pipeline's
"spectral" features were not spectral: each was a linear function of proximity
to a list of coordinates named `KNOWN_FAULTS` — which were the MOIL mine
locations, i.e. the labels. The model learned where the answers were. Its
training script also turned a failed AUC computation into a reported 1.0.

The rebuilt model uses real Sentinel-2 band ratios and SRTM terrain only; a test
enforces that no feature is a function of distance to a mine. It is validated
leave-one-mine-out — an entire deposit held out at a time, the question a
geologist asks: *would this have found the next deposit?* That gives
**0.85**<!-- pitch:track_a.auc -->. (Under a random 5-fold split the same model
scores **0.82**<!-- pitch:track_a.random_split -->, lower, so the reported figure
is not the flattering one.) The leaked metrics files were deleted, including one
served publicly.

*Evidence:* `docs/TRACK_A.md`; `docs/READINESS.md` §3.1 (sections on
`03_train_model.py` and the shipped metrics files).

### 6. Is 0.85 good?

**It is honest, and it is softer than it looks.** The 95% CI is
**[0.72, 0.95]**<!-- pitch:track_a.auc_ci --> on ten deposits — ten positives
cannot support a tighter claim. Spectral features alone reach
**0.60**<!-- pitch:track_a.spectral_only -->, terrain alone
**0.67**<!-- pitch:track_a.terrain_only -->, slope alone
**0.51**<!-- pitch:track_a.slope_only --> (chance),
and the top feature is elevation: mines sit on flat ground, so part of what the
model learns is where mines are built. Four of ten deposits score below 0.35 and
Tirodi (0.018) is essentially missed. GSI lithology, the feature most likely to
carry real geology, was unreachable and is omitted, not substituted.

*Evidence:* `docs/TRACK_A.md` (ablation table, per-deposit scores).

### 7. What is live, and what is cached or precomputed?

**Live:** weather from NASA POWER and Open-Meteo; Sentinel-2 scene metadata from
Earth Search STAC; imagery tiles from Microsoft Planetary Computer; the ESRI
basemap. Each is labelled LIVE only when it actually answered.

**Precomputed and stored:** every forecast, the backtest and the calibration
figure — computed by a batch job, committed, and checked against the running
code's identity before they are served, so an old model's numbers cannot appear
under a new label. Precomputing is deliberate: no forecast is ever computed
inside a request.

**Cached:** the imagery tiles, fetched ahead of the demo into a local cache the
map falls back to — labelled "cached · fetched <date>", never LIVE.

**With the network gone** — rehearsed, not assumed: every external service cut
off, the whole demo walked, all 24 beats pass. Forecasts, backtest, calibration,
the model map layers, the what-if calculator and the fonts are unaffected;
weather switches to labelled SYNTHETIC fallback under a red DEGRADED banner;
imagery draws from the cache labelled CACHED; the basemap goes blank.

*Evidence:* `docs/DEMO.md` (network loss); `docs/DEMO_RISKS.md`; `docs/CI.md`.

### 8. How do you know the forecaster beats a baseline honestly?

**Rolling-origin backtest, refitting at every origin, scoring only held-out
days, against a seasonal-naive baseline on the same origins and targets.** Pilot:
MAPE **11.50%**<!-- pitch:pilot.mape_model --> vs
**12.85%**<!-- pitch:pilot.mape_baseline -->; across ten mines,
**10.22%**<!-- pitch:portfolio.daily_mape -->. On this dataset the pilot's
margin is modest, and we say so rather than quote a better window. A test corrupts every
post-origin actual tenfold and asserts the forecast is bit-identical — so the
model provably cannot see the future. Getting there took four attempts, and the
two that failed are published.

*Evidence:* `docs/BACKTEST.md`; `backend/test_track_b.py`; on screen at 1:35.

### 9. Would your recommendations ever propose something illegal or impossible?

**They are checked against hard constraints before they are shown, and removed —
not downgraded — if they fail.** The two failures the PRD names are tested:
blasting at 02:30 against the 06:00–18:00 window, and a 128 km overnight
relocation that needs 11.1 h against 10 h. On the Mine-twin screen a +6 h blast
delay is rejected by name ("outside the underground inter-shift blasting
windows"). Constraints are enforced, never learned.

**Also say:** in the console, with the current synthetic inputs, no candidate
violates a constraint at any mine — so the rejection list there is empty, and the
panel says so rather than going quiet.

*Evidence:* `backend/app/ml/constraints.py`; `backend/test_track_b.py`;
demo 2:05 and 2:20.

### 10. Are the corrective actions optimised?

**No — they are templated candidates, constraint-checked, each with its expected
effect and stated assumptions.** Schedule adjustment is an hours delta, not a
re-sequenced schedule; blast rescheduling moves a blast to the next legal window;
equipment redeployment checks feasibility, but its source unit is a placeholder.
Scenario comparison and accept/reject capture are not built (PRD §10 defers
them; the audit log behind accept/reject, N-7, is the one Required gap).

*Evidence:* `docs/READINESS.md` §2.3 (C-1–C-7), §2.5 (N-7).

### 11. Why Sentinel-2 and not Indian data — Resourcesat, CartoDEM, Bhuvan, MOSDAC?

**Honest answer: availability, not preference.** Sentinel-2 L2A and Copernicus
DEM are reachable programmatically through Planetary Computer with no account,
which made a reproducible pipeline possible in the time available. The PRD lists
Resourcesat LISS-III/AWiFS via Bhoonidhi, CartoDEM, MOSDAC and Bhuvan as sources;
**none is integrated**. Adding them is a data-access task, not a redesign: the
features are band ratios and terrain, which LISS-III and CartoDEM provide. An
earlier version claimed "ISRO MOSDAC / BHUVAN ACTIVE" on the landing page with
nothing behind it; that claim was removed.

*Evidence:* PRD §8.3; `docs/DECISIONS.md` D-038.

### 12. What happens when MOIL gives you real data?

**Rows land in the same schema with `is_synthetic: false`, and the SYNTHETIC
badges become measured ones.** The forecaster, backtest, constraint engine and
provenance chain do not change — that is the point of publishing the contract
first. **What does not exist yet:** a persistence layer behind the contract (rows
validate but are not stored), so a real integration needs that first.

*Evidence:* `docs/INGESTION_CONTRACT.md`; `docs/READINESS.md` §2.1 (A-1).

### 13. Could this run on MOIL's premises?

**Mostly.** The models, constraint engine, kriging and contract are local, and
once prepared the demo runs with the network gone (question 7). **Sign-in uses
Supabase, an external service** — the one dependency that conflicts with
on-premise (N-5); the console itself does not need it. Weather and imagery are
external by nature and degrade with a stated reason.

*Evidence:* `docs/READINESS.md` §2.5 (N-5); `docs/DEPLOYMENT.md`.

### 14. How do you stop fabricated numbers reaching the screen?

**Structurally, and by checking the rendered page.** Every number in the console
goes through one component that refuses a value without a provenance envelope.
A guard walks all 16 routes in a real browser and fails on any data-shaped value
that is not attributed, and again with the backend stopped, where nothing
data-shaped may render at all. A compile-time lint rejects numeric literals
rendered as data. All of it runs on every pull request.

**And the honest part:** this project has needed many sweeps — nine fabrication
clusters before Phase 8, six in it, one at the last review, and five more in this
readiness pass, all in legacy surfaces no screen relied on: a fixed "evaluated"
timestamp, a "Ministry compliance report" asserting an approval nobody gave, a
health endpoint naming a model that does not exist, two endpoints scoring
invented inputs, and a synthetic tile titled "LIVE". All five are fixed, and a
test now inspects the API's route table itself for that class, because checking
the rendered page had not caught them.

*Evidence:* `docs/READINESS.md` §3; `docs/CI.md`; `frontend/tools/provenance-guard.js`.

### 15. Your demo depends on things you prepared. How do we know it is not staged?

**Every number on screen is read from an artifact or a live service, with its
source one click away, and the preparation is a documented command anyone can
re-run.** Forecasts are regenerated the day before for the current date and are
refused if they were produced by different code. The backtest and calibration are
re-measured by the same command. The demo script has been walked word for word
from a fresh clone, and its every beat is executed by a script that fails if the
product no longer does what the script says.

*Evidence:* `docs/DEMO.md`; `frontend/tools/demo-walk.js`; `docs/DECISIONS.md`
D-041, D-042.

---

### 16. Where is the probability of shortfall? The PRD asks for one.

**We withdrew it ourselves, because we found it unsound and could not say in
which direction it was wrong.**

- **What it was:** P(14-day production < plan), per grade. It was built by
  resampling blocks of the model's one-day errors, on the premise that those
  errors carry over from day to day.
- **What we found** (`docs/QUANTILE_CROSSING.md`, D-043):
  - **The premise does not hold.** Each grade's errors barely persist from one
    day to the next: lag-1 correlation 0.02–0.30.
  - **The apparent persistence came from interleaving the grades.** Same-day
    correlation between them stood in for persistence across days.
  - **It fails sanity checks on all eight datasets we tried.** The 14-day spread
    came out narrower than treating the days as independent on five, it was
    saturated on two, and a single error could move a mine's scale by up to
    91%.
- **What we did:**
  - We pre-registered a fix and measured it against the shipped model on two
    datasets. It failed its rule, so nothing that serves changed.
  - Then we took the figure off the screen rather than label it. A label cannot
    tell a planner which way to correct 0.97.
- **What is on screen instead:**
  - **Expected shortfall in tonnes, summed over grades.** It is a mean, so it
    does not depend on how the days correlate, and a test checks that it equals
    that dependence-free expectation.
  - **The daily 80% bands and their measured calibration** (Q4).
- **What is being tested next** (its own pre-registration, written before it
  measures anything). Two candidates, against the shipped construction on the
  same held-out origins:
  - (a) the correlation of errors across horizons 1–14 within each forecast;
  - (b) calibrating the 14-day total directly, by split conformal on held-out
    totals, which needs no assumption about how days depend on each other.

  To pass, a candidate must:
  - get closer to nominal on 14-day coverage and tails, with cluster-bootstrap
    intervals;
  - pass the eight-date sanity checks, so that today's expected failures turn
    into passes;
  - not saturate.

  If neither passes, the probability stays off the screen and we say so.

*Evidence:* `docs/QUANTILE_CROSSING.md`; `docs/DECISIONS.md` D-043, D-044;
`backend/test_track_b_dates.py` (the expected failures).

---

### If a question is not here

Say what is measured and what is not, and where the number comes from. The
weakest answer to any question about this project is one that is more confident
than `docs/READINESS.md`.
