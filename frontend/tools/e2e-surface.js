#!/usr/bin/env node
/**
 * The prospectivity surface the app serves must be the model's.
 *
 *   npm run test:surface
 *
 * The map fetched `/api/v1/prospectivity`, which read a committed
 * `prospectivity.geojson` off disk: 1,326 cells from the superseded pipeline,
 * every popup carrying `dist_to_fault_km`, `temp_c` and `rainfall_mm` — two
 * features the honest rebuild dropped for leaking the labels, one the model
 * never had. It was drawn under the honest model's name and captioned
 * "LIVE ML · Real-Time Telemetry" over a static asset.
 *
 * Nothing in the rendering code said which model it was. This asserts it from
 * outside: what the surface endpoint serves has to agree with what the model
 * says about itself, and must carry none of the retired fields.
 */
const BASE = process.env.E2E_BASE || 'http://localhost:3000'

let failed = 0
const check = (n, ok, d = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n          ${d}` : ''}`)
}

const RETIRED = ['dist_to_fault_km', 'temp_c', 'rainfall_mm', 'confidence', 'probability']

;(async () => {
  const j = async (p) => {
    const r = await fetch(`${BASE}${p}`)
    return { status: r.status, body: await r.json().catch(() => null) }
  }

  const surface = await j('/api/v1/prospectivity')
  check('the surface endpoint answers', surface.status === 200, `status ${surface.status}`)
  if (surface.status !== 200) return finish()

  const s = surface.body
  check('the surface states its model version', !!s.model_version, JSON.stringify(Object.keys(s)).slice(0, 160))
  check('the surface states its cell count', typeof s.n_cells === 'number', `n_cells=${s.n_cells}`)
  check('the surface returns scored cells, not GeoJSON features',
    Array.isArray(s.cells) && s.cells.length > 0,
    s.features ? `it returned ${s.features.length} GeoJSON features — that is the superseded file` : '')

  if (Array.isArray(s.cells) && s.cells.length) {
    const keys = new Set(Object.keys(s.cells[0]))
    const retired = RETIRED.filter((k) => keys.has(k))
    check('no retired feature appears on a cell', retired.length === 0, retired.join(', '))
    check('every cell carries a score and its kriging spread',
      s.cells.every((c) => typeof c.prospectivity_score === 'number' && typeof c.uncertainty_sd === 'number'))
  }

  // It must agree with the model.
  const metrics = await j('/api/v1/prospectivity/metrics')
  const targets = await j('/api/v1/prospectivity/drill-targets?top_n=1')
  check('the surface model version equals the metrics model version',
    !!s.model_version && s.model_version === metrics.body?.model_version,
    `surface=${s.model_version} metrics=${metrics.body?.model_version}`)
  check('the surface cell count equals the ranking candidate count',
    s.n_cells === targets.body?.n_candidates,
    `surface=${s.n_cells} ranking=${targets.body?.n_candidates}`)
  check('the surface is not claimed to be live', s.provenance?.is_live === false,
    JSON.stringify(s.provenance ?? null).slice(0, 120))

  finish()
})().catch((e) => { console.error(e); process.exit(1) })

function finish() {
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
}
