# Silent-default sweep

Every `parseInt(...) ||`, `|| <literal>`, `?? <literal>`, `.catch(() => <constant>)`
and `except ...: <var> = <value>` on a data or ID path, across frontend, backend
and `AI/scripts`, with its disposition.

**The test applied to each hit.** Can this
(a) substitute one entity's data for another's, or
(b) turn a failure into a number a reader would take as measured?

If yes, it was replaced with an explicit error or an unavailable state. If no,
it was kept and the reason recorded — a defaulting expression is not
automatically a defect, and rewriting harmless ones would only obscure the real
ones.

Patterns searched:

```bash
grep -rnE "(parseInt|parseFloat|Number)\([^)]*\)\s*(\|\||\?\?)" frontend/src
grep -rnE "(\?\?|\|\|)\s*(0|1|-1|[0-9]+\.[0-9]+|'[A-Za-z])" frontend/src
grep -rnE "\.catch\(\s*\(\)\s*=>" frontend/src
grep -rnE "\bor\s+(0|1|[0-9]+\.[0-9]+)\b" backend/app AI/scripts
grep -rnoE "\.get\([^)]*,\s*([0-9.]+|'[A-Za-z][^']*')\)" backend/app AI/scripts
# plus an AST pass for `except:` blocks assigning a literal
```

---

## Fixed — could substitute one entity's data for another's

| # | Location | Pattern | What it did |
|---|---|---|---|
| 1 | `api/v1/mines/[mineId]/telemetry/route.ts` | `parseInt(id, 10) \|\| 1` | `NaN \|\| 1` → **every mine returned Balaghat's telemetry**, with `live_sources_ok: true` and no degradation flag. Fixed in the DEF-1 PR. |
| 2 | `components/globe/HotspotEvidence.tsx` | `SLUG_TO_ID[id] ?? 1` | Same substitution in the evidence panel. Fixed in the DEF-1 PR; the component has since been deleted as an orphan. |
| 3 | `mission-control/data.ts` | `mine.numericId \|\| 1` (×2) | Requested mine 1 whenever a mine arrived without a numeric id. Fixed in the DEF-1 PR; degraded telemetry now carries `-1` for "unidentified". |

## Fixed — turned a failure into a plausible value

| # | Location | Pattern | What it did |
|---|---|---|---|
| 4 | `console/TrackAPanel.tsx` | `uncertainty_sd ?? 0` | Reported an uncertainty of **zero** — the most misleading value available, since it claims the estimate is exact. Now renders "not quantified". |
| 5 | `console/TrackAPanel.tsx` | `variogram.range_m ?? 0` | Printed "variogram range 0 km" in the basis string. Now states it was not reported. |
| 6 | `LocationFloodAlertFinder.tsx` | `lat >= 21.5 ? 124.5 : 88.0` etc. | Rainfall, soil moisture, temperature and humidity **derived from latitude** and shown as readings when the request failed. |
| 7 | `LocationFloodAlertFinder.tsx` | `sin()` series | **Synthesised a 14-day rainfall curve** from the coordinates when the API returned nothing — on a flood screen. |
| 8 | `LocationFloodAlertFinder.tsx` | `(v \|\| 0)` on nullable daily rain | A day with no record became a measured dry day and was summed into the 14-day total. |
| 9 | `RiskCockpit.tsx` | `?? (state === 'MP' ? 72.4 : 44.5)` | Composite risk, rainfall and soil moisture **defaulted from the mine's state**. |
| 10 | `MineTwinPanel.tsx` | `simResult?.confidence \|\| 94` | An absent confidence became a literal **94%**, under the label "High Precision ML". |
| 11 | `api/v1/mine-twin/route.ts` | `body.baselineProduction \|\| 14200` | Every figure the endpoint returns is derived from the baseline; a missing one silently became 14,200. Now a 400. |
| 12 | `app/admin/page.tsx` | `parseFloat(value) \|\| 0` | An unparseable plan target became **zero**, a valid-looking number every downstream shortfall would use. |
| 13 | `backend/app/api/telemetry.py` | `wx.get("rainfall_14d_mm") or 0.0` | Missing rainfall became a measured zero — and 0.0 took the **lowest** drag branch (0.02), so an unmeasured mine reported *better* than a dry one. |
| 14 | `backend/app/api/telemetry.py` | `mine.target_tonnes or 0.0` | A mine with no plan target got a target of zero, making every derived figure meaningless rather than absent. Now raises. |
| 15 | `backend/app/api/routes.py` | `BoreholeItem` defaults 8.0 / 6.0 / 88.0 / 3.8 | In-situ tonnage is `thickness × area × density × recovery`, so **two unmeasured defaults fed the headline number**. All fields now required. |
| 16 | `backend/app/api/routes.py` | four default boreholes | An empty POST returned a full grade analysis of assays that do not exist. Now required, min length 1. |
| 17 | `backend/app/ml/geostat_kriging.py` | `.get("mn_pct", 38.0)` etc. | A borehole supplied as `{}` produced a grade, a seam thickness and a tonnage. The list was called `valid_holes` while nothing was validated; incomplete assays are now rejected by name. |
| 18 | `AI/scripts/sentinel_features.py` | `.get("eo:cloud_cover", 0.0)` | Unknown cloud fraction defaulted to the **best possible value**, so the scene passed every cloud filter. The dataset's "max cloud 1.0%" property — asserted by `test_track_a` — is only meaningful if unknown is excluded. Such scenes are now skipped. |
| 19 | `AI/scripts/sentinel_features.py` | `float(x["elevation"] or 0.0)` | Placed a point at sea level when the DEM returned nothing. Balaghat works at ~383 m and slope derives from three elevations per point, so one silent zero corrupts that point's terrain features. Now raises. |
| 20 | `AI/scripts/06_flood_telemetry_processor.py` | `r or 0.0`, `or 0.35`, `, 32.0)`, `, 70.0)` | Null precipitation counted as a dry day; soil moisture, temperature and humidity defaulted to plausible central-India values indistinguishable from readings. |

