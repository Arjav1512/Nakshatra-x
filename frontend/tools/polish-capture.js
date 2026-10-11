#!/usr/bin/env node
/**
 * Demo-path screenshots for the pitch polish (docs/design/POLISH_AUDIT.md).
 *
 *   node tools/polish-capture.js --out ../docs/design/polish/before
 *   node tools/polish-capture.js --out /tmp/x --only 1366 --screens portfolio,balaghat
 *   node tools/polish-capture.js --out /tmp/w --washout      # projector simulation
 *
 * Needs FastAPI on :8000 and this app on :3000, like tools/demo-walk.js.
 *
 * Only the screens of the three-minute demo (docs/DEMO.md), at the widths a
 * pitch is actually shown at. Browser zoom is emulated the way the browser
 * applies it: at 125% a 1366x768 screen lays the page out in 1093x614 CSS
 * pixels, each drawn 1.25 device pixels wide. Shots are of the whole screen
 * (what the room sees without scrolling) and, where the page scrolls, of the
 * full page.
 *
 * --washout simulates a projector in a lit hall: black lifted to about 20% and
 * contrast cut to 65%, applied as a CSS filter over the whole page, imagery
 * included.
 *
 * Next to the images, `_capture.json` records where the elements a presenter
 * points at sit relative to the fold, so "below the fold" is a measurement.
 */
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const OUT = path.resolve(arg('out', '../docs/design/polish/before'))
const BASE = arg('base', 'http://localhost:3000')
const ONLY = arg('only', null)
const SCREENS = arg('screens', null)
const WASHOUT = process.argv.includes('--washout')

const VIEWPORTS = [
  { id: '1280', width: 1280, height: 800, dpr: 1, full: true },
  { id: '1366', width: 1366, height: 768, dpr: 1, full: true },
  { id: '1366z125', width: 1093, height: 614, dpr: 1.25, full: false },
  { id: '1920', width: 1920, height: 1080, dpr: 1, full: true },
  { id: '1920z125', width: 1536, height: 864, dpr: 1.25, full: false },
  { id: '375', width: 375, height: 812, dpr: 1, full: true, mobile: true },
]

const LAYERS = ['probability', 'uncertainty', 'measured', 's2-true-colour', 'iron-oxide', 'dem']
const TABS = ['Answer', 'Drivers', 'Evidence', 'Actions']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { base: BASE, washout: WASHOUT, viewports: {}, console_errors: {} }

async function waitFor(page, fn, timeout = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn).catch(() => false)) return true
    await sleep(250)
  }
  return false
}

/** Top and bottom of the first element matching, in page CSS pixels. */
const box = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) }
  }, selector)

const boxByText = (page, selector, src) =>
  page.evaluate(
    (sel, s) => {
      const rx = new RegExp(s, 'i')
      const el = [...document.querySelectorAll(sel)].find((x) => rx.test(x.innerText))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) }
    },
    selector,
    src,
  )

async function washout(page) {
  if (!WASHOUT) return
  await page.addStyleTag({
    content: 'html { filter: contrast(0.65) brightness(1.15) !important; }',
  })
}

/**
 * Screens carrying satellite imagery are saved as JPEG (quality 82): a PNG of
 * a map is about 1 MB, and the evidence set covers six viewports twice.
 * Interface-only screens stay PNG so text is not smeared.
 */
const file = (vp, name, photo) => path.join(OUT, `${vp.id}-${name}.${photo ? 'jpg' : 'png'}`)
const opts = (photo) => (photo ? { type: 'jpeg', quality: 82 } : {})

async function shoot(page, vp, name, { full = vp.full, photo = false } = {}) {
  await washout(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(200)
  await page.screenshot({ path: file(vp, name, photo), ...opts(photo) })
  if (full) {
    await page.screenshot({ path: file(vp, `${name}-full`, photo), fullPage: true, ...opts(photo) })
  }
}

async function snap(page, vp, name, photo = false) {
  await washout(page)
  await page.screenshot({ path: file(vp, name, photo), ...opts(photo) })
}

async function open(page, url, ready, settle = 1500) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
  if (ready) await waitFor(page, ready, 45000)
  await sleep(settle)
}

