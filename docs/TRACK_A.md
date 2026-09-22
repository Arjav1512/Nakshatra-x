# Track A — Prospectivity, Made Honest

**Model:** `track-a-gbt-lomo-v1` · **Validation:** leave-one-mine-out · **Date:** 2026-09-21
PRD **A-2, A-3, A-4, A-5, A-7**

---

## The headline

**Leave-one-mine-out AUC = 0.85, 95% CI [0.723, 0.95].**

The previous pipeline reported **~0.98**. That number measured leakage, not geology.

## What was wrong

`AI/scripts/features.py` computed every "spectral" feature as a linear function of `proximity`:

```python
KNOWN_FAULTS = [(21.83, 80.19), (21.86, 80.26), ...]   # the MOIL mine coordinates
proximity    = (15 - min(dist_to_fault_km, 15)) / 15
iron_oxide   = 0.30 + 0.45 * proximity + ...
ferrous      = 0.22 + 0.38 * proximity + ...
```

The positive labels are those same mines. **The features encoded the target**, and no raster was ever read. The effect was directly measurable:

```
at a mine   (21.83, 80.19): dist 0.0 km   → p = 0.995
off-mine    (20.60, 78.60): dist 89.5 km  → p = 0.238
```

The frontend's map-click route did the same thing in closed form: `baseProb = 0.72 + proximityFactor * 0.22`.

## What replaced it

| Feature | Source | Real? |
|---|---|---|
| `iron_oxide_ratio` (B04/B02) | Sentinel-2 L2A surface reflectance | ✅ measured |
| `ferrous_ratio` (B11/B08) | Sentinel-2 L2A | ✅ measured |
| `clay_alteration_ratio` (B11/B12) | Sentinel-2 L2A | ✅ measured |
| `ndvi` ((B08−B04)/(B08+B04)) | Sentinel-2 L2A | ✅ measured |
| `swir_ratio_norm` | Sentinel-2 L2A | ✅ measured |
| `elevation_m` | SRTM 30 m | ✅ measured |
| `slope_deg` | SRTM 30 m, finite difference **in metres** | ✅ measured |
| ~~lithology~~ | GSI Bhukosh | ❌ **unreachable — omitted, not substituted** |

50 points (10 mines + 40 sampled negatives ≥20 km away), each read from a real
cloud-free scene (max cloud cover 1.0%). Pixels come from 5×5 windowed reads of
Cloud Optimized GeoTIFFs over HTTP — no scene downloads.

**The leakage rule, enforced by test:** no feature may be a function of distance
to a known mine, and **latitude and longitude are not features**. Negatives are
spatially separated from positives by construction, so feeding coordinates in
would let the model rediscover the label from position.

```
✓ No feature is a proxy for distance to a mine (strongest |r| = 0.22 on 'swir_ratio_norm')
```

Against near-1.0 for the old proxies.

## Why leave-one-mine-out

Points near the same deposit share geology. A random split can put samples from
one mine on both sides, scoring the model on ground it has effectively seen.
LOMO holds out an **entire deposit** — the model must identify a mine it has
never been shown. That is the question a geologist actually asks: *would this
have found the next deposit?*

| Held-out mine | Score | Percentile vs its fold's negatives |
|---|---|---|
| Bharweli | 0.922 | 100% |
| Ukwa | 0.833 | 100% |
| Beldongri | 0.827 | 75% |
| Balaghat | 0.793 | 100% |
| Gumgaon | 0.388 | 100% |
| Dongri Buzurg | 0.331 | 100% |
| Chikla | 0.323 | 75% |
| Kandri | 0.182 | 75% |
| Mansar | 0.023 | 75% |
| Tirodi | 0.018 | 50% |

Four of ten deposits score below 0.35 — Tirodi is essentially missed. That is
the real behaviour of this model on this data.

## ⚠️ Where the signal actually comes from

An ablation, because the headline number alone would be misleading:

| Feature set | LOMO AUC |
|---|---|
| All 7 features | **0.85** |
| Spectral only (5) | **0.60** ← the geological claim |
| Terrain only (2) | 0.665 |
| Slope only (1) | 0.511 ← chance |

**The spectral indices are weak on their own.** Class separation is small
(Cohen's *d*: iron-oxide 0.24, ferrous 0.01, NDVI 0.04), while terrain separates
better (elevation 0.59, slope 0.65). Mines sit on flat ground — positives
average 1.58° slope against 3.70° for random points — so part of what the model
learns is where mines are *built*, not where ore *is*.

It is not simply a mine-site detector: slope alone is chance-level, and neither
family reaches 0.85 without the other, so the result depends on combinations.
But the geological signal is thinner than 0.85 suggests, and **GSI lithology —
the feature most likely to carry real geology — is the one we could not
obtain.**

With 10 positives the interval is wide: **[0.723, 0.95]**. The point estimate
should not be quoted without it.

For contrast, the same model under a random 5-fold split scores 0.82 — *lower*
than LOMO here, because with 10 positives fold composition dominates. Reported
so nobody assumes the random-split number is the flattering one.

## Per-cell uncertainty (A-4)

PRD A-4 requires "per-cell **uncertainty**, not a bare score", and the
architecture specifies kriging variance. A classifier's probability describes
the *feature values* at a cell; it says nothing about whether any measurement
exists nearby. Kriging variance does.

```
Balaghat (observed)    est 0.914   sd 0.000
5 km from Balaghat     est 0.890   sd 0.178
study-area corner      est 0.074   sd 0.331
```

A cell can carry a high score *and* high uncertainty — "looks promising, but we
have little data here" — which is what a geologist needs before committing a rig.

Exponential variogram fitted to the empirical semivariance; ordinary kriging
solved per cell. All distances in **metres** via a local equal-area projection,
never degrees (PRD §8.4). Plain numpy.

## Drill targets (A-5)

A-5 requires ranking **with the evidence that drove each ranking**. Targets are
ordered by kriged prospectivity and each carries its score, uncertainty and the
interpolation basis.

Expected information gain — the architecture's "★ differentiator" — is a `[P]`
proposal, **not a requirement**, and is reported as a secondary column rather
than the ranking key (`DECISIONS.md` D-009). It answers a different question:
where would a hole *teach* you most, as opposed to where ore is most likely.

## Guardrails in the response

Every Track A response carries both:

- **No subsurface detection** (PRD §2.2) — inputs are surface reflectance and terrain.
- **Not a reserve** (PRD §2.4) — output is `prospectivity_score` for a qualified person.

Track A output goes straight to the dashboard and does not pass through the
Track B decision layer.

## Reproducing

```bash
cd backend
python ../AI/scripts/07_build_honest_dataset.py --negatives 40   # real satellite reads
python ../AI/scripts/08_train_honest_model.py
python test_track_a.py
```

Feature reads are cached under `AI/outputs/feature_cache/`, so re-runs are fast.

## Honest summary

| Requirement | Status |
|---|---|
| A-2 satellite surface indicators | **real measurements** (lithology absent) |
| A-3 prospectivity surface | **fully** |
| A-4 per-cell uncertainty | **fully** — kriging variance |
| A-5 ranked drill targets with evidence | **fully** |
| A-7 feature attribution | **fully** — importances returned per prediction |
| A-8 versioned, reproducible runs | partial — model versioned; no run registry |

The model is honest, modest, and its weaknesses are measured rather than hidden.
The most valuable next step is not a better classifier — it is GSI lithology.
