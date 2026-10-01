# Calibration of the 14-day cumulative distribution — a negative result

**Headline: the calibration was built, measured, and not shipped.** On 816
held-out windows it did not beat `main`. The model in this repository is
unchanged. What shipped is the instrument that measured it, the pre-registered
rule it was judged by, and the corrected claims below.

Decision record: `docs/DECISIONS.md` D-040 and its addendum.
Instrument: `backend/measure_cumulative_calibration.py`.
Mechanism, for reference only: commits `dee2dd3` and `cef2801` on
`ml/cumulative-calibration`.

---

## What was wrong, and what was attempted

Daily prediction intervals are calibrated. The **14-day total** is not: its 80%
band covers less than 80% of outcomes, and too many totals land in the outer
tails. Daily coverage cannot see this, because the error is in how days *combine*.

The attempt was a single scalar per mine — the share `rho` of each day's
standardised shock that is common to the whole window:

```
z_h = sqrt(1 - rho) * r_h + sqrt(rho) * e        e drawn once per path
```

The weights' squares sum to one, so **every day's marginal distribution is left
exactly as the model reported it**. Only the dependence between days changes.
That property is what made the approach worth trying — widening the daily sigmas
would have bought cumulative coverage by breaking daily coverage that is already
correct — and it is asserted as a test, not assumed
(`test_calibration_harness.py` covers the instrument; the invariance test lived
with the mechanism).

Fitting it honestly required a **third data block**. Measured during
construction: on origins inside the conformal slice the cumulative band covered
0.852 — too *wide* — while on genuinely held-out origins the same code covered
0.705. The only difference is whether the conformal widths and residual series
were fitted on the origins being scored. A loading fitted on the conformal slice
reads the deficiency as a surplus and corrects the wrong way.

---

## The measurement

816 windows, **24 non-overlapping origin dates**, 2025-10-15 to 2026-09-02, all
ten mines, every grade. Step 14 days so a window does not overlap the next —
that is what makes resampling whole origin dates a valid bootstrap. 2000
resamples, seed 20260921.

The window starts in October 2025 because the calibration block is not viable
before then: at a 2025-07-01 origin 0 of 10 mines calibrate, at 2026-01-01 all 10
do.

### Why the intervals are wide

**Design effect 2.49x. Effective sample 328 of 816 windows.** A date's windows
share weather and equipment state, so they do not count as independent. A
binomial interval would have been about 1.6x too narrow and would have made
several of the comparisons below look conclusive.

### Four arms, identical windows

| arm | coverage (nominal 0.80) | outer-tail frequency (nominal 0.10) | PIT sd (uniform 0.2887) |
|---|---|---|---|
| `main` b045369 | 0.738 [0.700, 0.777] | 0.165 [0.130, 0.202] | 0.3098 |
| split only, `rho = 0` | 0.705 [0.654, 0.753] | 0.172 [0.135, 0.211] | 0.3131 |
| split + pooled loading | 0.740 [0.701, 0.776] | 0.152 [0.124, 0.183] | 0.3058 |
| split + per-mine loading | 0.767 [0.732, 0.803] | 0.125 [0.101, 0.151] | 0.2950 |

### The loading worked; the change did not

Paired on identical windows, as distance to nominal (positive = closer):

| comparison | coverage | tails | PIT dispersion |
|---|---|---|---|
| `rho = 0` -> pooled | **+0.0355 [0.011, 0.066]** | **+0.0196 [0.004, 0.047]** | +0.0073 [0.002, 0.015] |
| `rho = 0` -> per-mine | **+0.0625 [0.032, 0.094]** | **+0.0466 [0.021, 0.077]** | +0.0181 [0.005, 0.025] |
| pooled -> per-mine | +0.0270 [0.005, 0.049] | +0.0270 [0.010, 0.045] | +0.0108 [−0.0005, 0.016] |

Against **main**, which is the comparison that decides:

| comparison | coverage | tails | PIT dispersion |
|---|---|---|---|
| main -> split only | −0.0331 [−0.071, 0.005] | −0.0061 [−0.047, 0.031] | −0.0033 [−0.015, 0.008] |
| main -> split + pooled | +0.0025 [−0.037, 0.042] | +0.0135 [−0.020, 0.045] | +0.0040 [−0.008, 0.016] |
| main -> split + per-mine | +0.0294 [−0.006, 0.063] | **+0.0404 [0.012, 0.071]** | **+0.0148 [0.003, 0.025]** |

**The split costs what the loading recovers.** The configuration selected by the
pre-registered rule nets to nothing measurable against main, so it was declined.

Daily metrics on the same windows, which the loading cannot touch because it never
enters `predict`: MAPE 10.000% -> 10.050%, MAE 8.49t -> 8.40t, daily coverage
0.7607 -> 0.7512. The small daily-coverage cost is the split's.

