#!/usr/bin/env node
/**
 * Every control on the demo path, pressed, and the provenance rule applied to
 * what it draws.
 *
 *   npm run test:interactions                     # backend up
 *   npm run test:interactions -- --backend-down   # backend stopped (CI stops it)
 *   npm run test:interactions -- --routes /console?track=a --widths 1280
 *   npm run test:interactions -- --out /tmp/sweep.json
 *
 * WHY THIS EXISTS
 * ---------------
 * Every fabrication found late in this project appeared only after a click.
 * The map's six layers drew sin()-derived captions only once their switcher
 * was pressed; the map-click "dossier" printed "NaN%", a literal 4.2 km fault
 * and literal SWIR values only once a cell was clicked, and it took seconds to
 * appear (POLISH_AUDIT.md issue 1). The page-load guards read the page as it
 * loads, so neither was visible to them.
 *
 * So this finds every interactive element on each demo-path route — buttons,
 * tabs, toggles, layer switches, chips, links, disclosure summaries, map
 * markers and surface cells, and whatever those reveal (popups, panels, close
 * buttons) — activates each one, waits until the requests it started have
 * finished, and applies tools/provenance-rules.js to the resulting page: every
 * data-shaped figure inside a provenance envelope, and no NaN / undefined /
 * Infinity anywhere. With --backend-down the rule is the offline one: nothing
 * data-shaped on screen at all, only the unavailable states.
 *
 * Nothing is skipped silently. An element that is not activated is listed with
 * the reason: an external link, a field that needs typed input, a control that
 * is disabled or not drawn at this width, an app-bar control already pressed on
 * an earlier route, or a surface cell beyond the sample. An element that should
 * have been activated and could not be fails the run.
 */
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer-core')
const { collectTextNodes, violationsIn } = require('./provenance-rules')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BACKEND_DOWN = process.argv.includes('--backend-down')
const OUT = arg('out', process.env.INTERACTIONS_OUT || null)

/** The demo path (docs/DEMO.md): landing, portfolio, a mine, Track A, Mine twin. */
const ROUTES = (arg('routes', null) || '/,/console,/console?mine=1&track=b,/console?track=a,/mine-twin').split(',')
/** Desktop, and the phone layout, where the mine view has its own section tabs. */
const WIDTHS = (arg('widths', null) || '1280,375').split(',').map(Number)

/**
 * Surface cells all run one handler; the map has 1,710 of them. A spread
 * sample is activated (across the visible grid) and the rest are listed as
 * not activated, by count, with that reason.
 */
