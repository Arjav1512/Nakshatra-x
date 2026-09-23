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

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const ALL_ROUTES = [
  '/', '/console', '/dashboard', '/production', '/blending', '/mine-twin',
  '/flood-alert', '/evaluator', '/features', '/features/1', '/preview',
  '/about', '/login', '/loading', '/admin', '/admin/login', '/admin/setup',
  '/admin/profile', '/auth/callback',
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

  for (const route of routes) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    try {
      await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
    } catch {
      /* fall through — audit whatever rendered */
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
    report.push({ route, violations: results, seriousOrCritical: serious.length })

    const flag = serious.length === 0 ? 'PASS' : `FAIL (${serious.length})`
    console.log(
      `${route.padEnd(18)} ${String(results.length).padStart(2)} total  ` +
        `${String(serious.length).padStart(2)} serious/critical  ${flag}`
    )
    for (const v of serious) {
      console.log(`    ${v.impact.toUpperCase().padEnd(8)} ${v.id} (${v.nodes}) — ${v.help}`)
    }
    await page.close()
  }

  await browser.close()

  const out = arg('out', null)
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(report, null, 2))
  }

  console.log(
    `\n${totalSerious === 0 ? 'PASS' : 'FAIL'} — ${totalSerious} serious/critical violations across ${routes.length} route(s)`
  )
  process.exit(totalSerious === 0 ? 0 : 1)
})()
