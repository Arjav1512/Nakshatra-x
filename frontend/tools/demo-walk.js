/**
 * Walks every step of docs/DEMO.md in a real headless browser and screenshots
 * each one to docs/design/after/demo/.
 *
 *   node tools/demo-walk.js
 *
 * Needs FastAPI on :8000 and this app on :3000.
 *
 * A step that cannot be performed, or whose expected content is absent, is
 * reported as a finding. The point is to catch the case where the demo script
 * describes something the product no longer does.
 */
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const OUT = path.resolve(__dirname, '../../docs/design/after/demo')

const findings = []
const steps = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function record(step, ok, note) {
  steps.push({ step, ok, note })
  console.log(`  ${ok ? 'ok  ' : 'MISS'}  ${step}${note ? ` — ${note}` : ''}`)
  if (!ok) findings.push(`${step}: ${note}`)
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

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

  // 0:00 — frame the problem
  await page.goto(`${BASE}/console`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(15000)
  let t = await text()
  record(
    '0:00 frame the problem',
    /Two tracks, as the problem statement implies but does not say/.test(t),
    null
  )
  await shot(page, '00-frame')

  // 0:20 — portfolio
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('li')].filter((l) => l.querySelector('button')).length
  )
  const probs = (t.match(/P\s*\d+%/g) || []).length
  record('0:20 portfolio — ten mines with P(shortfall)', cards === 10 && probs >= 10,
    `${cards} cards, ${probs} probabilities`)
  record('0:20 Balaghat marked as Track B pilot', /Track B pilot/.test(t), null)
  await shot(page, '01-portfolio')

  // 0:45 — conditions + honesty marker
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) => l.innerText.startsWith('Balaghat'))
    li?.querySelector('button')?.click()
  })
  await sleep(20000)
  t = await text()
  record('0:45 four condition tiles',
    /RAINFALL 14D MM/i.test(t) && /LAND SURFACE TEMP/i.test(t) &&
    /DOWNTIME HOURS/i.test(t) && /BLASTS THIS WEEK/i.test(t), null)
  record('0:45 LIVE and SYNTHETIC badges both present',
    /\bLIVE\b/.test(t) && /\bSYNTHETIC\b/.test(t), null)
  await shot(page, '02-conditions')

  // + evidence under rainfall
  const opened = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('div')].filter((d) =>
      /RAINFALL 14D MM/i.test(d.innerText) && d.innerText.includes('evidence'))
    const tile = tiles[tiles.length - 1]
    const b = tile && [...tile.querySelectorAll('button')].find((x) => /evidence/i.test(x.innerText))
    if (b) { b.click(); return true }
    return false
  })
  await sleep(1500)
  t = await text()
  record('0:45 "+ evidence" opens provenance', opened && /NASA POWER/i.test(t),
    opened ? (/NASA POWER/i.test(t) ? null : 'opened but no NASA POWER source') : 'button not found')
  await shot(page, '03-evidence')

  // 1:05 — Track B headline tiles + grades + chart
  record('1:05 four headline tiles',
    /PLAN TARGET/i.test(t) && /EXPECTED PRODUCTION/i.test(t) &&
    /EXPECTED SHORTFALL/i.test(t) && /P\(SHORTFALL\)/i.test(t), null)
  const grades = (t.match(/P\(short\)\s*\d+(\.\d+)?%/gi) || []).length
  record('1:05 per-grade probabilities (PRD B-5)', grades >= 4, `${grades} grades`)
  record('1:05 chart states its interval and baseline',
    /80% prediction interval/i.test(t) && /seasonal-naive/i.test(t), null)
  await shot(page, '04-trackB')

  // 1:35 — backtest
  const ran = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /rolling-origin backtest/i.test(x.innerText))
    if (b) { b.click(); return true }
    return false
  })
  if (ran) await sleep(90000)
  t = await text()
  const cov = t.match(/INTERVAL COVERAGE[^\n]*\n[\s\S]{0,60}?(\d\.\d+)/i)
  record('1:35 backtest runs and reports MAPE',
    /MODEL MAPE/i.test(t) && /BASELINE MAPE/i.test(t), ran ? null : 'run button not found')
  record('1:35 interval coverage reported', cov !== null, cov ? `coverage ${cov[1]}` : 'absent')
  await shot(page, '05-backtest')

  // 2:05 — constraint-gated actions
  const approved = (t.match(/APPROVED/g) || []).length
  record('2:05 approved actions with checks', approved >= 1 && /checks passed:/i.test(t),
    `${approved} approved`)
  record('2:05 rejected block shown (DEMO.md: "scroll to the rejected block")',
    /rejected/i.test(t), 'DEMO.md says rejected actions are displayed with the rule they broke')
  record('2:05 constraint scope footer line',
    /enforced, not learned/i.test(t) || /constraints\.py/i.test(t), null)
  await shot(page, '06-actions')

  // 2:30 — Track A
  const toA = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /Track A/i.test(x.innerText) && /prospectivity/i.test(x.innerText))
    if (b) { b.click(); return true }
    return false
  })
  await sleep(20000)
  t = await text()
  record('2:30 Track A opens', toA, toA ? null : 'toggle not found')
  record('2:30 LOMO AUC with confidence interval', /AUC/i.test(t) && /0\.8\d/.test(t), null)
  record('2:30 ablations (spectral-only, slope-only)',
    /spectral/i.test(t) && /slope/i.test(t), null)
  record('2:30 ranked drill targets with kriging uncertainty',
    /drill target/i.test(t) && /krig/i.test(t), null)
  await shot(page, '07-trackA')

  // 2:55 — close: guardrails + export
  record('2:55 guardrail footer present', /No subsurface ore detection from satellite/i.test(t), null)
  const exportBtn = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /Export CSV/i.test(b.innerText)))
  record('2:55 Export CSV available', exportBtn, null)
  await shot(page, '08-close')

  record('no 5xx during the walk', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  fs.writeFileSync(path.join(OUT, '_walk.json'), JSON.stringify({ steps, findings }, null, 2))

  console.log(`\n${findings.length === 0 ? 'PASS' : 'FINDINGS'} — ${steps.filter(s=>s.ok).length}/${steps.length} demo checks passed`)
  if (findings.length) {
    console.log('\nFindings:')
    findings.forEach((f) => console.log('  - ' + f))
  }
  console.log(`\nscreenshots: docs/design/after/demo/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
