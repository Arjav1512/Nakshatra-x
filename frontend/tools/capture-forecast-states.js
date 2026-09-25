#!/usr/bin/env node
/**
 * Screenshots of the two forecast states the demo can show.
 *
 *   node tools/capture-forecast-states.js --state warming --out docs/evidence
 *   node tools/capture-forecast-states.js --state ready   --out docs/evidence
 *
 * Nothing here is faked. `warming` is captured against a genuinely cold backend
 * (artifacts moved aside, NAKSHATRA_SKIP_WARM=1); `ready` against the committed
 * artifacts. The point of the pair is that the cold case is a legible state on
 * screen, not a 503 or a spinner that never resolves.
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}

const STATE = arg('state', 'ready')
const OUT = path.resolve(arg('out', '../docs/evidence'))
const BASE = arg('base', 'http://localhost:3000')
const SETTLE = Number(arg('settle', 12000))

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1250, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/console?mine=1&track=b`, { waitUntil: 'networkidle2', timeout: 90000 })
  await new Promise((r) => setTimeout(r, SETTLE))

  const file = path.join(OUT, `console-forecast-${STATE}.png`)
  await page.screenshot({ path: file })

  // Say what was actually on screen, so the image and the claim cannot drift.
  const seen = await page.evaluate(() => {
    const fc = document.querySelector('[data-testid="forecast-provenance"]')
    const body = document.body.innerText
    return {
      hasDatedBlock: !!fc,
      datedText: fc ? fc.innerText.replace(/\s+/g, ' ').slice(0, 180) : null,
      windowEnded: fc?.getAttribute('data-window-ended') ?? null,
      origin: fc?.getAttribute('data-forecast-origin') ?? null,
      window: fc ? `${fc.getAttribute('data-window-start')} → ${fc.getAttribute('data-window-end')}` : null,
      mentionsWarming: /computing|warming/i.test(body),
      mentionsNext14: /next\s+14\s+days/i.test(body),
    }
  })
  console.log(`${file}\n${JSON.stringify(seen, null, 2)}`)
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
