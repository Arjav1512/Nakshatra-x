#!/usr/bin/env node
/**
 * Walks every beat of docs/DEMO.md in a real headless browser and screenshots
 * each one.
 *
 *   node tools/demo-walk.js
 *   DEMO_WALK_OUT=/tmp/walk node tools/demo-walk.js     # anywhere but the repo
 *
 * Needs FastAPI on :8000 and this app on :3000. Screenshots and `_walk.json`
 * go to docs/design/after/demo/ unless DEMO_WALK_OUT says otherwise — set it for
 * any run that is not producing evidence to commit (rehearsals, CI-style runs).
 *
 * A step that cannot be performed, or whose expected content is absent, is
 * reported as a finding. The point is to catch the case where the demo script
 * describes something the product no longer does: this walk last drifted when
 * the redesign replaced the Track A toggle with the breadcrumb, moved the
 * backtest onto page load and added the Mine-twin beat, and nothing said so
 * until the cold-start rehearsal (docs/DEMO.md) ran it.
 *
 * It also records what a presenter would need to know with the network gone:
 * whether weather shows LIVE, which map layers are live or cached, and whether
 * the fonts actually loaded.
 */
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const OUT = process.env.DEMO_WALK_OUT || path.resolve(__dirname, '../../docs/design/after/demo')

