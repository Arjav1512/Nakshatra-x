#!/usr/bin/env node
/**
 * Screenshot + console-error harness for the design work.
 *
 * Captures every route at the four required widths and records any console
 * errors/warnings per route, so "no console errors" is an observation rather
 * than an assumption.
 *
 *   node tools/capture.js --out docs/design/before [--base http://localhost:3000]
 *   node tools/capture.js --out docs/design/after --only /,/console
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const WIDTHS = [375, 768, 1280, 1920]

const ROUTES = [
  // Route set after the Stage 2 consolidation (docs/design/IA.md §5).
  // /dashboard, /preview, /features, /features/:id, /loading and /evaluator are
  // now 308 redirects; tools/e2e-routes.js asserts those.
  '/', '/console', '/production', '/blending', '/mine-twin', '/flood-alert',
  '/method', '/about', '/login', '/admin', '/admin/login', '/admin/setup',
  '/admin/profile', '/auth/callback',
]

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const OUT = path.resolve(arg('out', 'docs/design/before'))
const BASE = arg('base', 'http://localhost:3000')
const ONLY = arg('only', null)
const routes = ONLY ? ONLY.split(',') : ROUTES

const slug = (r) => (r === '/' ? 'root' : r.replace(/^\//, '').replace(/\//g, '_'))

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  })

  const report = []

  for (const route of routes) {
    const page = await browser.newPage()
    const messages = []
    page.on('console', (m) => {
      const t = m.type()
      if (t === 'error' || t === 'warning') messages.push(`${t}: ${m.text().slice(0, 200)}`)
    })
    page.on('pageerror', (e) => messages.push(`pageerror: ${String(e).slice(0, 200)}`))

    let status = 0
    let overflow = {}
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: Math.round(w * 0.75), deviceScaleFactor: 1 })
      try {
        const res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 })
        status = res ? res.status() : 0
      } catch (e) {
        messages.push(`nav: ${String(e.message).slice(0, 120)}`)
      }
      // Let fonts/layout settle without waiting on animation loops.
      // SETTLE_MS is overridable because /console fetches one forecast per mine
      // sequentially; with a warm cache that is ~10 x 0.7s, and the default
      // 1.2s would photograph a screen that is still loading.
      const SETTLE_MS = Number(process.env.SETTLE_MS || 1200)
      await new Promise((r) => setTimeout(r, SETTLE_MS))

      // Horizontal-overflow check at this width.
      try {
        overflow[w] = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        )
      } catch { overflow[w] = null }

      const file = path.join(OUT, `${slug(route)}@${w}.png`)
      try {
        await page.screenshot({ path: file, fullPage: w >= 1280 })
      } catch (e) {
        messages.push(`shot: ${String(e.message).slice(0, 120)}`)
      }
    }
    report.push({ route, status, consoleIssues: messages, horizontalOverflow: overflow })
    const bad = Object.entries(overflow).filter(([, v]) => v).map(([k]) => k)
    console.log(
      `  ${route.padEnd(18)} ${String(status).padStart(3)}  ` +
      `console:${String(messages.length).padStart(3)}  ` +
      `overflow:${bad.length ? bad.join(',') : 'none'}`
    )
    await page.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, '_report.json'), JSON.stringify(report, null, 2))
  const totalIssues = report.reduce((n, r) => n + r.consoleIssues.length, 0)
  const overflowRoutes = report.filter((r) => Object.values(r.horizontalOverflow).some(Boolean))
  console.log(`\n  routes: ${report.length} · console issues: ${totalIssues} · routes with overflow: ${overflowRoutes.length}`)
  console.log(`  wrote ${OUT}/_report.json`)
})()
