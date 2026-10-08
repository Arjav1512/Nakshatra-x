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
    // Scoped to the mine list. This matched every <li> on the page that held a
    // button, so when the breadcrumb became an ordered list of buttons (the
    // track is part of the location now) it counted 12 "mine cards" and opened
    // "production risk" as if it were a mine. A card is a mine because it is
    // in the mine list, not because of the tags it happens to be made of.
    const cards = [...document.querySelectorAll('[data-testid="mine-list"] > li')]
    return {
      count: cards.length,
      withNumber: cards.filter((c) => /\d/.test(c.innerText)).length,
      // P(shortfall) is withdrawn from the screen (DECISIONS.md D-044): every
      // card leads with tonnes, and none may show a percentage at all.
      withTonnes: cards.filter((c) => /−[\d,]+\s*t expected/.test(c.innerText)).length,
      withPercent: cards.filter((c) => /\d\s*%/.test(c.innerText)).length,
      withBadge: cards.filter((c) => badges.some((b) => c.innerText.includes(b))).length,
      unavailable: cards.filter((c) => /unavailable/i.test(c.innerText)).length,
      // The mine name, not the first line: cards now open with a rank ("02"),
      // so taking line 0 made `second` the string "02" and the DEF-1 guard
      // asserted against a number instead of a mine.
      names: cards.map((c) => {
        const lines = c.innerText.split('\n').map((l) => l.trim()).filter(Boolean)
        return lines.find((l) => /^[A-Za-z]/.test(l)) ?? lines[0] ?? ''
      }),
    }
  }, PROVENANCE_BADGES)

  check(
    `portfolio renders ${EXPECTED_MINES} mine cards`,
    portfolio.count === EXPECTED_MINES,
    `got ${portfolio.count}`
  )
  check(
    'every card shows an expected shortfall in tonnes',
    portfolio.withTonnes === EXPECTED_MINES,
    `${portfolio.withTonnes}/${EXPECTED_MINES} — ${portfolio.unavailable} unavailable`
  )
  check(
    'no card shows a probability (P(shortfall) withdrawn, D-044)',
    portfolio.withPercent === 0,
    `${portfolio.withPercent} card(s) show a percentage`
  )
  const portfolioWithdrawn = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="p-withdrawn"]')
    return n ? { text: n.innerText, href: n.querySelector('a')?.href ?? '' } : null
  })
  check(
    'the portfolio says P(shortfall) is withdrawn, and links to the finding',
    !!portfolioWithdrawn && /withdrawn/i.test(portfolioWithdrawn.text) && /QUANTILE_CROSSING\.md$/.test(portfolioWithdrawn.href),
    portfolioWithdrawn ? portfolioWithdrawn.href : 'no withdrawal notice'
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
    // `startsWith` coupled this to how the card happens to open. The portfolio
    // now leads each card with its rank ("02  Balaghat"), so the selector found
    // nothing and every downstream check failed against a page that had never
    // been navigated. Match the name anywhere in the card instead: the guard is
    // about which mine opens, not about what the card looks like.
    const li = [...document.querySelectorAll('[data-testid="mine-list"] > li')].find((l) => l.innerText.includes(name))
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
    // Find Balaghat by name. The portfolio is ranked by expected shortfall now,
    // so Balaghat is not first and `startsWith` no longer matches a card that
    // opens with its rank.
    const li = [...document.querySelectorAll('[data-testid="mine-list"] > li')].find((l) => l.innerText.includes('Balaghat'))
    li?.querySelector('button')?.click()
  })
  await sleep(20000)

  const mine = await page.evaluate(() => document.body.innerText)
  check('forecast: plan target rendered', /PLAN TARGET[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))
  check('forecast: expected production rendered', /EXPECTED PRODUCTION[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))
  check('forecast: expected shortfall rendered', /EXPECTED SHORTFALL[\s\S]{0,80}?[\d,]+\s*t/i.test(mine))

  // The focal number is summed over grades (D-044, PRD §3). The API serves it
  // that way now, and the console reads it rather than adding the grades
  // itself, so this checks the served figure: the tile must equal the grade
  // chips added up, give or take each chip's rounding.
  const focal = await page.evaluate(() => {
    const tile = [...document.querySelectorAll('[data-provenance]')].find((n) =>
      /^\s*Expected shortfall/i.test(n.querySelector('.label')?.textContent ?? '')
    )
    const value = Number((tile?.querySelector('[data-metric]')?.textContent ?? '').replace(/[^\d.]/g, ''))
    const chips = [...document.querySelectorAll('[data-grade]')].map((b) => {
      const m = b.innerText.match(/−([\d,]+)\s*t expected/)
      return m ? Number(m[1].replace(/,/g, '')) : /no shortfall expected/.test(b.innerText) ? 0 : null
    })
    return { value, chips }
  })
  const chipSum = focal.chips.reduce((a, b) => a + (b ?? Number.NaN), 0)
  check(
    'per-grade breakdown shows each grade\'s expected shortfall in tonnes',
    focal.chips.length >= 2 && focal.chips.every((c) => c !== null),
    `${focal.chips.length} grade(s): ${focal.chips.join(', ')}`
  )
  check(
    'expected shortfall is the grades\' shortfalls summed (D-044, PRD §3)',
    Math.abs(focal.value - chipSum) <= focal.chips.length,
    `tile ${focal.value} t, grades sum to ${chipSum} t`
  )
  check(
    'no probability of shortfall rendered as a number (D-044)',
    !/P\s*\(\s*short(fall)?\s*\)\s*[\d.]/i.test(mine) && !/\bP\s+\d+\s*%/.test(mine) && !/ΔP/.test(mine),
    (mine.match(/P\s*\(\s*short(fall)?\s*\)\s*[\d.]+%?|\bP\s+\d+\s*%|ΔP[^\n]{0,30}/i) || ['—'])[0]
  )
  const mineWithdrawn = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="p-withdrawn"]')].map((n) => n.querySelector('a')?.href ?? '')
  )
  check(
    'where P(shortfall) was, the mine says it is withdrawn and links to the finding',
    mineWithdrawn.some((h) => /QUANTILE_CROSSING\.md$/.test(h)),
    mineWithdrawn.join(', ') || 'no withdrawal tile'
  )
  const daily = await page.evaluate(() => document.querySelector('[data-calibration="daily"]')?.innerText ?? '')
  check(
    'the daily bands\' measured calibration is shown, portfolio and mine',
    /All ten mines:\s*0\.\d{3}\s*\[0\.\d{3}, 0\.\d{3}\]/.test(daily) && /Balaghat:\s*0\.\d{3}\s*\[0\.\d{3}, 0\.\d{3}\]/.test(daily),
    daily.split('\n').slice(1, 3).join(' | ') || 'no daily calibration panel'
  )

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