const steps = []
const findings = []
const facts = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function record(step, ok, detail) {
  steps.push({ step, ok, detail: detail || null })
  if (!ok) findings.push(`${step}${detail ? ` — ${detail}` : ''}`)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `  (${detail})` : ''}`)
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

const clickByText = (page, selector, re) =>
  page.evaluate(
    (sel, src) => {
      const rx = new RegExp(src, 'i')
      const el = [...document.querySelectorAll(sel)].find((x) => rx.test(x.innerText))
      if (el) { el.click(); return true }
      return false
    },
    selector,
    re.source,
  )

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })
  const errors = []
  page.on('response', (r) => r.status() >= 500 && errors.push(`${r.status()} ${r.url()}`))
  const text = () => page.evaluate(() => document.body.innerText)
  const started = Date.now()

  // 0:00 — frame the problem
  await page.goto(`${BASE}/console`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(12000)
  let t = await text()
  record('0:00 thesis line', /Two tracks, as the problem statement implies but does not say/.test(t))
  // What the text is actually set in. Recorded, not asserted: the web fonts are
  // self-hosted at build time, but on this build they are declared and never
  // applied (--font-sans resolves on :root, the font variables live on <body>),
  // so the page renders in the system stack — which also means nothing about
  // type depends on the network.
  facts.fonts = await page.evaluate(async () => {
    await document.fonts.ready
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
    return { body: getComputedStyle(document.body).fontFamily.split(',')[0], webFontsLoaded: [...new Set(loaded)] }
  })
  await shot(page, '00-frame')

  // 0:20 — portfolio. Scoped to the mine list: the breadcrumb is a list too.
  const cards = await page.evaluate(() => document.querySelectorAll('[data-testid="mine-list"] > li').length)
  const probs = (t.match(/P\s*\d+%/g) || []).length
  record('0:20 portfolio — ten mines with P(shortfall)', cards === 10 && probs >= 10,
    `${cards} cards, ${probs} probabilities`)
  record('0:20 Balaghat marked as Track B pilot', /Track B pilot/i.test(t))
  await shot(page, '01-portfolio')

  // 0:45 — conditions + honesty marker
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('[data-testid="mine-list"] > li')]
      .find((l) => /Balaghat/.test(l.innerText))
    li?.querySelector('button')?.click()
  })
  await sleep(15000)
  t = await text()
  record('0:45 condition tiles (rainfall, temperature, downtime, blasts)',
    /rainfall/i.test(t) && /temp/i.test(t) && /downtime/i.test(t) && /blast/i.test(t))
  facts.weather_live = /\bLIVE\b/.test(t)
  record('0:45 SYNTHETIC badge on operational tiles', /\bSYNTHETIC\b/.test(t))
  console.log(`        weather LIVE badge on screen: ${facts.weather_live}`)
  const opened = await clickByText(page, 'button', /evidence/)
  await sleep(1500)
  t = await text()
  facts.evidence_source = (t.match(/NASA POWER[^\n]{0,60}|SYNTHETIC FALLBACK[^\n]{0,60}|unavailable[^\n]{0,60}/i) || [null])[0]
  record('0:45 "+ evidence" opens provenance', opened, opened ? facts.evidence_source : 'button not found')
  await shot(page, '02-conditions')

  // 1:05 — Track B headline tiles + grades + chart
  record('1:05 headline tiles',
    /plan target/i.test(t) && /expected production/i.test(t) &&
    /expected shortfall/i.test(t) && /P\(shortfall\)/i.test(t))
  const grades = ['ferro manganese', 'silico manganese', 'blast furnace', 'dioxide'].filter((g) => t.toLowerCase().includes(g))
  record('1:05 per-grade breakdown (PRD B-5)', grades.length === 4, grades.join(', '))
  record('1:05 chart states its interval and baseline',
    /80%/i.test(t) && /seasonal-naive/i.test(t))
  facts.calibration_beside_p = await page.evaluate(() =>
    document.querySelector('[data-calibration]')?.innerText?.slice(0, 160) || null)
  record('1:05 calibration shown beside P(shortfall)', !!facts.calibration_beside_p, facts.calibration_beside_p)
  await shot(page, '03-trackB')

  // 1:35 — backtest: read from the artifact on load, no click
  record('1:35 backtest on screen without a click (model and baseline MAPE)',
    /model MAPE/i.test(t) && /baseline/i.test(t))
  const cov = t.match(/coverage[^\n]{0,40}?(0\.\d+)/i)
  record('1:35 interval coverage reported', cov !== null, cov ? `coverage ${cov[1]}` : 'absent')
  await shot(page, '04-backtest')

  // 2:05 — constraint-gated actions
  record('2:05 approved actions with the checks they passed', /checks passed/i.test(t))
  record('2:05 rejection panel states its result either way',
    /rejected/i.test(t) || /no candidate violated a constraint/i.test(t))
  record('2:05 constraint scope line', /enforced, not learned/i.test(t))
  await shot(page, '05-actions')

  // 2:20 — Mine twin: the engine says no
  await page.goto(`${BASE}/mine-twin`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(6000)
  // The verdict appears only after a run, and changing a control does not clear
  // it: "+6H" alone leaves the previous "passed" on screen until Run again.
  const ran1 = await clickByText(page, 'button', /RUN WHAT-IF SIMULATION/)
  await sleep(6000)
  t = await text()
  record('2:20 run on the default plan: constraint check passed', ran1 && /Constraint check passed/i.test(t),
    ran1 ? null : 'Run button not found')
  const delayed = await clickByText(page, 'button', /^\+6H DELAY$/)
  const ran2 = delayed && (await clickByText(page, 'button', /RUN WHAT-IF SIMULATION/))
  await sleep(6000)
  t = await text()
  record('2:20 +6 h delay, run again: rejected by name',
    ran2 && /Constraint check failed/i.test(t) && /outside the underground inter-shift blasting windows/i.test(t),
    delayed ? null : '+6H DELAY button not found')
  await shot(page, '06-mine-twin')

  // 2:30 — Track A through the breadcrumb
  await page.goto(`${BASE}/console`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(6000)
  const toA = await page.evaluate(() => {
    const b = document.querySelector('[data-track-link="A"]')
    if (b) { b.click(); return true }
    return false
  })
  await sleep(15000)
  t = await text()
  record('2:30 prospectivity opens from the breadcrumb', toA, toA ? null : 'breadcrumb link not found')
  record('2:30 LOMO AUC with ablations', /LOMO AUC/i.test(t) && /0\.85/.test(t) && /spectral/i.test(t) && /slope/i.test(t))
  record('2:30 ranked drill targets with kriging uncertainty', /drill target/i.test(t) && /krig/i.test(t))
  facts.map_layers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-layer-button]')].map((b) => `${b.getAttribute('data-layer-button')}: ${b.innerText.replace(/\s+/g, ' ').trim()}`))
  facts.tile_sources = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tile-source]')].map((e) => e.getAttribute('data-tile-source')))
  await shot(page, '07-trackA')

  // 2:55 — close: guardrails + export
  record('2:55 guardrail statement present', /subsurface|sub-surface/i.test(t) && /not a reserve|not statutory|UNFC/i.test(t))
  const exportBtn = await page.evaluate(() =>
    [...document.querySelectorAll('button,a')].some((b) => /Export CSV/i.test(b.innerText)))
  record('2:55 Export CSV available', exportBtn)
  await shot(page, '08-close')

  record('no 5xx during the walk', errors.length === 0, errors.slice(0, 3).join(' | '))
  facts.seconds = Math.round((Date.now() - started) / 1000)

  await browser.close()
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, '_walk.json'), JSON.stringify({ steps, findings, facts }, null, 2))
  console.log(`\nfacts: ${JSON.stringify(facts, null, 1)}`)
  console.log(`\n${findings.length === 0 ? 'PASS' : 'FAIL'} — ${steps.length - findings.length}/${steps.length} demo steps as written`)
  process.exit(findings.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
