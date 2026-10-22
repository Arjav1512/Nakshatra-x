#!/usr/bin/env node
/**
 * B-6 — rendered-page provenance guard.
 *
 *   npm run test:provenance            # gate: fails on any unattributed value
 *   npm run test:provenance -- --report  # list everything it sees, and stop
 *
 * WHY THIS EXISTS
 * ---------------
 * Every integrity sweep on this project has been grep-based, and grep keeps
 * missing things. The map's six fabricated layers survived the Phase 8
 * fabrication sweep *and* Stage 2's silent-default sweep, because their numbers
 * were produced at render time by `sin()` and `cos()` and never appeared as
 * literals in any source file. They were found by looking at the screen.
 *
 * So this checks the screen. It walks the rendered DOM of every route, finds
 * text that looks like a measurement, and fails if that text is not inside an
 * element carrying `data-provenance`. A number nobody can attribute is the
 * thing this project keeps promising not to show.
 *
 * It cannot tell a true number from a false one. What it can do is make the
 * absence of attribution mechanical rather than a matter of noticing.
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const REPORT = process.argv.includes('--report')
/**
 * Offline mode: the backend is down, so nothing that needs it may render.
 *
 * With the service layer stopped, every data-shaped value still on screen came
 * from the client — an embedded copy, a constant, or something invented in a
 * catch block. Attribution is not the question here; presence is. A
 * `data-provenance="reference"` on a plan target that the client carries its own
 * copy of is still a second register that can drift from the first, which is
 * the defect DEF-1 was.
 */
const OFFLINE = process.argv.includes('--offline')
const SETTLE = Number(process.env.E2E_SETTLE || 9000)

const ROUTES = process.env.GUARD_ROUTES ? process.env.GUARD_ROUTES.split(',') : [
  '/', '/console', '/console?mine=1&track=b', '/console?track=a',
  '/production', '/blending', '/mine-twin', '/flood-alert',
  '/method', '/about', '/login', '/admin', '/admin/login', '/admin/setup',
  '/admin/profile', '/auth/callback',
]

// What counts as a figure, what is allowed, and the rule itself live in
// tools/provenance-rules.js, shared with tools/interaction-sweep.js, which
// applies the same rule after every click.
const { allowed, collectTextNodes, looksLikeData, violationsIn } = require('./provenance-rules')

const results = []
let failed = 0
/** Routes that never loaded. They used to count toward nothing in the exit
 *  code, so with the server down every route errored and the guard PASSED (BUG-1). */
let unscanned = 0

/**
 * Some values only exist after an interaction.
 *
 * The six fabricated map layers were behind a layer switcher: nothing was on
 * screen until you clicked "ISRO Bhuvan", and then a 9x9 grid of sin()-derived
 * circles appeared captioned "SWIR Mineral Ratio: 2.19 · Ore Horizon Boundary
 * Verified". A guard that only read the default view would have missed them
 * exactly as every earlier sweep did, so the switcher is clicked through.
 */
const INTERACTIONS = [
  { match: /^\/console\?track=a/, clickAll: '[data-layer-button]', label: 'map layers' },
]

async function collect(page) {
  return page.evaluate(collectTextNodes)
}

