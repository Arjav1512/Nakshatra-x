/**
 * Browser-level regression test for the decision console (DEF-1).
 *
 *   npm run test:e2e
 *
 * Needs the FastAPI service on :8000 and this app on :3000. See docs/DEMO.md.
 *
 * Why this exists. DEF-1 was invisible to every check the project had, because
 * every check used numeric mine ids — the path that always worked. Nothing
 * exercised the path a browser actually takes: fetch the register, then use the
 * id the register returned. A Next route handler shadowed FastAPI's register
 * and answered with slug ids, so `forecast`, `backtest` and `recommendations`
 * returned 503 for every mine, and `telemetry` silently served Balaghat's
 * record for all ten.
 *
 * So this test drives the real screen and asserts on rendered pixels-worth of
 * DOM, not on endpoints. A green API check must never again stand in for a
 * working page.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'

const EXPECTED_MINES = 10
const PROVENANCE_BADGES = ['LIVE', 'DERIVED', 'SYNTHETIC', 'REFERENCE']

const results = []
let failed = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })

  // ---- network watch: any 5xx anywhere in the run is a failure -------------
  const serverErrors = []
  page.on('response', (res) => {
    if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`)
  })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  console.log('\n/console — portfolio\n')
  await page.goto(`${BASE}/console`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(Number(process.env.E2E_SETTLE || 15000))

  const portfolio = await page.evaluate((badges) => {
    const cards = [...document.querySelectorAll('li')].filter((li) => li.querySelector('button'))
    return {
      count: cards.length,
      withNumber: cards.filter((c) => /\d/.test(c.innerText)).length,
      withProbability: cards.filter((c) => /P\s*\d+%/.test(c.innerText)).length,
      withBadge: cards.filter((c) => badges.some((b) => c.innerText.includes(b))).length,
      unavailable: cards.filter((c) => /unavailable/i.test(c.innerText)).length,
      names: cards.map((c) => c.innerText.split('\n')[0].trim()),
    }
  }, PROVENANCE_BADGES)

  check(
    `portfolio renders ${EXPECTED_MINES} mine cards`,
    portfolio.count === EXPECTED_MINES,
    `got ${portfolio.count}`
  )
  check(
    'every card shows a shortfall probability',
    portfolio.withProbability === EXPECTED_MINES,
    `${portfolio.withProbability}/${EXPECTED_MINES} — ${portfolio.unavailable} unavailable`
  )
  check(
    'every card carries a provenance badge',
    portfolio.withBadge === EXPECTED_MINES,
    `${portfolio.withBadge}/${EXPECTED_MINES}`
  )
  check('no card reports data unavailable', portfolio.unavailable === 0, `${portfolio.unavailable} did`)

  // ---- DEF-1 guard: the mine you open is the mine you get ------------------
  // The substitution bug returned Balaghat for every id, so opening the SECOND
  // mine is the assertion that actually catches a regression.
  const second = portfolio.names[1]
  console.log(`\ndrill-down — ${second} (DEF-1 substitution guard)\n`)
  await page.evaluate((name) => {
    const li = [...document.querySelectorAll('li')].find((l) => l.innerText.startsWith(name))
    li?.querySelector('button')?.click()
  }, second)
  await sleep(12000)

  const secondView = await page.evaluate(() => document.body.innerText)
  check(
    `opening "${second}" shows ${second}, not mine 1`,
    secondView.includes(second) && new RegExp(`${second}\\s*·\\s*conditions`, 'i').test(secondView),
    secondView.match(/(\w+)\s*·\s*conditions/i)?.[0] ?? 'no conditions header found'
  )

  // ---- Balaghat: the full evidence chain ----------------------------------
  console.log('\ndrill-down — Balaghat (full chain)\n')
  await page.goto(`${BASE}/console`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(Number(process.env.E2E_SETTLE || 15000))
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((l) => l.innerText.startsWith('Balaghat'))
    li?.querySelector('button')?.click()
  })
  await sleep(20000)

  const mine = await page.evaluate(() => document.body.innerText)
  check('forecast: plan target rendered', /PLAN TARGET[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))
  check('forecast: expected production rendered', /EXPECTED PRODUCTION[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))
  check('forecast: expected shortfall rendered', /EXPECTED SHORTFALL[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))
  check('P(shortfall) rendered as a percentage', /P\(SHORTFALL\)[\s\S]{0,80}?\d+(\.\d+)?%/i.test(mine))
  check('per-grade shortfall breakdown rendered', (mine.match(/P\(short\)\s*\d+(\.\d+)?%/gi) || []).length >= 2)

  // ---- backtest: computed on demand, so run it ----------------------------
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /rolling-origin backtest/i.test(x.innerText)
    )
    if (b) { b.click(); return true }
    return false
  })
  if (clicked) await sleep(Number(process.env.E2E_BACKTEST_WAIT || 90000))

  const afterBacktest = await page.evaluate(() => document.body.innerText)
  const coverage = afterBacktest.match(/INTERVAL COVERAGE[^\n]*\n[\s\S]{0,60}?(\d\.\d+)/i)
  check('backtest: model MAPE rendered', /MODEL MAPE[\s\S]{0,60}?\d+(\.\d+)?%/i.test(afterBacktest))
  check('backtest: baseline MAPE rendered', /BASELINE MAPE[\s\S]{0,60}?\d+(\.\d+)?%/i.test(afterBacktest))
  check(
    'backtest: interval coverage rendered',
    coverage !== null,
    coverage ? `coverage = ${coverage[1]}` : 'not found'
  )
  check(
    'backtest: per-horizon table rendered',
    /Horizon[\s\S]{0,400}?14 d/i.test(afterBacktest)
  )

  // ---- recommendations ----------------------------------------------------
  const approved = (afterBacktest.match(/APPROVED/g) || []).length
  const checksPassed = (afterBacktest.match(/checks passed:/gi) || []).length
  check('at least one corrective action rendered', approved >= 1, `${approved} approved`)
  check(
    'every rendered action states its constraint checks',
    checksPassed >= 1 && checksPassed >= approved,
    `${checksPassed} "checks passed" for ${approved} approved`
  )

  // ---- global ------------------------------------------------------------
  console.log('\nglobal\n')
  check(
    'no 5xx responses during the run',
    serverErrors.length === 0,
    serverErrors.slice(0, 5).join('\n          ')
  )
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join('\n          '))

  await browser.close()

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length} checks passed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\ne2e harness error:', e)
  process.exit(1)
})