## Also removed — fabricated statistics found during the sweep

These are not silent defaults, but the same class of harm: a number presented as
a measurement that no measurement produced.

| # | Location | What it was |
|---|---|---|
| 21 | `backend/app/ml/geostat_kriging.py` | `geostatistical_confidence_pct = min(96.0, recovery * 0.95 + n_holes * 1.5)` — not a confidence in any statistical sense, and it rose with hole count whether or not the holes agreed. |
| 22 | `api/v1/mine-twin/route.ts` | `confidence = min(96, max(72, 90 - |delay| * 1.4 + ...))` — bounds and coefficient chosen to look plausible. |

## Kept, with reasons

| Location | Pattern | Why it is not a defect |
|---|---|---|
| `lib/console-api.ts`, `HotspotEvidence`, `LoginForm`, `RealtimeMLTrainingStudio` | `res.json().catch(() => null)` | The response may legitimately not be JSON. `null` is absence, and every caller branches on it. |
| `lib/backend.ts` | `res.text().catch(() => '')` | An error *message*, not data. |
| `app/api/auth/otp/route.ts` | `Number(process.env.SMTP_PORT) \|\| 465` | Configuration with a standard default. Not a measurement, and not attributable to an entity. |
| `backend/app/ml/forecaster.py` | `.get(day, 0.0)` (covariate lookups) | Absence of an event on a day genuinely means zero hours that day. This is the correct semantics for event aggregation, not a substitution. |
| `backend/app/ingestion/generator.py` | `float(e.downtime_hours or 0.0)` | Same: summing events, where "no record" means "no downtime logged". |
| `backend/app/api/telemetry.py` | `except Exception: staleness = None` | `None` is unknown, which is the honest value. Not plausible-looking. |
| `AI/scripts/real_data_client.py` | `except Exception: _cache = {}` | Cache initialisation. Holds no measurements. |
| `api/v1/historical-forecasts/route.ts` | `req.json().catch(() => ({}))`, `Number(x) \|\| 1.0` | A scenario knob with a neutral default, on an endpoint whose only UI consumer was deleted this stage. Left in place rather than changed blind. |

---

## Note on `|| 0` in aggregation vs `|| 0` on a reading

The distinction that decided most of the table above:

- `sum + (event.hours || 0)` over a list of events is **correct**. A record with
  no hours contributes nothing, and the sum is still a true sum.
- `rainfall = reading || 0` on a single measurement is **wrong**. It asserts a
  measured zero where there was no measurement, and every derived figure
  inherits that assertion without carrying its uncertainty.

Both look identical to a grep. Only the second was changed.
