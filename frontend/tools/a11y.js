/**
 * Accessibility audit: axe-core driven through puppeteer-core.
 *
 * The brief asks for axe-core via Playwright. puppeteer-core is already a
 * dependency of this project and drives the same headless Chrome, so it is used
 * here rather than adding a second browser automation stack for one check. The
 * rules, the engine and the results are axe-core's either way.
 *
 *   node tools/a11y.js --base http://localhost:3000 [--only /,/console]
 */
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer-core')
const AXE_SOURCE = require('axe-core').source
const { auditStatusLabels } = require('./status-labels')

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const ALL_ROUTES = [
  // Route set after the Stage 2 consolidation (docs/design/IA.md §5).
  // /dashboard, /preview, /features, /features/:id, /loading and /evaluator
  // are now 308 redirects and are covered by tools/e2e-routes.js instead.
  '/', '/console', '/production', '/blending', '/mine-twin', '/flood-alert',
  '/method', '/about', '/login', '/admin', '/admin/login', '/admin/setup',
  '/admin/profile', '/auth/callback', '/nope-does-not-exist',
  // A mine's detail and the prospectivity map are where PR B changed the most,
  // and neither was in this list: they are deep links, not top-level routes.
  '/console?mine=1&track=b', '/console?track=a',
]

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

;(async () => {
  const base = arg('base', 'http://localhost:3000')
  const only = arg('only', null)
  const routes = only ? only.split(',').map((s) => s.trim()) : ALL_ROUTES
  const settle = Number(arg('settle', 2500))

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const report = []
  let totalSerious = 0
  let totalStatus = 0
  let unaudited = 0

  /**
   * Both widths, every route.
   *
   * This audited 1280 only, and that is a blind spot rather than a shortcut:
   * responsive utilities change what exists. The AI-X button's label is
   * `hidden sm:inline`, so below 640px the button had no accessible name at
   * all — a serious violation this run passed for months because it never
   * looked at a narrow viewport. Lighthouse's mobile emulation found it.
   */
  const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
  ]

  for (const { name: vp, width, height } of VIEWPORTS) {
  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width, height })
    // A networkidle2 timeout on a page that keeps loading map tiles is still a
    // page worth auditing. Anything else is not: this used to swallow every
    // navigation error, so with the server down axe audited Chrome's own error
    // page, found no status labels (no minimum), and the run PASSED (BUG-2).
    let response = null
    let notAudited = null
    try {
      response = await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
    } catch (e) {
      if (!(e && e.name === 'TimeoutError')) notAudited = e.message
    }
    if (!notAudited && page.url().startsWith('chrome-error://')) notAudited = 'browser error page'
    if (!notAudited && response && response.status() >= 500) notAudited = `HTTP ${response.status()}`
    if (!notAudited && !(await page.$('#main'))) notAudited = 'not an app document (no #main)'
    if (notAudited) {
      unaudited++
      report.push({ route, viewport: vp, width, notAudited })
      console.log(`${vp.padEnd(8)} ${route.padEnd(18)} NOT AUDITED — ${notAudited}`)
      await page.close()
      continue
    }
    await new Promise((r) => setTimeout(r, settle))

    await page.evaluate(AXE_SOURCE)
    const results = await page.evaluate(async () => {
      // WCAG 2.2 AA is the target; axe tags map to exactly these rule sets.
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        sample: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 160)),
      }))
    })

    const serious = results.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    totalSerious += serious.length
    report.push({ route, viewport: vp, width, violations: results, seriousOrCritical: serious.length })

    const flag = serious.length === 0 ? 'PASS' : `FAIL (${serious.length})`
    console.log(
      `${vp.padEnd(8)} ${route.padEnd(18)} ${String(results.length).padStart(2)} total  ` +
        `${String(serious.length).padStart(2)} serious/critical  ${flag}`
    )
    for (const v of serious) {
      console.log(`    ${v.impact.toUpperCase().padEnd(8)} ${v.id} (${v.nodes}) — ${v.help}`)
    }
    // After axe, because measuring scrolls each label into view.
    const status = await auditStatusLabels(page, `${vp} ${route}`)
    totalStatus += status.fails.length
    report[report.length - 1].statusLabels = status.rows
    await page.close()
  }
  }

  await browser.close()

  const out = arg('out', null)
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(report, null, 2))
  }

  const ok = totalSerious === 0 && totalStatus === 0 && unaudited === 0
  console.log(
    `\n${ok ? 'PASS' : 'FAIL'} — ${totalSerious} serious/critical violations and ${totalStatus} status label(s) below threshold or unverifiable across ${routes.length} route(s) x 2 viewports (1280, 375)` +
      (unaudited ? `; ${unaudited} route/viewport(s) NOT AUDITED` : '')
  )
  process.exit(ok ? 0 : 1)
})()
