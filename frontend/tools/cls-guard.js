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
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const totals = []
      let worstShifts = []
      for (let run = 0; run < RUNS; run++) {
        const page = await browser.newPage()
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mobile })
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
      console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(26)} @${String(vp.w).padEnd(4)} worst ${worst.toFixed(3)}  runs [${totals.map((t) => t.toFixed(3)).join(', ')}]`
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
