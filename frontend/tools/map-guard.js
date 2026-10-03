#!/usr/bin/env node
/**
 * Every map layer: it draws, it is not blank, it says where it came from, and
 * it credits its licensor whenever it is visible.
 *
 *   npm run test:map                    # live: Planetary Computer reachable
 *   npm run test:map -- --pc-blocked    # Planetary Computer blocked in the browser
 *   npm run test:map -- --evicted       # every mosaic registration evicted
 *
 * WHY THIS EXISTS
 * ---------------
 * This map has carried six fabricated overlays — sin()/cos() grids captioned as
 * ISRO measurements — and they survived two grep-based sweeps because nothing
 * looked at the pixels. A layer that loads, a layer that is blank, and a layer
 * that is something else under a correct label all return HTTP 200. So this
 * decodes the tiles and samples them.
 *
 * WHAT --pc-blocked PROVES
 * ------------------------
 * Every request to planetarycomputer.microsoft.com is aborted in the browser.
 * The three raster layers must then still draw — from the local tile cache —
 * and must say so: the pill reads CACHED · fetched <date>, every tile on screen
 * came from the cache, and the licensor's notice is still in both the legend
 * and the Leaflet attribution control. A cached tile presented as live, or a
 * cached layer with its attribution dropped, fails.
 *
 * WHAT --evicted PROVES
 * ---------------------
 * Blocking produces network errors, which never reach the 404 branch. Here each
 * tile's FIRST request is answered with Planetary Computer's real eviction
 * response — 404 {"detail":"SearchId `...` not found"}, the body measured
 * against an unregistered id — and later requests go through, as they would
 * once the mosaic is registered again. The map must re-register (one forced
 * call to /api/v1/map/tile-layers, however many tiles 404'd), retry, and end up
 * LIVE. Falling back to the cache here would be the wrong remedy: the tiler is
 * up, only the registration was gone.
 *
 * This is a different failure from the provenance guard's --offline, which
 * means the service layer is DOWN — then the cache is unreachable too and the
 * honest outcome is "unavailable". Both are checked; neither stands in for the
 * other.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const PC_BLOCKED = process.argv.includes('--pc-blocked')
const EVICTED = process.argv.includes('--evicted')
const ROUTE = '/console?track=a'
const TILE_LAYERS = ['s2-true-colour', 'iron-oxide', 'dem']
const VECTOR_LAYERS = { probability: 'derived', uncertainty: 'derived', measured: 'measured' }
/** Distinct colours across a 32x32 downsample of up to four tiles. A blank or
 * solid tile gives one or two; real imagery gives hundreds. */
const MIN_DISTINCT = 40
const TILE_WAIT_MS = 30000

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
}

async function state(page, id) {
  return page.evaluate((id) => {
    const imgs = [...document.querySelectorAll(`img[data-tile-layer="${id}"]`)]
    const loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0 && i.dataset.tileSource)
    const colours = new Set()
    let tainted = false
    for (const img of loaded.slice(0, 4)) {
      try {
        const c = document.createElement('canvas')
        c.width = 32
        c.height = 32
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0, 32, 32)
        const d = g.getImageData(0, 0, 32, 32).data
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) colours.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
      } catch {
        tainted = true
      }
    }
    const legend = document.querySelector('[data-layer-legend]')
    const ctl = [...document.querySelectorAll('.leaflet-control-attribution [data-attribution-layer]')]
    return {
      onScreen: imgs.length,
      loaded: loaded.length,
      sources: [...new Set(loaded.map((i) => i.dataset.tileSource))],
      distinct: colours.size,
      tainted,
      legendId: legend?.dataset.layerLegend ?? null,
      legendKind: legend?.dataset.provenance ?? null,
      pill: legend?.querySelector('[data-tile-source]')?.textContent?.trim() ?? null,
      pillMode: legend?.querySelector('[data-tile-source]')?.dataset.tileSource ?? null,
      facts: [...(legend?.querySelectorAll('dt') ?? [])].map((d) => d.textContent.trim()),
      factText: legend?.innerText ?? '',
      legendAttribution: legend?.querySelector(`[data-attribution-layer="${id}"]`)?.textContent?.trim() ?? null,
      controlAttribution: ctl.find((e) => e.dataset.attributionLayer === id)?.textContent?.trim() ?? null,
      controlLayers: ctl.map((e) => e.dataset.attributionLayer),
      paths: document.querySelectorAll('.leaflet-overlay-pane path').length,
    }
  }, id)
}

/**
 * Click a layer's button, or record that it is not there.
 *
 * A missing button is a failure to report, not a crash: run against a build
 * without these layers, the guard should list everything that is absent rather
 * than stop at the first one — which is what makes it useful as a revert-proof.
 */
async function select(page, id) {
  const el = await page.$(`[data-layer-button="${id}"]`)
  check('layer is in the switcher', !!el, el ? '' : `no [data-layer-button="${id}"] on the page`)
  if (!el) return false
  await el.click()
  return true
}

async function waitForTiles(page, id) {
  const t0 = Date.now()
  let s
  while (Date.now() - t0 < TILE_WAIT_MS) {
    s = await state(page, id)
    // Settled: something loaded and the pill has left 'loading'.
    if (s.loaded > 0 && s.pillMode && s.pillMode !== 'loading') break
    await new Promise((r) => setTimeout(r, 750))
  }
  return s
}

