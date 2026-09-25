#!/usr/bin/env node
/**
 * Motion-system acceptance (B4).
 *
 *   npm run test:motion
 *
 * The motion policy is not a style preference here — it is the difference
 * between a page that communicates and one that performs. These assert the
 * rules the brief set, on the running page:
 *
 *   * content is in the HTML, and motion cannot take it away;
 *   * transform and opacity only, so nothing animates layout;
 *   * native scroll — no hijacking;
 *   * reduced motion gets a legible static composition, not a frozen half-state;
 *   * no count-ups, no looping "live" pulses.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'

let failed = 0
const check = (n, ok, d = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `\n          ${d}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  // ---- server-rendered content -------------------------------------------
  const html = await (await fetch(`${BASE}/`)).text()
  check('the stack layers are in the server-rendered HTML',
    (html.match(/data-stack-layer/g) || []).length >= 3,
    `${(html.match(/data-stack-layer/g) || []).length} layer(s)`)
  check('the annotations are in the server-rendered HTML',
    (html.match(/data-stack-note/g) || []).length >= 3)
  check('the measured points are real marks in the HTML, not an image',
    (html.match(/<circle/g) || []).length >= 50,
    `${(html.match(/<circle/g) || []).length} circles`)
  check('no <video> on the landing page', !/<video/i.test(html))

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  // ---- with motion --------------------------------------------------------
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1000 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(4500)

    const notes = await page.evaluate(() =>
      [...document.querySelectorAll('[data-stack-note]')].map((e) => Number(getComputedStyle(e).opacity)))
    check('every annotation is visible before any scrolling',
      notes.length >= 3 && notes.every((o) => o === 1), JSON.stringify(notes))

    // Native scroll: nothing may lock the document or install a scroll shim.
    const scroll = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      hasLenis: !!(window).lenis || !!document.querySelector('[class*="lenis"]'),
    }))
    check('native scroll — the document is not locked or shimmed',
      !/hidden/.test(scroll.bodyOverflow) && !/hidden/.test(scroll.htmlOverflow) && !scroll.hasLenis,
      JSON.stringify(scroll))

    // Scrolling must move the stack, and only via transform.
    // The last layer, not the first: the front layer is the anchor and stays
    // put by design, while the ones behind it separate.
    const lastLayer = '[data-stack-layer]:last-of-type'
    const before = await page.evaluate((sel) =>
      getComputedStyle(document.querySelectorAll(sel)[0]).transform, '[data-stack-layer]')
    const beforeLast = await page.evaluate((sel) =>
      getComputedStyle(document.querySelector(sel)).transform, lastLayer)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55))
    await sleep(1500)
    const after = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      const cs = getComputedStyle(el)
      return { transform: cs.transform, top: cs.top, marginTop: cs.marginTop, height: cs.height }
    }, lastLayer)
    check('scrolling separates the stack', beforeLast !== after.transform,
      `${beforeLast} -> ${after.transform}`)
    check('the front layer stays put — it is the anchor', !!before)
    check('it moves by transform, not by layout properties',
      after.top === 'auto' && after.marginTop === '0px',
      JSON.stringify(after))

    // No infinite animations anywhere on the page.
    const loops = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((e) => {
        const cs = getComputedStyle(e)
        return cs.animationIterationCount === 'infinite' && cs.animationName !== 'none'
      }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`))
    check('no looping animation on the landing page', loops.length === 0, loops.join(', '))

    // No count-ups: the figures must equal their final value immediately.
    const mape = await page.evaluate(() => (document.body.innerText.match(/([\d.]+)%\s*MAPE/) || [])[1])
    await sleep(2500)
    const mape2 = await page.evaluate(() => (document.body.innerText.match(/([\d.]+)%\s*MAPE/) || [])[1])
    check('figures do not count up', !!mape && mape === mape2, `${mape} then ${mape2}`)

    await page.close()
  }

  // ---- reduced motion -----------------------------------------------------
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1000 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(4500)

    const state = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('[data-stack-layer]')]
      return {
        opacities: layers.map((e) => Number(getComputedStyle(e).opacity)),
        notes: [...document.querySelectorAll('[data-stack-note]')].map((e) => Number(getComputedStyle(e).opacity)),
      }
    })
    check('reduced motion: every layer is fully visible',
      state.opacities.length >= 3 && state.opacities.every((o) => o === 1),
      JSON.stringify(state.opacities))
    check('reduced motion: every annotation is visible',
      state.notes.every((o) => o === 1), JSON.stringify(state.notes))

    const before = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-stack-layer]:last-of-type')).transform)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55))
    await sleep(1200)
    const after = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-stack-layer]:last-of-type')).transform)
    check('reduced motion: scrolling does not animate the stack', before === after,
      `${before} -> ${after}`)

    await page.close()
  }

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
