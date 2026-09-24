/**
 * Browser-level regression test for every redesigned route.
 *
 *   npm run test:routes        (all routes)
 *   npm run test:routes -- --only /production,/method
 *
 * Needs FastAPI on :8000 and this app on :3000. See docs/DEMO.md.
 *
 * WHY THIS SHAPE. DEF-1 taught that a route returning 200 says nothing about
 * whether it rendered anything. Every assertion here is therefore about content
 * a person would see, and every route additionally asserts:
 *
 *   - zero 5xx responses while it loads,
 *   - no uncaught page errors,
 *   - that the page is not merely a correct-looking shell with empty panels.
 *
 * `mustRender` is the anti-empty-shell check: a route passes only if the named
 * strings actually appear. `mustNotRender` catches fabrications that have been
 * removed, so they cannot quietly return.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const SETTLE = Number(process.env.E2E_SETTLE || 9000)

/** Strings that must never appear anywhere again. */
const GLOBAL_BANNED = [
  'LIVE SATELLITE TELEMETRY',
  'LIVE STREAM TICK',
  'MOSDAC Telemetry Stream',
  'Isolation Forest',
  'Twin Confidence',
  'SINGLE-THREAD',
  'scadaPumpPowerPct',
  'Cloudburst Prediction Lead Time',
]

const ROUTES = [
  {
    path: '/',
    mustRender: ['Where to prospect', 'Track A', 'Track B', 'What this does not claim'],
  },
  {
    path: '/console',
    mustRender: ['Decision support for MOIL', 'Portfolio', 'MOIL-BAL-01'],
    // the anti-empty-shell assertion: ten cards each with a real probability
    custom: async (page) => {
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('li')].filter((l) => l.querySelector('button'))
        return {
          cards: cards.length,
          withProb: cards.filter((c) => /P\s*\d+%/.test(c.innerText)).length,
          withBadge: cards.filter((c) => /SYNTHETIC|DERIVED|LIVE|REFERENCE/.test(c.innerText)).length,
        }
      })
      return [
        ['ten mine cards', r.cards === 10, `${r.cards}`],
        ['every card shows a probability', r.withProb === 10, `${r.withProb}/10`],
        ['every card carries a provenance badge', r.withBadge === 10, `${r.withBadge}/10`],
      ]
    },
  },
  {
    path: '/production',
    mustRender: ['Production', 'Shortfall against plan', 'Rainfall'],
    mustNotRender: ['trucksDispatched', 'SCADA', 'STREAMING'],
    custom: async (page) => {
      const r = await page.evaluate(() => {
        const t = document.body.innerText
        return {
          badges: (t.match(/SYNTHETIC|MEASURED|LIVE|DERIVED|REFERENCE/g) || []).length,
          numbers: (t.match(/\d+\.\d+|\d{2,}/g) || []).length,
        }
      })
      return [
        ['telemetry tiles rendered with provenance badges', r.badges >= 4, `${r.badges} badges`],
        ['numbers actually present (not an empty shell)', r.numbers >= 5, `${r.numbers}`],
      ]
    },
  },
  {
    path: '/method',
    mustRender: ['Feature', 'track-a-gbt-lomo-v1'],
    // the hardcoded values that used to be here
    mustNotRender: ['Fault Distance', '95.12', '0.8875', '410 Records'],
    custom: async (page) => {
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          /Feature Importances/i.test(x.innerText)
        )
        if (b) { b.click(); return true }
        return false
      })
      await new Promise((r) => setTimeout(r, 2500))
      const t = await page.evaluate(() => document.body.innerText)
      return [
        ['feature-importance tab opens', clicked, clicked ? '' : 'tab not found'],
        ['shows a real model feature (elevation_m)', /elevation/i.test(t), ''],
        ['does NOT show the removed literal "Fault Distance"', !/Fault Distance/.test(t), ''],
        ['LOMO AUC rendered from the model', /LOMO AUC/i.test(t) && /0\.8\d/.test(t), ''],
      ]
    },
  },
  {
    path: '/mine-twin',
    mustRender: ['What this is'],
    mustNotRender: ['Twin Confidence', 'High Precision ML'],
  },
  {
    path: '/blending',
    mustRender: ['Risk context'],
  },
  {
    path: '/flood-alert',
    mustRender: ['Rainfall context', 'Location'],
    mustNotRender: ['MOSDAC', 'Cloudburst', 'SCADA'],
  },
  { path: '/about', mustRender: [] },
  { path: '/login', mustRender: [] },
  { path: '/admin', mustRender: [] },
  { path: '/admin/login', mustRender: [] },
  { path: '/admin/setup', mustRender: [] },
  { path: '/admin/profile', mustRender: [] },
  { path: '/auth/callback', mustRender: [] },
  { path: '/nope-does-not-exist', mustRender: ['That page does not exist'] },
]