;(async () => {
  const mode = PC_BLOCKED ? 'PLANETARY COMPUTER BLOCKED' : EVICTED ? 'MOSAIC REGISTRATIONS EVICTED' : 'live'
  console.log(`\nmap guard — ${BASE}${ROUTE} — ${mode}\n`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  let pcAborted = 0
  let evicted404s = 0
  let forcedReregisters = 0
  const seenTiles = new Set()
  if (EVICTED) {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/v1/map/tile-layers') && url.includes('force=1')) forcedReregisters++
      if (url.includes('planetarycomputer.microsoft.com') && url.includes('/tiles/') && !seenTiles.has(url)) {
        seenTiles.add(url)
        evicted404s++
        const sid = (/mosaic\/([0-9a-f]+)\//.exec(url) || [])[1] || 'unknown'
        return req.respond({
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ detail: `SearchId \`${sid}\` not found` }),
        }).catch(() => {})
      }
      return req.continue().catch(() => {})
    })
  }
  if (PC_BLOCKED) {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.url().includes('planetarycomputer.microsoft.com')) {
        pcAborted++
        return req.abort('internetdisconnected').catch(() => {})
      }
      return req.continue().catch(() => {})
    })
  }

  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle2', timeout: 90000 })
  // Any switcher at all, so a slow mount is not mistaken for a missing layer.
  await page.waitForSelector('[data-layer-button]', { timeout: 60000 }).catch(() => {})

  // ---- the three vector layers -------------------------------------------
  for (const [id, kind] of Object.entries(VECTOR_LAYERS)) {
    console.log(`${id}`)
    if (!(await select(page, id))) continue
    let s
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500))
      s = await state(page, id)
      if (s.legendId === id && s.facts.length) break
    }
    check('features drawn', s.paths > 6, `${s.paths} paths (6 are state boundaries)`)
    check(`legend is this layer's and says ${kind}`, s.legendId === id && s.legendKind === kind,
      `legend=${s.legendId} kind=${s.legendKind}`)
    check('legend states its provenance', s.facts.includes('Quantity') && s.facts.includes('Source kind'),
      s.facts.join(' | '))
    check('no raster tiles or raster attribution left behind',
      s.onScreen === 0 && TILE_LAYERS.every((t) => !s.controlLayers.includes(t)),
      `controlLayers=${s.controlLayers.join(',')}`)
    if (id === 'measured') {
      check('measured points are not called LIVE', !/\bLIVE\b/.test(s.factText),
        'they come from a training table, not this request')
    }
  }

  // ---- the three raster layers -------------------------------------------
  for (const id of TILE_LAYERS) {
    console.log(`${id}`)
    if (!(await select(page, id))) continue
    const s = await waitForTiles(page, id)

    check('tiles load', s.loaded > 0, `${s.loaded} of ${s.onScreen} on screen`)
    check('tiles are not blank', !s.tainted && s.distinct >= MIN_DISTINCT,
      `${s.distinct} distinct colours sampled${s.tainted ? ' (canvas tainted)' : ''}`)

    if (EVICTED) {
      check('every tile on screen is live — re-registered, not fallen back to cache',
        s.sources.length === 1 && s.sources[0] === 'live', `sources: ${s.sources.join(', ') || 'none'}`)
      check('pill says LIVE', s.pill === 'LIVE', `pill: "${s.pill}"`)
    } else if (PC_BLOCKED) {
      check('every tile on screen came from the cache', s.sources.length === 1 && s.sources[0] === 'cache',
        `sources: ${s.sources.join(', ') || 'none'}`)
      check('pill says CACHED with the fetch date', /^CACHED · fetched \d{4}-\d{2}-\d{2}$/.test(s.pill ?? ''),
        `pill: "${s.pill}"`)
      check('the attribution control says cached',
        !!s.controlAttribution && /cached · fetched \d{4}-\d{2}-\d{2}/.test(s.controlAttribution),
        s.controlAttribution ?? 'absent')
    } else {
      check('every tile on screen is live', s.sources.length === 1 && s.sources[0] === 'live',
        `sources: ${s.sources.join(', ') || 'none'}`)
      check('pill says LIVE', s.pill === 'LIVE', `pill: "${s.pill}"`)
    }

    // Provenance, whichever way the pixels arrived.
    const need = ['Collection', 'Mosaic', 'Quantity', 'Attribution', 'Cloud filter']
    if (id !== 'dem') need.push('Dates')
    if (id !== 's2-true-colour') need.push('Scale')
    const missing = need.filter((f) => !s.facts.includes(f))
    check('legend states collection, dates, cloud filter, mosaic, scale, quantity, attribution',
      missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : s.facts.join(' | '))

    // Attribution present in the DOM while visible — legend AND control.
    const required = id === 'dem' ? /© DLR e\.V\..*Airbus Defence and Space.*COPERNICUS/ : /Contains modified Copernicus Sentinel data \d{4}/
    check("licensor's notice in the legend", !!s.legendAttribution && required.test(s.legendAttribution),
      s.legendAttribution ?? 'absent')
    check("licensor's notice in the Leaflet attribution control",
      !!s.controlAttribution && required.test(s.controlAttribution), s.controlAttribution ?? 'absent')

    if (id === 'iron-oxide') {
      check('iron-oxide caveat on screen: not a manganese detector, surface only',
        /not a manganese detector/.test(s.factText) && /below the surface/.test(s.factText))
    }
  }

  if (PC_BLOCKED) {
    check('Planetary Computer was actually blocked', pcAborted > 0, `${pcAborted} requests aborted`)
  }
  if (EVICTED) {
    check('tiles really were answered with the eviction 404', evicted404s > 0, `${evicted404s} tiles 404'd once`)
    // Deduped: one forced re-register per burst, not one per tile. Three layers
    // are visited, so at most a handful in total.
    check('the map re-registered, and not once per tile',
      forcedReregisters >= 1 && forcedReregisters <= TILE_LAYERS.length * 2,
      `${forcedReregisters} forced re-register(s) for ${evicted404s} evicted tiles`)
  }

  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failure(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
