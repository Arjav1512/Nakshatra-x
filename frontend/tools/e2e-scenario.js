#!/usr/bin/env node
/**
 * The what-if calculator must be honest about what it is (PRD C-4, C-6).
 *
 *   npm run test:scenario
 *
 * It is arithmetic over stated assumptions. That is a legitimate thing for a
 * planner to want — compare option A against option B — and an illegitimate
 * thing to dress as a model output.
 *
 * What went wrong before: the multipliers lived inside the route handler where
 * nobody could see or change them; `riskDelta` was a hardcoded ternary; the
 * baseline fell back to a client constant; and the scenario store shipped
 * **pre-populated** with two fabricated runs (Balaghat 16,620/14,200/2,420 and
 * Bharweli 13,850/12,200/1,650) back-dated an hour and two hours so they read
 * as saved work. Those rendered with the service layer stopped, which is how
 * they were found.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const SETTLE = Number(process.env.E2E_SETTLE || 13000)

let failed = 0
const check = (n, ok, d = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n          ${d}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SEEDED = ['16,620', '2,420', '13,850', '1,650', '14,200', '12,200']

;(async () => {
  // ---- the store is empty until someone runs something --------------------
  const store = await (await fetch(`${BASE}/api/v1/mine-twin`)).json()
  check('no scenario exists before one is run',
    Array.isArray(store.scenarios) && store.scenarios.length === 0,
    `${store.scenarios?.length} scenario(s)`)
  check('the store states what kind of numbers it holds',
    /assumption/i.test(store.model_note || ''), store.model_note)

  // ---- the endpoint refuses to invent a baseline --------------------------
  const noBase = await fetch(`${BASE}/api/v1/mine-twin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mineId: 'balaghat', mineName: 'Balaghat', factors: { a: 1.1 }, selections: {} }),
  })
  check('a scenario without a baseline is refused', noBase.status === 400, `status ${noBase.status}`)

  const noSource = await fetch(`${BASE}/api/v1/mine-twin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mineId: 'balaghat', mineName: 'Balaghat', factors: { a: 1.1 },
      selections: {}, baselineProduction: 14200,
    }),
  })
  check('a baseline without its provenance is refused', noSource.status === 400,
    `status ${noSource.status}`)

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1400 })
  await page.goto(`${BASE}/mine-twin`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(SETTLE)

  const body = () => page.evaluate(() => document.body.innerText)

  // ---- nothing before a run ----------------------------------------------
  {
    const text = await body()
    const seeded = SEEDED.filter((n) => text.includes(n))
    check('none of the seeded demo figures appear', seeded.length === 0, seeded.join(', '))
    check('no scenario is listed before one is run', !/Scenarios you have run \(\d/.test(text) ||
      /Scenarios you have run \(0\)/.test(text))
    check('the estimate is not shown before a run',
      /Set the assumptions below and run|Run the scenario/i.test(text))
  }

  // ---- the assumptions are on screen, with their values -------------------
  {
    const text = await body()
    check('the assumptions panel is present', /Planner assumptions/i.test(text))
    check('it says the coefficients are not fitted',
      /not fitted/i.test(text) && /no data (was )?derived|no data was used/i.test(text),
      (text.match(/.{0,60}not fitted.{0,60}/i) || [''])[0])
    const inputs = await page.$$eval('input[type="number"]', (els) =>
      els.map((e) => ({ label: e.getAttribute('aria-label'), value: e.value })))
    check('every assumption is editable and shows its value',
      inputs.length >= 4 && inputs.every((i) => i.label && i.value),
      JSON.stringify(inputs))
  }

  // ---- run one, and check what it claims ----------------------------------
  {
    const buttons = await page.$$('button')
    let ran = false
    for (const b of buttons) {
      const t = await page.evaluate((e) => e.innerText, b)
      if (/run what-if|run scenario|run simulation/i.test(t)) { await b.click(); ran = true; break }
    }
    check('the scenario can be run', ran)
    await sleep(6000)

    const text = await body()
    check('the result is labelled an assumption-based estimate',
      /assumption-based estimate/i.test(text),
      (text.match(/.{0,80}assumption-based estimate.{0,40}/i) || [''])[0])
    check('the result is not called a forecast or a prediction',
      !/predicted output|digital twin result|\bforecasts? (that|this) scenario/i.test(text))
    check('no risk-change figure is claimed',
      !/shortfall-risk change|risk delta|lowering risk by/i.test(text))

    const badges = await page.$$eval('[data-provenance]', (els) =>
      els.map((e) => e.getAttribute('data-provenance')))
    check('the estimate carries the ASSUMPTION provenance kind',
      badges.includes('assumption'), JSON.stringify([...new Set(badges)]))
    check('the constraint verdict is shown', /Constraint check (passed|failed)/i.test(text),
      (text.match(/Constraint check[^.]{0,80}/i) || [''])[0])
  }

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
