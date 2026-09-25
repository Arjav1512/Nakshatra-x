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
const SETTLE = Number(process.env.E2E_SETTLE || 9000)

const ROUTES = process.env.GUARD_ROUTES ? process.env.GUARD_ROUTES.split(',') : [
  '/', '/console', '/console?mine=1&track=b', '/console?track=a',
  '/production', '/blending', '/mine-twin', '/flood-alert',
  '/method', '/about', '/login', '/admin', '/admin/login', '/admin/setup',
  '/admin/profile', '/auth/callback',
]

/**
 * Text that looks like a measurement.
 *
 * Deliberately broad — a false positive costs one allowlist entry with a
 * reason, a false negative costs an unattributed number on screen.
 */
const DATA_SHAPED = [
  /\d+(?:\.\d+)?\s?%/,                               // 99.1%
  /\d[\d,]*(?:\.\d+)?\s?(?:t|kt|Mt|tonnes?)\b/i,     // 12,689 t
  /\d+(?:\.\d+)?\s?(?:mm|cm|km|m|ha|km²)\b/,         // 104.71 mm
  /\d+(?:\.\d+)?\s?°\s?[CF]?/,                       // 25.74 °C
  /\d+(?:\.\d+)?\s?(?:hours?|hrs?|days?)\b\/?(?:week|day)?/i,  // not bare `d`: "3D Map" is not a duration
  /\b0\.\d{2,}\b/,                                   // 0.812 — a probability or score
  /\b\d{1,3}(?:,\d{3})+\b/,                          // 12,689
  /₹\s?[\d,]+/,                                      // currency
]

/**
 * Chrome that is legitimately numeric and is not a measurement.
 * Every entry needs a reason; an allowlist without reasons becomes a dumping
 * ground and the guard stops meaning anything.
 */
const ALLOW = [
  { re: /^\s*\d{4}-\d{2}-\d{2}\s*$/,            why: 'ISO date' },
  { re: /\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/, why: 'human date' },
  { re: /\bv\d+(?:\.\d+)*\b/,                    why: 'version string' },
  { re: /\b\d+\.\d+\.\d+\b/,                     why: 'semantic version' },
  { re: /\bPRD\b|§\s?\d|\b[A-Z]-\d+\b|\bN-\d+\b|\bD-\d+\b/, why: 'PRD / requirement reference' },
  { re: /\bSIH\s?\d+\b/,                         why: 'problem statement number' },
  { re: /\b(?:19|20)\d{2}\b/,                    why: 'calendar year' },
  { re: /^\s*\d{1,2}\s*$/,                       why: 'bare small integer — pagination, list index, axis tick' },
  { re: /nakshatra-[a-z0-9-]+/i,                 why: 'model or generator version identifier' },
  { re: /seasonal-naive-\d+-v\d+/,               why: 'baseline version identifier' },
  { re: /track-a-[a-z0-9-]+/i,                   why: 'Track A model version identifier' },
  { re: /\b\d{1,2}:\d{2}\b/,                     why: 'clock time' },
  { re: /MOIL-[A-Z]{3}-\d{2}/,                   why: 'mine code' },
  { re: /\b(?:past|last|previous|rolling|over|preceding)\s+\d+\s*(?:days?|hours?|weeks?|months?)\b/i,
    why: 'time-window phrase in prose — names the window a figure covers, is not itself a figure' },
]

const results = []
let failed = 0

function allowed(text) {
  for (const a of ALLOW) if (a.re.test(text)) return a.why
  return null
}

function looksLikeData(text) {
  return DATA_SHAPED.some((re) => re.test(text))
}

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
  return page.evaluate(() => {
    const out = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walker.nextNode())) {
      const text = (n.textContent || '').trim()
      if (!text) continue
      const el = n.parentElement
      if (!el) continue
      // Invisible text is not a claim to anyone.
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      if (el.closest('[aria-hidden="true"]')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue

      const attributed = !!el.closest('[data-provenance]')
      const where = []
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        where.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string'
          ? '.' + e.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
          : ''))
        if (where.length >= 3) break
      }
      out.push({ text: text.slice(0, 120), attributed, where: where.join(' < ') })
    }
    return out
  })
}

async function scan(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 })
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

  for (const route of ROUTES) {
    let nodes
    try {
      nodes = await scan(page, route)
    } catch (e) {
      console.log(`  ERROR ${route}: ${e.message}`)
      failed++
      continue
    }
    const violations = []
    let attributedCount = 0
    for (const node of nodes) {
      if (!looksLikeData(node.text)) continue
      if (node.attributed) { attributedCount++; continue }
      const why = allowed(node.text)
      if (why) continue
      violations.push(node)
    }
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
    path.resolve(__dirname, '..', '..', 'docs', 'design', 'after-v2', '_provenance-guard.json'),
    JSON.stringify({ base: BASE, routes: results }, null, 2)
  )
  console.log(`\n${total === 0 ? 'PASS' : 'FAIL'} — ${total} unattributed data-shaped value(s) across ${ROUTES.length} routes\n`)
  process.exit(REPORT ? 0 : total === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
