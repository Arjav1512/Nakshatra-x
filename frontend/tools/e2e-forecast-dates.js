/**
 * Browser-level regression test for forecast dating (PR: demo hardening).
 *
 *   npm run test:dates
 *
 * Needs FastAPI on :8000 and this app on :3000 (or E2E_BASE).
 *
 * WHY THIS EXISTS
 * ---------------
 * The console served a forecast from a committed artifact and labelled it
 * "horizon 14 d". A reader takes that as "the next fortnight". It is not: the
 * window was fixed when the artifact was generated, so on any later day the
 * screen was quietly claiming a forecast for days it had never forecast — the
 * same class of defect as showing one mine's telemetry under another's name,
 * but in the time dimension.
 *
 * Four things are asserted, on rendered DOM:
 *
 *   1. the forecast's origin date and both ends of its actual window are on
 *      screen, matching the artifact's own fields;
 *   2. the forecast block is marked not-live and is a different element from
 *      the live conditions panel, so "computed" and "measured" cannot be read
 *      as the same kind of number;
 *   3. a window that has ended says so — exercised by serving a past window,
 *      not by waiting for the calendar;
 *   4. the string "next 14 days" never appears.
 *
 * (3) intercepts the forecast response and rewrites only its dates. That is the
 * one honest way to test a date-dependent branch: the alternative is a test
 * that passes for three weeks and then starts failing on its own.
 */