const CELL_SAMPLE = Number(process.env.SWEEP_CELL_SAMPLE || 6)
/** The longest an activation may take to settle: a map click asks for a live satellite read. */
const SETTLE_CAP_MS = Number(process.env.SWEEP_SETTLE_CAP_MS || 75000)
const QUIET_MS = 700
const ROUTE_SETTLE_MS = Number(process.env.SWEEP_ROUTE_SETTLE_MS || 3000)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * A real pointer click at the element — what a presenter does, and what
 * Leaflet listens for. If the pointer cannot reach it (covered by a panel the
 * previous control opened, or off the map's visible area), a dispatched click
 * event, which also works on SVG paths, where `el.click()` does not exist.
 */
async function activate(handle) {
  try {
    await handle.click()
    return 'pointer'
  } catch {
    await handle.evaluate((el) => {
      el.scrollIntoView({ block: 'center' })
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    return 'dispatched'
  }
}

/* ------------------------------------------------------------------------ */
/* Waiting for "the result": the requests an activation starts, then quiet. */
/* ------------------------------------------------------------------------ */

function trackRequests(page) {
  const inflight = new Set()
  let started = 0
  // Map tiles and fonts stream for as long as the map is on screen; they are
  // not the result of a control.
  const ignored = (req) =>
    ['image', 'font', 'media'].includes(req.resourceType()) || /\/cached-tiles\//.test(req.url())
  page.on('request', (r) => { if (!ignored(r)) { inflight.add(r); started++ } })
  page.on('requestfinished', (r) => inflight.delete(r))
  page.on('requestfailed', (r) => inflight.delete(r))
  return {
    async settle(cap = SETTLE_CAP_MS) {
      const t0 = Date.now()
      let quietSince = null
      await sleep(150) // let the activation's own requests start
      while (Date.now() - t0 < cap) {
        if (inflight.size === 0) {
          quietSince ??= Date.now()
          if (Date.now() - quietSince >= QUIET_MS) return { ms: Date.now() - t0, timedOut: false, requests: started }
        } else {
          quietSince = null
        }
        await sleep(100)
      }
      return { ms: Date.now() - t0, timedOut: true, requests: started, pending: [...inflight].map((r) => r.url()).slice(0, 3) }
    },
    reset() { inflight.clear(); started = 0 },
  }
}

/* ------------------------------------------------------------------------ */
/* Finding every interactive element                                         */
/* ------------------------------------------------------------------------ */

/**
 * Runs in the page. Returns a descriptor per interactive element and tags each
 * element with `data-sweep-id` so it can be found again after re-renders.
 */
function enumerate() {
  const SEL = [
    'button', '[role="button"]', '[role="tab"]', '[role="switch"]', '[role="checkbox"]',
    'a[href]', 'summary', 'select',
    'input:not([type="hidden"])', 'textarea',
    '.leaflet-interactive', '.leaflet-marker-icon', '.leaflet-popup-close-button',
  ].join(',')
  const els = [...document.querySelectorAll(SEL)]
  const label = (el) => (
    el.getAttribute('aria-label') || el.getAttribute('title') ||
    (el.innerText || '').replace(/\s+/g, ' ').trim() ||
    el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('value') || ''
  ).slice(0, 70)
  window.__sweepSeq ??= 0
  // Identical controls (every "+ evidence", every surface cell) are told apart
  // by their order among their twins, which is stable across a reload.
  const twins = new Map()
  return els.map((el) => {
    if (!el.dataset.sweepId) el.dataset.sweepId = String(++window.__sweepSeq)
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    const tag = el.tagName.toLowerCase()
    const type = (el.getAttribute('type') || '').toLowerCase()
    let kind = tag
    if (el.classList.contains('leaflet-interactive')) kind = 'map-cell'
    else if (el.classList.contains('leaflet-marker-icon')) kind = 'map-marker'
    else if (el.classList.contains('leaflet-popup-close-button')) kind = 'popup-close'
    else if (tag === 'input') kind = ['checkbox', 'radio'].includes(type) ? `input-${type}` : 'text-field'
    else if (tag === 'textarea') kind = 'text-field'
    else if (el.getAttribute('role') === 'tab' || el.closest('nav[aria-label="Mine sections"]')) kind = 'tab'
    else if (el.hasAttribute('data-layer-button')) kind = 'layer-switch'
    else if (el.hasAttribute('aria-pressed')) kind = 'toggle'
    const href = tag === 'a' ? el.getAttribute('href') : null
    let external = false
    if (href) {
      try { external = new URL(href, location.href).origin !== location.origin } catch {}
      if (el.getAttribute('target') === '_blank') external = true
    }
    const inChrome = !!el.closest('header, footer')
    const hidden = st.display === 'none' || st.visibility === 'hidden' || (r.width === 0 && r.height === 0)
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true'
    // A stable identity across re-renders and across routes: kind, label,
    // target, and the nearest labelled region.
    const region = el.closest('[aria-label], [data-testid], section, aside, header, footer, nav')
    const regionName = region ? (region.getAttribute('aria-label') || region.getAttribute('data-testid') || region.tagName.toLowerCase()) : ''
    // In a conversation log (the AI-X assistant), a suggestion is the same
    // question wherever it reappears: ask each one once, not once per answer
    // that offers it, or the transcript is an unbounded tree.
    const inLog = !!el.closest('[role="log"]')
    const base = inLog ? `${kind}|${label(el)}|log` : `${kind}|${label(el)}|${href || ''}|${regionName}`
    const nth = inLog ? 0 : (twins.get(base) ?? 0)
    if (!inLog) twins.set(base, nth + 1)
    return {
      id: el.dataset.sweepId, kind, label: label(el), href, external, inChrome, hidden, disabled,
      key: `${base}|${nth}`,
      x: r.left + r.width / 2, y: r.top + r.height / 2,
    }
  })
}

/* ------------------------------------------------------------------------ */
/* The sweep                                                                 */
/* ------------------------------------------------------------------------ */

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const report = { base: BASE, backendDown: BACKEND_DOWN, runs: [] }
  let violationsTotal = 0
  let failedActivations = 0

  for (const width of WIDTHS) {
    const chromeDone = new Map() // app-bar / footer controls: pressed once per width
    for (const route of ROUTES) {
      const run = { route, width, activated: [], notActivated: [], violations: [] }
      report.runs.push(run)
      const page = await browser.newPage()
      await page.setViewport({ width, height: width < 768 ? 812 : 800, isMobile: width < 768, hasTouch: width < 768 })
      // Exports download a file and print; neither may block the run.
      const cdp = await page.createCDPSession()
      await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {})
      await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })
      page.on('dialog', (d) => d.dismiss().catch(() => {}))
      if (BACKEND_DOWN) {
        // As tools/provenance-guard.js --offline: with the service layer
        // stopped, nothing outside this app may answer either, so whatever is
        // on screen came from the client.
        await page.setRequestInterception(true)
        page.on('request', (req) => {
          const url = req.url()
          if (url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')) return req.continue()
          return req.abort().catch(() => {})
        })
      }
      const net = trackRequests(page)
      const routeUrl = `${BASE}${route}`
      const load = async () => {
        await page.goto(routeUrl, { waitUntil: 'networkidle2', timeout: 90000 })
        await net.settle(30000)
        await sleep(ROUTE_SETTLE_MS)
      }
      const check = async (cause) => {
        const nodes = await page.evaluate(collectTextNodes)
        for (const v of violationsIn(nodes, { offline: BACKEND_DOWN })) {
          const key = `${v.text}|${v.where}`
          if (run.violations.some((x) => x.key === key)) continue
          run.violations.push({ key, cause, text: v.text, where: v.where, rule: v.rule })
        }
      }

      try {
        await load()
      } catch (e) {
        run.notActivated.push({ label: '(route)', reason: `route did not load: ${e.message}`, failed: true })
        failedActivations++
        await page.close()
        continue
      }
      await check('page load')

      const seen = new Set()
      let cellsSeen = 0
      let cellsDone = 0

      /** Find an element again by identity: its tag if still there, else its key. */
      const find = async (d) => {
        let h = await page.$(`[data-sweep-id="${d.id}"]`)
        if (h) return h
        const again = (await page.evaluate(enumerate)).find((x) => x.key === d.key)
        return again ? page.$(`[data-sweep-id="${again.id}"]`) : null
      }

      /**
       * Reach an element revealed by other controls: reload the route, then
       * press the controls that revealed it, in order (a modal's button, then
       * the suggestion inside it).
       */
      const reach = async (d, chain) => {
        await load()
        for (const opener of chain) {
          const h = await find(opener)
          if (!h) return null
          await activate(h)
          await net.settle()
        }
        return find(d)
      }

      /** Which of the listed cells to activate: a spread across the visible grid. */
      const sampleCells = (list) => {
        const cells = list.filter((d) => d.kind === 'map-cell' && !d.hidden)
        cellsSeen = Math.max(cellsSeen, cells.length)
        const want = CELL_SAMPLE - cellsDone
        const picked = new Set()
        if (!cells.length || want <= 0) return picked
        const sorted = [...cells].sort((p, q) => p.y - q.y || p.x - q.x)
        for (let i = 0; i < Math.min(want, sorted.length); i++) {
          picked.add(sorted[Math.floor((i * (sorted.length - 1)) / Math.max(1, want - 1))].key)
        }
        return picked
      }

      /**
       * Activate each listed element, then — while whatever it opened is still
       * open — everything it revealed, recursively. `chain` is the path of
       * controls that revealed this list, used to re-open it if a sibling's
       * activation closed it.
       */
      const sweep = async (list, chain) => {
        const sampled = sampleCells(list)
        for (const d of list) {
          if (seen.has(d.key)) continue
          seen.add(d.key)
          const tag = `${d.kind} "${d.label}"${chain.length ? ` (inside ${chain.map((c) => `"${c.label}"`).join(' › ')})` : ''}`
          if (d.kind === 'map-cell' && !sampled.has(d.key)) continue // counted at the end
          if (d.hidden) { run.notActivated.push({ label: tag, reason: `not drawn at ${width} px` }); continue }
          if (d.disabled) { run.notActivated.push({ label: tag, reason: 'disabled' }); continue }
          if (d.external) { run.notActivated.push({ label: tag, reason: `external link (${d.href}) — leaves the app` }); continue }
          if (d.kind === 'text-field') {
            run.notActivated.push({ label: tag, reason: 'text field — needs typed input; the controls that submit it are activated' })
            continue
          }
          if (d.inChrome && chromeDone.has(d.key)) {
            run.notActivated.push({ label: tag, reason: `app-bar / footer control, activated on ${chromeDone.get(d.key)} at this width` })
            continue
          }

          net.reset()
          let how = null
          let error = null
          let h = await find(d)
          if (!h) {
            // Closed or replaced by a sibling's activation: re-open its path.
            h = await reach(d, chain).catch(() => null)
            how = 'after re-opening its path'
          }
          const before = page.url()
          // What is on the page now, so "revealed" means new since this press.
          const present = new Set((await page.evaluate(enumerate)).map((x) => x.key))
          net.reset()
          try {
            if (!h) throw new Error('not present, even after reloading and re-opening the controls that reveal it')
            if (d.kind === 'select') {
              const values = await h.evaluate((sel) => [...sel.options].map((o) => o.value))
              for (const v of values) {
                await h.select(v)
                await net.settle()
                await check(`${tag} → option ${v}`)
              }
              how = `${values.length} options selected`
            } else {
              how = how ? `${await activate(h)}, ${how}` : await activate(h)
            }
          } catch (e) {
            error = e.message
          }
          if (error) {
            run.notActivated.push({ label: tag, reason: `could not activate: ${error}`, failed: true })
            failedActivations++
            continue
          }

          const settled = await net.settle()
          const navigated = page.url() !== before
          await check(tag)
          if (d.kind === 'map-cell') cellsDone++
          run.activated.push({
            label: tag, how, ms: settled.ms, requests: settled.requests,
            navigated: navigated ? page.url().replace(BASE, '') : null,
            timedOut: settled.timedOut || undefined, pending: settled.pending,
          })
          if (d.inChrome) chromeDone.set(d.key, route)
          if (navigated) {
            // Another page: the route scan covers it. Come back.
            await load()
            continue
          }
          // What this control revealed, pressed while it is open.
          if (chain.length < 3) {
            const revealed = (await page.evaluate(enumerate)).filter((x) => !present.has(x.key) && !seen.has(x.key))
            if (revealed.length) await sweep(revealed, [...chain, d])
          }
          // Close whatever it opened (a modal, a menu, a popup) so it does not
          // sit over the next control. Escape is what a user would press.
          await page.keyboard.press('Escape').catch(() => {})
          await sleep(150)
        }
      }

      await sweep(await page.evaluate(enumerate), [])
      // Anything that appeared later on its own (a late render) and was never listed.
      for (let round = 0; round < 2; round++) {
        const late = (await page.evaluate(enumerate)).filter((x) => !seen.has(x.key))
        if (!late.length) break
        await sweep(late, [])
      }
      if (cellsSeen > cellsDone) {
        run.notActivated.push({
          label: `map-cell × ${cellsSeen - cellsDone}`,
          reason: `surface cells beyond the ${cellsDone}-cell spread sample — one handler for all ${cellsSeen} visible cells`,
        })
      }
      violationsTotal += run.violations.length
      await page.close()

      // Report for this route and width.
      const failedHere = run.notActivated.filter((n) => n.failed).length
      const mark = run.violations.length === 0 && failedHere === 0 ? 'PASS' : 'FAIL'
      console.log(`  ${mark}  ${route.padEnd(26)} @${String(width).padEnd(4)}  ${String(run.activated.length).padStart(3)} activated, ${String(run.notActivated.length).padStart(3)} not activated, ${run.violations.length} violation(s)`)
      for (const v of run.violations.slice(0, 10)) {
        console.log(`          ${v.rule}: "${v.text}" in ${v.where}  — after ${v.cause}`)
      }
      for (const n of run.notActivated.filter((x) => x.failed)) console.log(`          COULD NOT ACTIVATE ${n.label}: ${n.reason}`)
      const slow = run.activated.filter((a) => a.timedOut)
      for (const a of slow) console.log(`          still waiting after ${SETTLE_CAP_MS / 1000}s: ${a.label} (${(a.pending || []).join(', ')})`)
    }
  }

  await browser.close()

  // Everything not activated, grouped by reason, so nothing is skipped
  // without being said.
  const reasons = new Map()
  for (const r of report.runs) {
    for (const n of r.notActivated) {
      const reason = n.reason.replace(/\(https?:\/\/[^)]+\)/, '(external)').replace(/ on \/\S* at/, ' on an earlier route at')
      reasons.set(reason, (reasons.get(reason) || 0) + 1)
    }
  }
  console.log('\nNot activated, by reason:')
  for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(4)}  ${reason}`)

  const activated = report.runs.reduce((a, r) => a + r.activated.length, 0)
  if (OUT) fs.writeFileSync(path.resolve(OUT), JSON.stringify(report, null, 2))
  const ok = violationsTotal === 0 && failedActivations === 0
  const mode = BACKEND_DOWN ? 'backend down' : 'backend up'
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${activated} activation(s) across ${ROUTES.length} route(s) x ${WIDTHS.length} width(s), ${mode}: ${violationsTotal} violation(s), ${failedActivations} control(s) that could not be activated`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
