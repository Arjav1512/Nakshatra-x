# Evidence — PR B (map layers, navigation, mine detail)

`before-v3/` is main at `cbe675a`; `after-v3/` is this branch. Both are production
builds (`next build && next start`) against the same service layer, captured one
at a time with nothing else running. Main's frontend calls only endpoints this
branch extends additively, so its "before" renders as main does.

## Screenshots

| what | where |
|---|---|
| every route at 375 / 768 / 1280 / 1920 | `<route>@<width>.png` in both directories |
| a mine's detail (confusion 6) | `console__mine-1_track-b@*.png` |
| the prospectivity map | `console__track-a@*.png` |
| each map layer at 1280 and 375 | `map/<layer>@<width>.png` — six here, main's two in `before-v3/map/` |
| console errors and horizontal overflow per route | `_report.json` — 0 overflow at all four widths, both sets; the same five console errors on main and here (a 404 on `/`, four from `/auth/callback` visited without a session) |

## Lighthouse — `lighthouse/<route>@<width>.json`

Eight routes at 375 (mobile preset) and 1280 (desktop preset). Embedded
screenshots stripped; scores, metrics and audits are as produced.

| | perf ≥ 85, a11y ≥ 95, CLS < 0.1 |
|---|---|
| main | **11 / 16** — `/` 83 and CLS 0.297, `/mine-twin` CLS 0.297, mine detail CLS 0.155 and, at 375, perf 77 and CLS 0.313 |
| this branch | **16 / 16** — mine detail @375 perf 91, CLS 0.044; `/` @1280 perf 99, CLS 0; map a11y 100 (main 95) |

## Accessibility — `_a11y.json`

axe-core, WCAG 2.2 AA, 1280 and 375: **0 serious/critical** across 17 routes
(now including the mine detail and the map, which the audit had never visited),
and across all six map layers via `tools/a11y-map-layers.js`.

## Guards (all pass on this branch)

| | |
|---|---|
| `test:map` · `--pc-blocked` · `--evicted` | every layer draws, is not blank, cites its source and credits its licensor — live, from cache with Planetary Computer blocked, and after a forced mosaic eviction (60 tiles 404 once → 1 re-register → all live). Main fails 6/6. Mutation-proven: a cached pill reading LIVE, and a dropped licence notice on cached tiles, each fail exactly their checks. |
| `test:nav` | one navigation model; main fails 8 |
| `test:cls` | 8 routes × 375 and 1280, plus late and failing telemetry, worst of three runs < 0.1; main fails 3 |
| `test:provenance` | 0 unattributed values online (`_provenance-guard.json`); 0 data-shaped values with the service layer down (`_provenance-guard-offline.json`) — both on the final build |
| `test:e2e` 18/18 · `test:routes` 108/108 · `test:dates` · `test:pilot` · `test:motion` · `test:surface` · `test:scenario` · `test:auth` · `lint:literals` 0 · `tsc` clean | |
| Biome | 33 errors / 79 warnings / 9 infos — identical to main |
| backend | 73 passed |