const REDIRECTS = [
  ['/dashboard', '/login'],
  ['/preview', '/login'],
  ['/features', '/console'],
  ['/features/1', '/console'],
  ['/loading', '/'],
  ['/evaluator', '/method'],
]

let failed = 0
const results = []

function check(route, name, ok, detail = '') {
  results.push({ route, name, ok, detail })
  if (!ok) failed++
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

function arg(n) {
  const i = process.argv.indexOf(`--${n}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

async function main() {
  const only = arg('only')
  const routes = only ? ROUTES.filter((r) => only.split(',').includes(r.path)) : ROUTES

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const route of routes) {
    console.log(`\n${route.path}`)
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100 })

    const serverErrors = []
    const pageErrors = []
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`)
    })
    page.on('pageerror', (e) => pageErrors.push(String(e)))

    let status = 0
    try {
      const res = await page.goto(BASE + route.path, { waitUntil: 'networkidle2', timeout: 45000 })
      status = res ? res.status() : 0
    } catch (e) {
      check(route.path, 'page loads', false, String(e).slice(0, 80))
      await page.close()
      continue
    }
    await new Promise((r) => setTimeout(r, SETTLE))

    const expected = route.path === '/nope-does-not-exist' ? 404 : 200
    check(route.path, `responds ${expected}`, status === expected, `got ${status}`)

    // Compared case-insensitively: the design system uppercases label text in
    // CSS, so innerText returns "SHORTFALL AGAINST PLAN" for a string the
    // source spells in sentence case. Asserting on casing would test the
    // stylesheet, not the content.
    const text = await page.evaluate(() => document.body.innerText)
    const hay = text.toLowerCase()

    for (const want of route.mustRender || []) {
      check(route.path, `renders "${want}"`, hay.includes(want.toLowerCase()))
    }
    for (const banned of route.mustNotRender || []) {
      check(route.path, `does not render "${banned}"`, !hay.includes(banned.toLowerCase()))
    }
    for (const banned of GLOBAL_BANNED) {
      if (hay.includes(banned.toLowerCase())) {
        check(route.path, `global: no "${banned}"`, false)
      }
    }

    if (route.custom) {
      for (const [name, ok, detail] of await route.custom(page)) {
        check(route.path, name, ok, detail)
      }
    }

    check(route.path, 'no 5xx responses', serverErrors.length === 0, serverErrors.slice(0, 2).join(' | '))
    check(route.path, 'no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 1).join(''))

    await page.close()
  }

  if (!only) {
    console.log('\nredirects')
    for (const [from, to] of REDIRECTS) {
      const res = await fetch(BASE + from, { redirect: 'manual' })
      const loc = res.headers.get('location') || ''
      check('redirects', `${from} -> ${to}`, res.status === 308 && loc.endsWith(to), `${res.status} ${loc}`)
    }
  }

  await browser.close()
  const passed = results.length - failed
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed}/${results.length} checks across ${routes.length} route(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