async function scan(page, route) {
  // A networkidle2 timeout on a page that keeps loading map tiles is still the
  // route's content, so it is scanned, as a11y.js does. A page that did not
  // load, an HTTP error, or a document that is not the app is not scanned, and
  // counts against the run (BUG-1).
  let res = null
  try {
    res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 })
  } catch (e) {
    if (!(e && e.name === 'TimeoutError')) throw e
  }
  if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`)
  if (page.url().startsWith('chrome-error://')) throw new Error('browser error page')
  if (!(await page.$('#main'))) throw new Error('not an app document (no #main)')
  await new Promise((r) => setTimeout(r, SETTLE))

  const nodes = await collect(page)

  // Cross-tree mode: click every button on the page.
  //
  // The revert-proof runs this same script against an older commit whose layer
  // switcher has no `data-layer-button` and whose map sits behind a tab with no
  // URL state. A selector tuned to today's markup would pass there by finding
  // nothing, which would prove the opposite of what a revert-proof is for.
  if (process.env.GUARD_CLICK_ALL_BUTTONS === '1') {
    const before = page.url()
    let clicked = 0
    // Two passes: the first click may reveal controls that did not exist when
    // the list was queried. On the pre-fix tree the map sat behind a "Track A"
    // tab, and its layer switcher — the thing that rendered the fabricated
    // captions — only mounted after that tab was pressed.
    for (let pass = 0; pass < 2; pass++) {
      const buttons = await page.$$('button')
      for (const b of buttons.slice(0, 40)) {
        try {
          await b.click()
          clicked++
          await new Promise((r) => setTimeout(r, 900))
          if (page.url() !== before) {
            await page.goto(before, { waitUntil: 'networkidle2', timeout: 60000 })
            await new Promise((r) => setTimeout(r, SETTLE))
            continue
          }
          nodes.push(...(await collect(page)))
          // Open whatever this control just drew. Leaflet keeps its captions in
          // popups that exist only while open, and a layer's shapes are only on
          // the map while that layer is the active one — so the shapes are
          // clicked here, inside the loop, not once at the end.
          const drawn = await page.$$('.leaflet-interactive')
          for (const sh of drawn.slice(0, 6)) {
            try {
              await sh.click()
              await new Promise((r) => setTimeout(r, 350))
              nodes.push(...(await collect(page)))
            } catch {}
          }
        } catch {
          // Detached or non-interactive; nothing new rendered.
        }
      }
    }
    // Leaflet renders its captions into popups that exist only while open, so
    // the map's own shapes are clicked too. This is where the fabricated layer
    // captions lived: "SWIR Mineral Ratio: 2.19 · Ore Horizon Boundary
    // Verified", built from sin() of a loop index and never present in any
    // source file as a literal.
    const shapes = await page.$$('.leaflet-interactive')
    for (const sh of shapes.slice(0, 25)) {
      try {
        await sh.click()
        await new Promise((r) => setTimeout(r, 500))
        nodes.push(...(await collect(page)))
      } catch {
        // Off-screen or detached.
      }
    }
    console.log(`          (clicked ${clicked} buttons over 2 passes, ${Math.min(shapes.length, 25)} map shapes)`)
    return nodes
  }

  const plan = INTERACTIONS.find((i) => i.match.test(route))
  if (plan) {
    const handles = await page.$$(plan.clickAll)
    for (const h of handles) {
      try {
        await h.click()
        await new Promise((r) => setTimeout(r, 1200))
        nodes.push(...(await collect(page)))
      } catch {
        // A button that cannot be clicked renders nothing new; skip it.
      }
    }
    if (handles.length) {
      console.log(`          (clicked ${handles.length} ${plan.label})`)
    }
  }
  return nodes
}

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1200 })

  if (OFFLINE) {
    // "Backend down" has to mean the app has no data source at all.
    //
    // Stopping FastAPI alone is not enough: some Next route handlers call
    // upstreams directly, so `/blending` still rendered a real measured
    // rainfall figure with a LIVE badge — correct, live, and nothing to do
    // with the service layer. That is not a fabrication, so the test would
    // have been carving an exception around a true value. Blocking every
    // outbound request instead makes the question unambiguous: with no data
    // reachable, anything still on screen came from the client.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      const local = url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')
      if (local) return req.continue()
      return req.abort().catch(() => {})
    })
  }

  for (const route of ROUTES) {
    let nodes
    try {
      nodes = await scan(page, route)
    } catch (e) {
      console.log(`  ERROR ${route}: ${e.message}`)
      failed++
      unscanned++
      continue
    }
    const violations = violationsIn(nodes, { offline: OFFLINE })
    const attributedCount = nodes.filter((n) => n.attributed && looksLikeData(n.text) && !allowed(n.text)).length
    results.push({ route, attributed: attributedCount, violations })
    const mark = violations.length === 0 ? 'PASS' : 'FAIL'
    if (violations.length) failed++
    console.log(`  ${mark}  ${route.padEnd(30)} ${attributedCount} attributed, ${violations.length} unattributed`)
    for (const v of violations.slice(0, REPORT ? 100 : 8)) {
      console.log(`          "${v.text}"   in  ${v.where}`)
    }
  }

  await browser.close()
  const total = results.reduce((a, r) => a + r.violations.length, 0)
  fs.writeFileSync(
    // GUARD_OUT redirects the report. The default is tranche 2's evidence
    // directory, which every later run was silently overwriting.
    process.env.GUARD_OUT
      ? path.resolve(process.env.GUARD_OUT)
      : path.resolve(__dirname, '..', '..', 'docs', 'design', 'after-v2', '_provenance-guard.json'),
    JSON.stringify({ base: BASE, routes: results }, null, 2)
  )
  const label = OFFLINE ? 'data-shaped value(s) rendered with the backend down' : 'unattributed data-shaped value(s)'
  const ok = total === 0 && unscanned === 0
  console.log(
    `\n${ok ? 'PASS' : 'FAIL'} — ${total} ${label} across ${ROUTES.length} routes` +
      (unscanned ? `; ${unscanned} route(s) NOT SCANNED` : '') + '\n'
  )
  process.exit(REPORT ? 0 : ok ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
