# Jury questions — the hard ones, answered honestly

The fifteen questions a MOIL or ISRO jury is most likely to ask, and the ones we
would least like to be asked. Each answer is the honest one, with the evidence
behind it.

**The figures come from `docs/PITCH_FIGURES.md`.** Each one quoted here carries
a hidden `pitch:` key, and `backend/test_pitch_figures.py` fails if it differs
from that file, which fails if *it* differs from what the API serves. Today the
file holds the committed dataset (actuals to 20 September), whose forecast
window has passed: these answers are right about that dataset, and the
demo-window freeze will update them — the test will not pass until it does.

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

**On the pilot mine, roughly; across the portfolio, no — they are too narrow, and
we measured by how much.** The 80% daily interval holds
**0.812**<!-- pitch:pilot.daily_coverage --> on Balaghat's backtest, but
**0.761**<!-- pitch:portfolio.daily_coverage -->
**[0.733, 0.786]**<!-- pitch:portfolio.daily_coverage_ci --> across all ten mines —
the confidence interval excludes 0.80. For the 14-day total, which P(shortfall)
is computed from, coverage is **0.738**<!-- pitch:portfolio.cumulative_coverage -->
**[0.700, 0.777]**<!-- pitch:portfolio.cumulative_coverage_ci -->, with a share of
**0.165**<!-- pitch:portfolio.cumulative_tails --> of real totals in the outer
tails against a nominal 0.10. Per mine it ranges from 0.542 to 0.903; Balaghat's
own 14-day figure is **0.667**<!-- pitch:balaghat.cumulative_coverage -->. On the
dataset regenerated for 6 October the same measurement gives 0.683 — below
nominal on both windows. So P(shortfall) is more confident than it has earned.

**And one more, found while freezing the pitch dataset:** on the 6 October
dataset Balaghat's 14-day distribution came out *narrower* than treating the days
as independent — one extreme standardised residual shrinks the rest. That is
being fixed before any demo dataset is frozen; it is why the committed figures
are still the 20 September ones.

We tried a fix (a common-factor loading), pre-registered the rule it had to pass
before reading the result, and declined it when it did not beat the model as
shipped. The console now shows the calibration figure beside every P(shortfall).

*Evidence:* `docs/CALIBRATION.md`; `docs/DECISIONS.md` D-040;
`backend/artifacts/calibration/cumulative_coverage.json`.

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
MAPE **11.67%**<!-- pitch:pilot.mape_model --> vs
**14.81%**<!-- pitch:pilot.mape_baseline -->; across ten mines,
**10.00%**<!-- pitch:portfolio.daily_mape -->. A test corrupts every
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

### If a question is not here

Say what is measured and what is not, and where the number comes from. The
weakest answer to any question about this project is one that is more confident
than `docs/READINESS.md`.
