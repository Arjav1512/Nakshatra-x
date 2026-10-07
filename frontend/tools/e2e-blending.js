#!/usr/bin/env node
/**
 * The tonnage a planner enters is the tonnage the solver plans.
 *
 *   npm run test:blending
 *
 * It was not. The Next proxy sent `required_tonnes`; the backend's field was
 * `target_tonnes`, defaulted to 5,000 t, and silently ignored the unknown key —
 * so whatever the slider said, every plan was for 5,000 t. The checks that
 * existed could not see it: the backend test posted straight to FastAPI with
 * the right field name, and the route check only asserted that /blending
 * rendered. Nothing sent a tonnage through the proxy and looked at what came
 * back.
 *
 * This does, through the UI: set the dispatch volume to a value that is not the
 * old default, run the optimiser, and check the request carried it, the
 * response echoes it, and the plan's allocations sum to it.
 */
const puppeteer = require('puppeteer-core')

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const TONNES = 7500 // not 5,000, the old default, and feasible at 41% Mn with the illustrative stockpiles

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })
  await page.goto(`${BASE}/blending`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('#blend-volume', { timeout: 30000 })

  // A React-controlled range input: set through the native setter so React
  // sees the change, as a drag would.
  await page.$eval('#blend-volume', (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, TONNES)
  const shown = await page.$eval('label[for="blend-volume"]', (l) => l.parentElement.innerText)
  check('the slider shows the entered tonnage', shown.includes(TONNES.toLocaleString('en-US')), shown.replace(/\s+/g, ' '))

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/optimize-blending') && r.request().method() === 'POST', { timeout: 30000 }),
    page.$$eval('button', (bs) => {
      const b = bs.find((x) => /Calculate Optimal Stockpile Blending Plan/i.test(x.innerText))
      if (b) b.click()
      return !!b
    }),
  ])
  const sent = JSON.parse(response.request().postData() || '{}')
  check('the request carries the entered tonnage', sent.target_tonnes === TONNES, `target_tonnes ${sent.target_tonnes}`)
  check('the request sends no field the backend would ignore', !('required_tonnes' in sent), Object.keys(sent).join(', '))

  const body = await response.json()
  check('the optimiser answered', response.status() === 200, `HTTP ${response.status()}`)
  check('the plan is feasible', body.success === true, body.message || body.solver_status)
  check('the response echoes the entered tonnage', body.target_tonnes === TONNES, `target_tonnes ${body.target_tonnes}`)
  const allocated = (body.blend_plan || []).reduce((s, p) => s + (p.tonnes_allocated || 0), 0)
  check('the plan sums to the entered tonnage', Math.abs(allocated - TONNES) <= 1,
    `allocated ${allocated.toFixed(1)} t across ${(body.blend_plan || []).length} stockpile(s)`)

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