### The per-mine loading: recorded, not adopted

It is the only arm that beat main with intervals excluding zero. It was rejected
because D-040 fixed **PIT dispersion** as the deciding statistic between pooled
and per-mine before any of this was visible, and there per-mine gained +0.0108
with an interval of [−0.0005, 0.0155] — not strictly above zero. It missed by
0.0005.

Adopting it now, on the strength of metrics the rule did not nominate, is exactly
what the rule exists to prevent. It goes to the backlog as a **fresh
pre-registered replication on an independent synthetic seed** — not these
origins, because a result selected on a sample cannot be confirmed on it — judged
against main.

---

## Corrected claims: 0.812 is one mine on one window

`0.812` daily interval coverage is **Balaghat alone**, on the committed 150-day
backtest artifact. It is not the model's coverage, and the pilot is not a
flattering choice on the cumulative metric — it is one of the worse mines.

Measured on main over the 24 origin dates above:

### Daily interval coverage, nominal 0.80

| mine | n | coverage | 95% CI | MAPE |
|---|---|---|---|---|
| MOIL-BAL-01 (pilot) | 384 | 0.792 | [0.714, 0.857] | 9.99% |
| MOIL-BEL-10 | 288 | 0.750 | [0.677, 0.819] | 12.15% |
| MOIL-BHR-02 | 384 | 0.776 | [0.719, 0.828] | 10.17% |
| MOIL-CHK-06 | 384 | 0.714 | [0.643, 0.784] | 11.43% |
| MOIL-DON-05 | 384 | 0.724 | [0.648, 0.799] | 11.22% |
| MOIL-GUM-09 | 288 | 0.809 | [0.760, 0.854] | 7.80% |
| MOIL-KAN-08 | 288 | 0.799 | [0.736, 0.861] | 7.85% |
| MOIL-MAN-07 | 288 | 0.733 | [0.646, 0.809] | 9.71% |
| MOIL-TIR-04 | 288 | 0.792 | [0.740, 0.840] | 8.63% |
| MOIL-UKW-03 | 288 | 0.733 | [0.663, 0.795] | 10.11% |
| **portfolio** | **3264** | **0.761** | **[0.733, 0.786]** | **10.00%** |

**The portfolio-wide interval excludes 0.80.** Daily coverage is below nominal
across the ten mines taken together, even though the pilot's own figure on its
own window is above it.

### 14-day cumulative coverage, nominal 0.80

| mine | n | coverage | 95% CI | outer tails |
|---|---|---|---|---|
| MOIL-BAL-01 (pilot) | 96 | 0.667 | [0.521, 0.802] | 0.250 |
| MOIL-BEL-10 | 72 | 0.542 | [0.389, 0.694] | 0.264 |
| MOIL-BHR-02 | 96 | 0.781 | [0.646, 0.896] | 0.146 |
| MOIL-CHK-06 | 96 | 0.760 | [0.666, 0.854] | 0.156 |
| MOIL-DON-05 | 96 | 0.625 | [0.490, 0.760] | 0.271 |
| MOIL-GUM-09 | 72 | 0.778 | [0.667, 0.875] | 0.111 |
| MOIL-KAN-08 | 72 | 0.847 | [0.736, 0.944] | 0.069 |
| MOIL-MAN-07 | 72 | 0.792 | [0.667, 0.903] | 0.097 |
| MOIL-TIR-04 | 72 | 0.722 | [0.569, 0.847] | 0.181 |
| MOIL-UKW-03 | 72 | 0.903 | [0.833, 0.958] | 0.056 |
| **portfolio** | **816** | **0.738** | **[0.700, 0.777]** | **0.165** |

Per-mine cumulative coverage spans 0.542 to 0.903. Reporting one mine's figure as
the system's would be misleading in either direction depending on which mine was
picked.

**So the honest statement is:** daily intervals are roughly calibrated on the
pilot and run below nominal portfolio-wide (0.761 [0.733, 0.786]); the 14-day
cumulative distribution is too narrow portfolio-wide (0.738 [0.700, 0.777],
tails 0.165 against 0.10) and this release does not fix it.

---

## Reproducing

Quiet environment, one process, no parallel runs. Roughly 9 minutes per arm.

```bash
cd backend
python measure_cumulative_calibration.py run --span 340 --step 14 --out main.jsonl
python measure_cumulative_calibration.py analyse --branch main.jsonl
```

`run` emits one record per window and forms no verdict. `analyse` is the only
place a verdict is formed, and it reads records it did not produce. To reproduce
the four-arm table the mechanism has to be restored from `dee2dd3`/`cef2801`,
which is what the backlog replication will do against a fresh seed.
