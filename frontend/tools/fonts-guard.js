#!/usr/bin/env node
/**
 * The design system's fonts are the ones on screen, and they come from here.
 *
 *   npm run test:fonts
 *
 * Needs this app on :3000 (production build). FastAPI is not required.
 *
 * WHY THIS EXISTS
 * ---------------
 * Inter, Sora and IBM Plex Mono were declared through next/font, downloaded at
 * build time — and never applied. next/font defined its variables on <body>,
 * while the tokens that use them (--font-sans, --font-mono, --font-display) are
 * emitted by Tailwind's @theme on :root, i.e. <html>, where those variables did
 * not exist. So --font-sans resolved to nothing and every page rendered in the
 * system font, through two redesign tranches and every screenshot taken in
 * them. Nothing looked broken; it was found by asking the page what font it was
 * using, during the cold-start rehearsal (docs/DEMO.md).
 *
 * Per route, this asserts what the page reports, not what the CSS says:
 *   - each family the route uses is `loaded` in document.fonts;
 *   - the computed font of the body, the display heading and a data value is
 *     that family;
 *   - every font file came from this origin — none from Google — so the type
 *     survives a venue with no network (and CI runs it with none).
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const SETTLE = Number(process.env.E2E_SETTLE || 4000)

// What each route must show, by role. Sora is display-only (one heading a
// page), so it is checked where that heading is.
const ROUTES = [
  { path: '/console', checks: { body: 'Inter', display: 'Sora', mono: 'IBM Plex Mono' } },
  { path: '/', checks: { body: 'Inter' } },
  { path: '/mine-twin', checks: { body: 'Inter', mono: 'IBM Plex Mono' } },
]

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const first = (stack) => (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '')

;(async () => {
  console.log(`\nfonts — ${BASE}\n`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  for (const route of ROUTES) {
    console.log(route.path)
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    // Every route fetches its own fonts, so the origin check always has requests to judge.
    await page.setCacheEnabled(false)
    const fontRequests = []
    page.on('request', (r) => {
      if (r.resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontRequests.push(r.url())
    })
    await page.goto(BASE + route.path, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise((r) => setTimeout(r, SETTLE))

    const seen = await page.evaluate(async () => {
      await document.fonts.ready
      const fam = (el) => (el ? getComputedStyle(el).fontFamily : null)
      return {
        loaded: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^["']|["']$/g, '')))],
        body: fam(document.body),
        display: fam(document.querySelector('.font-display')),
        mono: fam(document.querySelector('.font-mono')),
      }
    })

    for (const [role, family] of Object.entries(route.checks)) {
      check(`${role}: computed font is ${family}`, first(seen[role]) === family, seen[role] ? first(seen[role]) : `no ${role} element`)
      check(`${role}: ${family} is loaded`, seen.loaded.includes(family), `loaded: ${seen.loaded.join(', ') || 'none'}`)
    }
    const offOrigin = fontRequests.filter((u) => !u.startsWith(BASE))
    check('every font file from this origin, none from Google', offOrigin.length === 0 && fontRequests.length > 0,
      offOrigin.length ? offOrigin.slice(0, 2).join(' | ') : `${fontRequests.length} font file(s), all local`)
    await page.close()
  }
  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failure(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
