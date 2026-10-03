#!/usr/bin/env node
/**
 * Layout shift, measured directly, on every key route at 375 and 1280.
 *
 *   npm run test:cls
 *
 * WHY NOT ONLY LIGHTHOUSE
 * -----------------------
 * A single Lighthouse run cannot tell a regression from timing. Measured on
 * the same build, /method read 0.193 in one Lighthouse run and 0.008 in a direct
 * probe, while /blending — untouched by the change being judged — swung the
 * other way. A threshold that flips on run order is not a gate.
 *
 * So this observes `layout-shift` entries in the page itself, three runs per
 * route and width, and fails on the WORST run, not the average: a shift that
 * happens one load in three still happens to someone. On failure it names the
 * elements that moved and by how much, because "CLS 0.118" is not something
 * anyone can fix, and "the list moved 10px when the band above it grew" is.
 *
 * What it caught while it was being written:
 *   - the footer drawn mid-screen while a page is still short, then shoved off
 *     it as content arrives (0.144 on a mine's detail; every route);
 *   - the evidence row drawn under a spinner, then pushed off-screen (0.193);
 *   - mine cards re-ranking after every forecast arrival (up to 0.255);
 *   - a focal-band reservation set at 136px for content now 146-170px (0.118).
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const RUNS = Number(process.env.CLS_RUNS || 3)
const LIMIT = 0.1
const ROUTES = process.env.CLS_ROUTES
  ? process.env.CLS_ROUTES.split(',')
  : ['/', '/console', '/console?mine=1&track=b', '/console?track=a', '/production', '/blending', '/method', '/mine-twin']
/**
 * Orderings a fast local machine never produces on its own.
 *
 * The mine route passed this guard at first and still failed Lighthouse at 375
 * (0.110): on a fast machine the live telemetry happened to arrive before the
 * forecast, so the integrity banner was already in place. When it arrived after,
 * the banner appeared above the answer and pushed it down 129px. Delaying
 * /telemetry by 2s reproduced the shift exactly, so the guard now forces that
 * ordering, and the failure path too, instead of relying on luck.
 */
const SCENARIOS = process.env.CLS_SCENARIOS === '0' ? [] : [
  { route: '/console?mine=1&track=b', label: 'telemetry 2s late', match: '/telemetry', delay: 2000 },
  { route: '/console?mine=1&track=b', label: 'telemetry fails', match: '/telemetry', fail: true },
]
const VIEWPORTS = [
  { w: 375, h: 812, mobile: true },
  { w: 1280, h: 800, mobile: false },
]

let failed = 0

;(async () => {
  console.log(`\nlayout shift — ${BASE} — worst of ${RUNS} runs must be < ${LIMIT}\n`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const jobs = []
  for (const route of ROUTES) for (const vp of VIEWPORTS) jobs.push({ route, vp })
  for (const sc of SCENARIOS) for (const vp of VIEWPORTS) jobs.push({ route: sc.route, vp, sc })
  for (const { route, vp, sc } of jobs) {
    {
      const totals = []
      let worstShifts = []
      for (let run = 0; run < RUNS; run++) {
        const page = await browser.newPage()
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mobile })
        if (sc) {
          await page.setRequestInterception(true)
          page.on('request', (req) => {
            if (!req.url().includes(sc.match)) return req.continue().catch(() => {})
            if (sc.fail) return req.abort('connectionrefused').catch(() => {})
            setTimeout(() => req.continue().catch(() => {}), sc.delay)
          })
        }
        await page.evaluateOnNewDocument(() => {
          window.__shifts = []
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (e.hadRecentInput) continue
              window.__shifts.push({
                v: e.value,
                src: (e.sources || []).slice(0, 3).map((s) => {
                  const n = s.node
                  const tag = n && n.nodeType === 1 ? n.tagName.toLowerCase() : '#text'
                  const text = n && n.textContent ? n.textContent.replace(/\s+/g, ' ').trim().slice(0, 32) : ''
                  return `${tag} "${text}" y ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`
                }),
              })
            }
          }).observe({ type: 'layout-shift', buffered: true })
        })
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 90000 })
        await new Promise((r) => setTimeout(r, 7000))
        const shifts = await page.evaluate(() => window.__shifts)
        const total = shifts.reduce((a, s) => a + s.v, 0)
        if (!totals.length || total > Math.max(...totals)) worstShifts = shifts
        totals.push(total)
        await page.close()
      }
      const worst = Math.max(...totals)
      const ok = worst < LIMIT
      if (!ok) failed++
      const name = sc ? `${route} (${sc.label})` : route
      console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(26)} @${String(vp.w).padEnd(4)} worst ${worst.toFixed(3)}  runs [${totals.map((t) => t.toFixed(3)).join(', ')}]`
      )
      if (!ok) {
        for (const s of worstShifts.filter((x) => x.v >= 0.01).slice(0, 4)) {
          console.log(`          ${s.v.toFixed(3)}  ${s.src.join(' | ')}`)
        }
      }
    }
  }
  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} route/width(s) at or over ${LIMIT}\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
