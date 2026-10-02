#!/usr/bin/env node
/**
 * axe on every map layer state, at 1280 and 375.
 *
 *   node tools/a11y-map-layers.js [--base http://localhost:3000]
 *
 * tools/a11y.js audits each route as it first renders, which for the map is one
 * layer. The raster layers' legends add links, status pills and a colour scale
 * bar that only exist once that layer is chosen, so they were never audited.
 * This selects each layer in turn and runs the same WCAG 2.2 AA rule set.
 */
const puppeteer = require('puppeteer-core')
const AXE_SOURCE = require('axe-core').source

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const i = process.argv.indexOf('--base')
const BASE = i > -1 ? process.argv[i + 1] : 'http://localhost:3000'

;(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
  let total = 0
  for (const [w, h] of [[1280, 900], [375, 812]]) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h, isMobile: w < 768 })
    await page.goto(`${BASE}/console?track=a`, { waitUntil: 'networkidle2', timeout: 90000 })
    await page.waitForSelector('[data-layer-button]', { timeout: 60000 })
    await page.addScriptTag({ content: AXE_SOURCE })
    const keys = await page.$$eval('[data-layer-button]', (bs) => bs.map((b) => b.dataset.layerButton))
    for (const key of keys) {
      await page.$eval(`[data-layer-button="${key}"]`, (b) => b.click())
      await new Promise((r) => setTimeout(r, 5000))
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        })
        return r.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, html: v.nodes[0]?.html?.slice(0, 120) }))
      })
      total += res.length
      console.log(`  ${res.length ? 'FAIL' : 'PASS'}  ${key.padEnd(16)} @${w}  ${res.length} serious/critical`)
      for (const v of res) console.log(`          ${v.impact.toUpperCase()} ${v.id} (${v.n})  ${v.html}`)
    }
    await page.close()
  }
  await browser.close()
  console.log(`\n${total === 0 ? 'PASS' : 'FAIL'} — ${total} serious/critical across every map layer at 1280 and 375\n`)
  process.exit(total === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
