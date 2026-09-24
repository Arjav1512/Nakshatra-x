# Cloud-cover default — impact on the Track A training set

**Question.** `AI/scripts/sentinel_features.py` read scene cloud fraction as
`.get("eo:cloud_cover", 0.0)`. A missing key therefore became **0.0 — the best
possible value** — so a scene of unknown cloudiness passed every cloud filter.
The dataset's "max cloud 1.0%" property, which `test_track_a` asserts, only
means something if unknown is excluded rather than counted as pristine.

How many of the 50 training rows were affected?

## Answer: none. The default was never exercised.

### Step 1 — every cached row has a value

```
$ ls AI/outputs/feature_cache/*.json | wc -l
53

total cached files      : 53
cloud_cover_pct present : 53
key absent              : 0
value null              : 0
```

(53 files: the 50 training points plus 3 probe points cached by later runs.)

### Step 2 — 14 rows sit at exactly 0.0, which is the default's signature

```
rows                : 53
exactly 0.0         : 14
max cloud           : 1.0
min non-zero        : 0.08

  [0,     0.001) : 14
  [0.001, 0.5)   : 12
  [0.5,   1)     : 19
  [1,     5)     : 8
  [5,     100)   : 0
```

Exactly 0.0 is what `.get(..., 0.0)` produces — but it is also what a genuinely
clear scene produces after `round(x, 2)`. The cache cannot tell the two apart,
so the cache is not sufficient evidence.

### Step 3 — ask the source

The 14 zero rows come from three scenes. Queried against the Planetary Computer
STAC API on 2026-09-24:

```
$ curl -X POST https://planetarycomputer.microsoft.com/api/stac/v1/search \
    -d '{"collections":["sentinel-2-l2a"],"ids":[...]}'

S2C_MSIL2A_20260407T050651_R019_T44QLH_20260407T103956
   eo:cloud_cover present: True   value: 4e-05
S2C_MSIL2A_20260407T050651_R019_T44QLJ_20260407T103956
   eo:cloud_cover present: True   value: 0.000153
S2C_MSIL2A_20260423T053021_R105_T43RGN_20260423T084910
   eo:cloud_cover present: True   value: 0.000581
```

**`eo:cloud_cover` is present on all three**, with real values of 0.00004%,
0.000153% and 0.000581%. `round(x, 2)` renders each as `0.0`. These are
genuinely near-cloud-free April scenes over central India, which is what a
pre-monsoon acquisition should look like.

## Consequences

| | |
|---|---|
| Rows affected by the default | **0 of 50** |
| Rows that would fail the 1% filter under the fix | **0** |
| Change to the training set | **none** |
| Retraining required | **no** |
| Expected effect on LOMO AUC | **none** — the inputs are identical |

`test_track_a` re-run after the change: **5 passed**, including
`test_features_are_real_measurements` and the assertion that every row is under
15% cloud.

## Why the fix still stands

The default was latent, not active. It was one unlucky STAC response away from
admitting a cloudy scene into a dataset whose cleanliness the project cites as
evidence — and it would have done so silently, because a defaulted 0.0 is
indistinguishable from a measured 0.0 in the cache. Scenes with no cloud
metadata are now skipped outright.

This is the difference between "no harm was done" and "no harm could be done".
Only the second is a property of the code.