const puppeteer = require('puppeteer-core')

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const SETTLE = Number(process.env.E2E_SETTLE || 12000)

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n          ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 21 Sep 2026 -> "21 Sep", matching the en-GB day/short-month the panel uses. */
function fmt(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
const shift = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Load /console, optionally rewriting the forecast response's dates.
 * `remap` receives the parsed body and returns the body to serve.
 */
async function loadConsole(browser, remap) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1400 })
  const captured = { forecast: null, degraded503: [] }

  // Any 503 the browser receives must still be the backend's own answer. The
  // proxy used to flatten every non-2xx into `{error: 'Forecast unavailable',
  // note: 'could not be reached'}`, which threw away {status:"warming", eta}
  // and told the user the service was down while it was answering correctly.
  page.on('response', async (res) => {
    if (res.status() !== 503 || !/\/(forecast|recommendations)(\?|$)/.test(res.url())) return
    try {
      const b = await res.json()
      captured.degraded503.push({ url: res.url(), status: b?.status ?? null, note: b?.note ?? null })
    } catch {}
  })

  if (remap) {
    await page.setRequestInterception(true)
    page.on('request', async (req) => {
      if (!/\/forecast(\?|$)/.test(req.url())) return req.continue()
      try {
        const upstream = await fetch(req.url())
        const body = await upstream.json()
        const next = remap(body)
        captured.forecast = next
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(next),
        })
      } catch (e) {
        req.continue()
      }
    })
  } else {
    page.on('response', async (res) => {
      if (!/\/forecast(\?|$)/.test(res.url()) || res.status() !== 200) return
      try {
        captured.forecast = await res.json()
      } catch {}
    })
  }

  await page.goto(`${BASE}/console?mine=1&track=b`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await sleep(SETTLE)
  return { page, captured }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  // ---- 1 & 2 & 4: the real artifact, as the demo will serve it ------------
  console.log('\nForecast dating — as served\n')
  {
    const { page, captured } = await loadConsole(browser, null)
    const f = captured.forecast

    check('forecast response carries an origin and a window',
      !!(f && f.forecast_origin && f.window && f.window.start && f.window.end),
      f ? `origin=${f?.forecast_origin} window=${JSON.stringify(f?.window)}` : 'no forecast captured')

    if (!f) {
      await page.close()
      return finish(browser)
    }

    const block = await page.$('[data-testid="forecast-provenance"]')
    check('the forecast carries a dated provenance block', !!block)

    const text = block ? await page.evaluate((el) => el.innerText, block) : ''
    for (const [label, iso] of [
      ['origin', f.forecast_origin],
      ['window start', f.window.start],
      ['window end', f.window.end],
    ]) {
      check(`the ${label} date (${fmt(iso)}) is on screen`,
        text.includes(fmt(iso)), `block text: ${text.slice(0, 220)}`)
    }

    // The forecast must not read as a live reading, and must not be the same
    // element as the panel that is one.
    const liveAttrs = await page.evaluate(() => {
      const fc = document.querySelector('[data-testid="forecast-provenance"]')
      const live = document.querySelector('[data-testid="live-conditions"]')
      return {
        forecastLive: fc?.getAttribute('data-forecast-live'),
        livePanelPresent: !!live,
        sameElement: !!fc && fc === live,
        liveContainsForecast: !!(live && fc && live.contains(fc)),
      }
    })
    check('the forecast is marked not live', liveAttrs.forecastLive === 'false',
      `data-forecast-live=${liveAttrs.forecastLive}`)
    check('a live conditions panel is present and is a distinct element',
      liveAttrs.livePanelPresent && !liveAttrs.sameElement && !liveAttrs.liveContainsForecast,
      JSON.stringify(liveAttrs))

    const pageText = await page.evaluate(() => document.body.innerText)
    check('the phrase "next 14 days" never appears',
      !/next\s+14\s+days/i.test(pageText),
      (pageText.match(/.{0,60}next\s+14\s+days.{0,60}/i) || [''])[0])

    // Passive: only fires if this run happened to hit a warming backend.
    if (captured.degraded503.length === 0) {
      console.log('  ----  no 503 seen this run (backend was warm) — warming passthrough not exercised')
    } else {
      const relabelled = captured.degraded503.filter((d) => d.status !== 'warming')
      check('every 503 reaching the browser is the backend\'s own warming answer',
        relabelled.length === 0, JSON.stringify(relabelled))
    }

    // Whichever branch today falls in, it must be the branch the dates imply.
    const today = new Date().toISOString().slice(0, 10)
    const shouldBeEnded = f.window.end < today
    const ended = await page.evaluate(
      () => document.querySelector('[data-testid="forecast-provenance"]')?.getAttribute('data-window-ended'))
    check(`window ended state matches the dates (end=${f.window.end}, today=${today})`,
      ended === String(shouldBeEnded), `data-window-ended=${ended}`)
    check(shouldBeEnded
      ? 'a past window says its window has ended'
      : 'a current window does not claim to have ended',
      shouldBeEnded === /has already ended/i.test(text), text.slice(0, 220))

    await page.close()
  }

  // ---- 3: the past-window branch, forced ----------------------------------
  console.log('\nForecast dating — window already ended (dates rewritten)\n')
  {
    const past = { origin: null }
    const { page } = await loadConsole(browser, (body) => {
      const today = new Date().toISOString().slice(0, 10)
      const start = shift(today, -40)
      past.origin = shift(start, -1)
      return {
        ...body,
        forecast_origin: past.origin,
        window: { start, end: shift(start, 13) },
      }
    })
    const block = await page.$('[data-testid="forecast-provenance"]')
    const text = block ? await page.evaluate((el) => el.innerText, block) : ''
    const attrs = block
      ? await page.evaluate((el) => ({
          ended: el.getAttribute('data-window-ended'),
          start: el.getAttribute('data-window-start'),
          end: el.getAttribute('data-window-end'),
        }), block)
      : {}

    check('a window in the past is flagged as ended', attrs.ended === 'true', JSON.stringify(attrs))
    check('the panel says the window has already ended',
      /has already ended/i.test(text), text.slice(0, 220))
    check('it still shows the real dates of that past window',
      !!attrs.end && text.includes(fmt(attrs.end)) && text.includes(fmt(attrs.start)),
      text.slice(0, 220))
    check('a past window is not presented as a plan for today',
      /not\s+a\s+plan\s+for\s+today/i.test(text), text.slice(0, 220))

    const pageText = await page.evaluate(() => document.body.innerText)
    check('the phrase "next 14 days" never appears (past-window branch)',
      !/next\s+14\s+days/i.test(pageText))

    await page.close()
  }

  return finish(browser)
}

async function finish(browser) {
  await browser.close()
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failing check(s)\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
