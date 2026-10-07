#!/usr/bin/env node
/**
 * The median never renders outside its band (DECISIONS.md D-043, A1).
 *
 *   npm run test:band
 *
 * The forecaster's three quantiles come from independently fitted models, and
 * on one Balaghat day q90 fell below q50: a median outside its own "80% band".
 * The backend now rearranges them and a test checks every artifact, but what a
 * planner sees is the chart, so the chart is checked too.
 *
 * For every mine, every grade: open the forecast, select the grade, and read the
 * rendered SVG. Recharts' monotone curves pass exactly through the data points,
 * so each series path's anchor points (its M point and the end point of every
 * C segment) are the plotted values. At every point, the median line must lie
 * on or between the p10 and p90 edges (SVG y grows downward, so
 * y(p90) <= y(median) <= y(p10)). The count of points is checked against the
 * API's trajectory, so a chart that drew nothing cannot pass.
 */
const puppeteer = require('puppeteer-core')

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const API = process.env.API_BASE || 'http://127.0.0.1:8000/api/v1'
const EPS = 0.5 // half a pixel: anti-aliasing and rounding in Recharts' path output

let failed = 0
let checked = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const mines = await (await fetch(`${API}/mines`)).json()
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1100 })

  for (const mine of mines) {
    const fc = await (await fetch(`${API}/mines/${mine.id}/forecast`)).json()
    if (!fc.grades) {
      check(`${mine.name}: forecast served`, false, fc.status || 'no grades')
      continue
    }
    console.log(`\n${mine.name} (${mine.mine_code})`)
    await page.goto(`${BASE}/console?mine=${mine.id}&track=b`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('[data-grade]', { timeout: 60000 })

    for (const g of fc.grades) {
      await page.$eval(`[data-grade="${g.grade}"]`, (b) => b.click())
      await page.waitForSelector(`[data-forecast-chart="${g.grade}"] .forecast-median path`, { timeout: 20000 })
      await sleep(150)
      const series = await page.$eval(`[data-forecast-chart="${g.grade}"]`, (chart) => {
        const anchors = (path) => {
          if (!path) return null
          const d = path.getAttribute('d') || ''
          const pts = []
          for (const seg of d.match(/[MLC][^MLCZ]*/g) || []) {
            const nums = (seg.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number)
            if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]])
          }
          return pts
        }
        // An Area's outline path starts with its top curve; the median Line is
        // a single curve. Each has the class name set in TrackBPanel.
        const top = (cls) => {
          const p = chart.querySelector(`.${cls} path.recharts-area-curve`) || chart.querySelector(`.${cls} path`)
          return anchors(p)
        }
        return {
          p90: top('forecast-p90'),
          p10: top('forecast-p10'),
          median: anchors(chart.querySelector('.forecast-median path')),
        }
      })

      const n = g.trajectory.length
      const ok = series.p90 && series.p10 && series.median &&
        series.p90.length >= n && series.p10.length >= n && series.median.length >= n
      if (!ok) {
        check(`${g.grade}: chart drew its ${n} points`, false, JSON.stringify({
          p90: series.p90?.length, p10: series.p10?.length, median: series.median?.length,
        }))
        continue
      }
      const outside = []
      for (let i = 0; i < n; i++) {
        const [x, ym] = series.median[i]
        const y90 = series.p90[i][1]
        const y10 = series.p10[i][1]
        if (Math.abs(series.p90[i][0] - x) > EPS || Math.abs(series.p10[i][0] - x) > EPS) {
          outside.push(`day ${i + 1}: series not aligned`)
        } else if (ym < y90 - EPS || ym > y10 + EPS) {
          outside.push(`day ${i + 1}: median y ${ym.toFixed(1)} outside [${y90.toFixed(1)}, ${y10.toFixed(1)}]`)
        }
        checked++
      }
      check(`${g.grade}: median inside its band at all ${n} points`, outside.length === 0, outside.slice(0, 3).join('; '))
    }
  }

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s), ${checked} plotted point(s) checked`)
  process.exit(failed === 0 && checked > 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
