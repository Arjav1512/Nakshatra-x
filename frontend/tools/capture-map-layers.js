#!/usr/bin/env node
/**
 * Every map layer, photographed, at 1280 and 375.
 *
 *   node tools/capture-map-layers.js --out docs/design/after-v3/map [--base URL]
 *
 * Clicks each layer in the switcher, waits until its tiles or features and its
 * legend have settled, and screenshots the map card. Layers are discovered from
 * the page rather than listed here, so run against a build with different layers
 * (main has two) and it photographs what that build actually has.
 */
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const OUT = path.resolve(arg('out', 'docs/design/after-v3/map'))
const BASE = arg('base', 'http://localhost:3000')
const WIDTHS = [[1280, 900], [375, 812]]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  const report = []
  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h, isMobile: w < 768 })
    await page.goto(`${BASE}/console?track=a`, { waitUntil: 'networkidle2', timeout: 90000 })
    // The app bar is sticky, and an element screenshot scrolls the element under
    // it, so the bar was stamped across the middle of every map shot. Not part
    // of what is being photographed; taken out of the flow for the capture only.
    await page.addStyleTag({ content: 'body > header, header.sticky { position: static !important; }' })
    await page.waitForSelector('[data-layer-button]', { timeout: 60000 })
    await new Promise((r) => setTimeout(r, 4000))
    const keys = await page.$$eval('[data-layer-button]', (bs) => bs.map((b) => b.dataset.layerButton))
    for (const key of keys) {
      await page.$eval(`[data-layer-button="${key}"]`, (b) => b.click())
      // Settle: raster tiles loaded, or vector features drawn, and the legend in.
      const t0 = Date.now()
      while (Date.now() - t0 < 25000) {
        const ok = await page.evaluate((k) => {
          const tiles = [...document.querySelectorAll(`img[data-tile-layer="${k}"]`)].filter((i) => i.complete && i.naturalWidth > 0)
          const paths = document.querySelectorAll('.leaflet-overlay-pane path').length
          const legend = document.querySelector('[data-layer-legend]')?.dataset.layerLegend
          return tiles.length > 0 || (paths > 6 && (!legend || legend === k))
        }, key)
        if (ok) break
        await new Promise((r) => setTimeout(r, 500))
      }
      await new Promise((r) => setTimeout(r, 1500))
      const card = await page.evaluateHandle(() => document.querySelector('.leaflet-container')?.closest('.rounded-md') ?? document.querySelector('.leaflet-container'))
      await card.asElement().scrollIntoView()
      const file = path.join(OUT, `${key}@${w}.png`)
      await card.asElement().screenshot({ path: file })
      const pill = await page.$eval('[data-layer-legend] [data-tile-source]', (e) => e.textContent).catch(() => null)
      report.push({ layer: key, width: w, file: path.basename(file), source: pill })
      console.log(`  ${key.padEnd(16)} @${w}  ${pill ?? ''}`)
    }
    await page.close()
  }
  fs.writeFileSync(path.join(OUT, '_layers.json'), JSON.stringify(report, null, 2))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
