#!/usr/bin/env node
/**
 * The backtest pilot state — a scope decision must not look like a failure.
 *
 *   npm run test:pilot
 *
 * A full rolling-origin backtest refits the model at every origin and takes
 * 216 s, so it is a batch job and only the pilot mine's artifact is committed.
 * For the other nine the console must say so, name the pilot, and link to it —
 * without looking like an error and without offering anything that would start
 * a computation.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const SETTLE = Number(process.env.E2E_SETTLE || 13000)

const PILOT_MINE = 1
const NON_PILOT_MINES = [3, 7]

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1400 })

  // Nothing may ever ask the backend to compute a backtest.
  const computeRequests = []
  page.on('request', (r) => {
    if (/backtest/.test(r.url()) && /compute=true/i.test(r.url())) computeRequests.push(r.url())
  })

  console.log('\nPilot mine — the backtest itself\n')
  await page.goto(`${BASE}/console?mine=${PILOT_MINE}&track=b`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(SETTLE)
  {
    const body = await page.evaluate(() => document.body.innerText)
    check('the pilot mine shows real backtest figures', /MAPE/i.test(body),
      body.slice(0, 160))
    check('the pilot mine does not show the pilot pointer',
      !(await page.$('[data-testid="backtest-pilot"]')))
  }

  for (const id of NON_PILOT_MINES) {
    console.log(`\nNon-pilot mine ${id}\n`)
    await page.goto(`${BASE}/console?mine=${id}&track=b`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(SETTLE)

    const el = await page.$('[data-testid="backtest-pilot"]')
    check(`mine ${id} shows the designed pilot state`, !!el)
    if (!el) continue

    const text = await page.evaluate((e) => e.innerText, el)
    check(`mine ${id} names the pilot mine`, /Balaghat/.test(text), text.slice(0, 160))

    // It must not read as a failure.
    const failWords = /unavailable|error|failed|could not|unable|broken|500|503/i
    check(`mine ${id} does not use failure language`, !failWords.test(text),
      (text.match(/.{0,50}(unavailable|error|failed|could not|unable|broken)[^.]*/i) || [''])[0])

    // Styling: the panel must not use the critical/error colour.
    const critical = await page.evaluate((e) => {
      const cs = getComputedStyle(e)
      return { border: cs.borderColor, bg: cs.backgroundColor, cls: e.className }
    }, el)
    check(`mine ${id} is not styled as an error`, !/status-critical/.test(critical.cls),
      JSON.stringify(critical))

    // A working link to the pilot.
    const href = await page.evaluate(
      (e) => e.querySelector('a')?.getAttribute('href') ?? null, el)
    check(`mine ${id} links to the pilot's backtest`, href === `/console?mine=${PILOT_MINE}&track=b`,
      `href=${href}`)

    // Nothing in the panel can start a computation.
    const buttons = await page.evaluate((e) => e.querySelectorAll('button').length, el)
    check(`mine ${id} offers no control that could compute`, buttons === 0, `${buttons} button(s)`)

    // And the link actually lands on a rendered backtest.
    if (href) {
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle2', timeout: 60000 })
      await sleep(SETTLE)
      const body = await page.evaluate(() => document.body.innerText)
      check(`mine ${id}'s link reaches a rendered backtest`, /MAPE/i.test(body))
    }
  }

  // The landing page must quote the same artifact the console renders.
  console.log('\nLanding page cites the pilot, with the console\'s figures\n')
  {
    await page.goto(`${BASE}/console?mine=${PILOT_MINE}&track=b`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(SETTLE)
    const consoleText = await page.evaluate(() => document.body.innerText)
    const consoleMape = (consoleText.match(/MAPE[^0-9]*([\d.]+)\s?%/i) || [])[1]

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(4000)
    const landing = await page.evaluate(() => document.body.innerText)
    const landingMape = (landing.match(/([\d.]+)%\s*MAPE/i) || [])[1]

    check('the landing page names the pilot mine', /Balaghat/.test(landing))
    check('the landing page states it is the pilot', /pilot mine/i.test(landing),
      (landing.match(/.{0,70}pilot mine.{0,70}/i) || [''])[0])
    check('landing MAPE equals the console MAPE for the same artifact',
      !!landingMape && landingMape === consoleMape,
      `landing=${landingMape} console=${consoleMape}`)

    // Every figure in the band must be attributed and server-rendered.
    const band = await page.evaluate(() =>
      [...document.querySelectorAll('[data-provenance]')].map((e) => e.getAttribute('data-provenance-model')).filter(Boolean))
    check('the landing figures carry a model version', band.length >= 2, JSON.stringify(band))

    const html = await (await fetch(`${BASE}/`)).text()
    check('the landing figures are in the server-rendered HTML, not added after hydration',
      html.includes(String(landingMape)))
  }

  check('no request ever asked the backend to compute a backtest',
    computeRequests.length === 0, computeRequests.join(', '))

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