const screens = {
  async landing(page, vp, m) {
    await open(page, '/', null, 3000)
    m.landing = {
      h1: await box(page, 'h1'),
      fonts: await page.evaluate(async () => {
        await document.fonts.ready
        return [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))]
      }),
    }
    await shoot(page, vp, '01-landing')
  },

  async portfolio(page, vp, m) {
    await open(page, '/console', () =>
      document.querySelectorAll('[data-testid="mine-list"] > li button').length === 10)
    m.portfolio = {
      focal_band: await boxByText(page, 'button', 'Largest expected shortfall'),
      list: await box(page, '[data-testid="mine-list"]'),
      withdrawn: await box(page, '[data-testid="p-withdrawn"]'),
    }
    await shoot(page, vp, '02-portfolio')
  },

  async balaghat(page, vp, m) {
    await open(page, '/console?mine=1', () =>
      !!document.querySelector('[data-forecast-chart] svg') && /Model MAPE/i.test(document.body.innerText), 2500)
    m.balaghat = {
      shortfall_tile: await boxByText(page, '[data-metric]', '.'),
      expected_shortfall: await boxByText(page, '[data-provenance="derived"]', '^EXPECTED SHORTFALL'),
      chart: await box(page, '[data-forecast-chart]'),
      backtest: await boxByText(page, 'p', '^Backtest'),
      actions: await boxByText(page, 'h2', 'What to do about it'),
    }
    await shoot(page, vp, '03-balaghat')
    if (vp.mobile) {
      for (const tab of TABS) {
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll('nav[aria-label="Mine sections"] button')]
            .find((x) => x.innerText.trim() === t)
          b?.click()
        }, tab)
        await sleep(600)
        await shoot(page, vp, `03-balaghat-tab-${tab.toLowerCase()}`)
      }
    }
  },

  async minetwin(page, vp, m) {
    await open(page, '/mine-twin', () =>
      [...document.querySelectorAll('button')].some((b) => /RUN WHAT-IF SIMULATION/i.test(b.innerText)), 2000)
    const click = (src) =>
      page.evaluate((s) => {
        const rx = new RegExp(s, 'i')
        const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.innerText))
        b?.click()
        return !!b
      }, src)
    await click('RUN WHAT-IF SIMULATION')
    await waitFor(page, () => /Constraint check passed/i.test(document.body.innerText), 20000)
    await click('^\\+6H DELAY$')
    await sleep(300)
    await click('RUN WHAT-IF SIMULATION')
    await waitFor(page, () => /Constraint check failed/i.test(document.body.innerText), 20000)
    await sleep(800)
    m.minetwin = { verdict: await boxByText(page, 'div,p,section', '^Constraint check failed') }
    await shoot(page, vp, '04-minetwin')
    // The verdict itself, scrolled to, as the room sees it at that beat.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('div,p,section')]
        .find((x) => /^Constraint check failed/i.test(x.innerText))
      el?.scrollIntoView({ block: 'center' })
    })
    await sleep(400)
    await snap(page, vp, '04-minetwin-verdict')
  },

  async tracka(page, vp, m) {
    await open(page, '/console?track=a', () =>
      document.querySelectorAll('[data-layer-button]').length > 0 && /LOMO AUC/i.test(document.body.innerText), 4000)
    m.tracka = {
      map: await box(page, '.leaflet-container'),
      metrics: await boxByText(page, '[data-provenance]', 'LOMO AUC'),
    }
    await shoot(page, vp, '05-tracka', { photo: true })
    for (const layer of LAYERS) {
      await page.evaluate((k) => document.querySelector(`[data-layer-button="${k}"]`)?.click(), layer)
      await sleep(4500)
      await page.evaluate(() =>
        document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'start' }))
      await sleep(300)
      await snap(page, vp, `05-tracka-layer-${layer}`, true)
    }
  },

  /** A click on a surface cell: what the map's own "click any cell" opens. */
  async dossier(page, vp, m) {
    await open(page, '/console?track=a', () =>
      document.querySelectorAll('path.leaflet-interactive').length > 20, 4000)
    await page.evaluate(() =>
      document.querySelector('.leaflet-container')?.scrollIntoView({ block: 'start' }))
    await sleep(500)
    const pt = await page.evaluate(() => {
      const map = document.querySelector('.leaflet-container').getBoundingClientRect()
      const cells = [...document.querySelectorAll('path.leaflet-interactive')]
        .map((p) => p.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.left > map.left + 40 && r.right < map.right - 40 &&
          r.top > map.top + 40 && r.bottom < map.bottom - 40)
      const r = cells[Math.floor(cells.length / 2)]
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    })
    if (pt) {
      await page.mouse.click(pt.x, pt.y)
      // The map also asks the model for a live read of the clicked point, which
      // can take most of a minute; the panel it opens is what is captured.
      m.dossier_seconds = await (async () => {
        const t0 = Date.now()
        await waitFor(page, () => /Dossier|Prospectivity model unavailable/i.test(document.body.innerText), 75000)
        return Math.round((Date.now() - t0) / 1000)
      })()
      await sleep(800)
    }
    m.dossier = {
      clicked: !!pt,
      text: await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')]
          .filter((x) => /Dossier|Prospectivity model unavailable/i.test(x.innerText) && x.innerText.length < 1500)
          .at(-1)
        return el ? el.innerText.slice(0, 600) : null
      }),
    }
    await snap(page, vp, '06-map-click', true)
  },
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  })
  const vps = ONLY ? VIEWPORTS.filter((v) => ONLY.split(',').includes(v.id)) : VIEWPORTS
  const names = SCREENS ? SCREENS.split(',') : Object.keys(screens)
  for (const vp of vps) {
    const page = await browser.newPage()
    await page.setViewport({
      width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr,
      isMobile: !!vp.mobile, hasTouch: !!vp.mobile,
    })
    const errors = []
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text().slice(0, 200)))
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
    const m = { width: vp.width, height: vp.height, dpr: vp.dpr }
    for (const name of names) {
      const t0 = Date.now()
      try {
        await screens[name](page, vp, m)
        console.log(`  ${vp.id.padEnd(9)} ${name.padEnd(10)} ${Math.round((Date.now() - t0) / 1000)}s`)
      } catch (e) {
        console.log(`  ${vp.id.padEnd(9)} ${name.padEnd(10)} FAILED: ${e.message}`)
        m[`${name}_error`] = e.message
      }
    }
    report.viewports[vp.id] = m
    report.console_errors[vp.id] = [...new Set(errors)]
    await page.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, '_capture.json'), JSON.stringify(report, null, 2))
  console.log(`\n${OUT}/_capture.json`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
