#!/usr/bin/env node
/**
 * One navigation model: the track is part of the location (B-1 confusion 5).
 *
 *   npm run test:nav
 *
 * The console used to choose the track with a separate button pair under the
 * integrity banner — "Track B · production risk / Track A · prospectivity" —
 * while the breadcrumb described the same state in plain text. Two controls for
 * one fact, and a first-time user could not tell whether the buttons were tabs,
 * a filter, or a change of page. The pair also only appeared once you were on
 * Track A or inside a mine, so from the default view Track A had no way in.
 *
 * Asserted here: the breadcrumb is the only track control, it carries the track
 * at both levels, exactly one location is current, every link goes where it
 * says, and going up to Portfolio keeps the track.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
}

const read = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Location"]')
    const live = (el) => el && el.getBoundingClientRect().width > 0
    return {
      url: location.pathname + location.search,
      hasNav: !!nav,
      text: nav ? nav.innerText.replace(/\s+/g, ' ').trim() : '',
      current: [...(nav?.querySelectorAll('[aria-current="page"]') ?? [])].map((e) => e.textContent.trim()),
      trackLinks: [...document.querySelectorAll('[data-track-link]')].filter(live).length,
      competingToggle:
        !!document.querySelector('nav[aria-label="Track"]') ||
        /Track B ·|Track A ·/.test(document.body.innerText),
    }
  })

async function clickVisible(page, selector) {
  await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0)
    if (!el) throw new Error(`no visible ${sel}`)
    el.click()
  }, selector)
  await new Promise((r) => setTimeout(r, 2500))
}

;(async () => {
  console.log(`\nnavigation model — ${BASE}\n`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  const go = async (p) => {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 90000 })
    await page.waitForSelector('nav[aria-label="Location"]', { timeout: 30000 }).catch(() => {})
  }

  console.log('portfolio, default track')
  await go('/console')
  let s = await read(page)
  check('the breadcrumb is a labelled location nav', s.hasNav)
  check('no competing track toggle', !s.competingToggle)
  check('both tracks are in the breadcrumb', s.trackLinks === 2 && /production risk/.test(s.text) && /prospectivity/.test(s.text), s.text)
  check('exactly one current location, and it is the track', s.current.length === 1 && s.current[0] === 'production risk', JSON.stringify(s.current))

  console.log('portfolio -> prospectivity (no way in from here before)')
  try {
    await clickVisible(page, '[data-track-link="A"]')
    s = await read(page)
    check('URL moves to track A', s.url === '/console?track=a', s.url)
    check('current is prospectivity', s.current.length === 1 && s.current[0] === 'prospectivity', JSON.stringify(s.current))
  } catch (e) {
    check('track A is reachable from the default view', false, e.message)
  }

  console.log('mine, track B')
  await go('/console?mine=1&track=b')
  s = await read(page)
  check('mine is in the location', /Portfolio \/ \S.* \/ production risk/.test(s.text), s.text)
  check('no competing track toggle', !s.competingToggle)
  check('exactly one current location', s.current.length === 1 && s.current[0] === 'production risk', JSON.stringify(s.current))

  console.log('mine -> prospectivity -> Portfolio')
  try {
    await clickVisible(page, '[data-track-link="A"]')
    s = await read(page)
    check('URL keeps the mine and switches track', s.url === '/console?mine=1&track=a', s.url)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav[aria-label="Location"] button')].find(
        (x) => x.textContent.trim() === 'Portfolio' && x.getBoundingClientRect().width > 0
      )
      b.click()
    })
    await new Promise((r) => setTimeout(r, 2500))
    s = await read(page)
    check('going up to Portfolio keeps the track', s.url === '/console?track=a', s.url)
  } catch (e) {
    check('mine-level track links work', false, e.message)
  }

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failure(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
