#!/usr/bin/env node
/**
 * The mine selectors and the mine-twin route read FastAPI's register, and
 * nothing else.
 *
 *   npm run test:mine-register                     # backend up (offline or live)
 *   npm run test:mine-register -- --backend-down   # backend stopped (CI stops it)
 *
 * Needs this app on :3000 (E2E_BASE to override) and Chrome (CHROME_PATH).
 *
 * WHY THIS EXISTS. /blending, /method and /mine-twin chose a mine from
 * `FALLBACK_MINES`, a register of one (Balaghat) typed into the client, and the
 * mine-twin route accepted a scenario only for a mine in that same list. So
 * the pages offered one mine of the register's ten, and with the service layer
 * down they still offered it. lint:mine-register keeps a copy from being
 * written again; this checks what the pages and the route do.
 *
 * BACKEND UP
 *   - Each page's mine select lists the register's mines, in its order, by its
 *     ids, and preselects the first. Choosing the last mine shows that mine.
 *   - The mine-twin route runs a scenario for the register's last mine under
 *     the register's name, and refuses an id the register does not have and
 *     the old slug.
 *
 * BACKEND DOWN
 *   - Each page says the register is unavailable, offers no mine and names
 *     none. Nothing is preselected.
 *   - The mine-twin route refuses every id with a 503 shaped like the telemetry
 *     route's (`is_live: false`, a message only), since it cannot check one.
 *
 * The names and codes it looks for are parsed from FastAPI's seed register by
 * the same reader lint:mine-register uses, so this keeps no list of its own.
 */
const puppeteer = require('puppeteer-core')
const { readRegister } = require('./mine-register-guard')

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const BACKEND_DOWN = process.argv.includes('--backend-down')
const PAGES = ['/blending', '/method', '/mine-twin']

/** What a refusal that carries no data may hold, as in test:telemetry. */
const MESSAGE_KEYS = new Set(['error', 'detail', 'note', 'is_live', 'served_by'])
const MINE_CODE = /MOIL-[A-Z]{3}-\d{2}/

let failed = 0
function check(ok, label, detail) {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n          ${detail}` : ''}`)
}

async function getJson(path) {
  try {
    const res = await fetch(BASE + path, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch (e) {
    return { status: -1, body: null, error: String(e?.message || e) }
  }
}

async function postScenario(mineId) {
  try {
    const res = await fetch(`${BASE}/api/v1/mine-twin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mineId,
        factors: { shiftWindow: 1.06 },
        selections: { shiftWindow: '06-14' },
        baselineProduction: 13000,
        baselineSource: 'test:mine-register',
      }),
      signal: AbortSignal.timeout(60000),
    })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = null }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: -1, body: null, text: String(e?.message || e) }
  }
}

function numbersIn(value, at = '$', out = []) {
  if (typeof value === 'number') out.push(`${at} = ${value}`)
  else if (Array.isArray(value)) value.forEach((v, i) => numbersIn(v, `${at}[${i}]`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) numbersIn(v, `${at}.${k}`, out)
  return out
}

/**
 * Read the page's mine control: the select labelled "Mine". Failing that, the
 * row of buttons it replaced (a fieldset whose legend is "Mine"), so that run
 * against a build without the select this reports which mines were offered,
 * not only that the control is different.
 */
async function readMineControl(page) {
  return page.evaluate(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Mine')
    const select = label?.htmlFor ? document.getElementById(label.htmlFor) : null
    if (select?.tagName === 'SELECT') {
      return {
        kind: 'select',
        options: [...select.options].map((o) => ({ value: o.value, text: o.textContent.trim() })),
        value: select.value,
        selectId: select.id,
        text: document.body.innerText,
      }
    }
    const group = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent.trim() === 'Mine')
    const buttons = group ? [...group.querySelectorAll('button')] : []
    return {
      kind: group ? 'buttons' : null,
      options: group ? buttons.map((b) => ({ value: b.textContent.trim(), text: b.textContent.trim() })) : null,
      value: buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent.trim() ?? null,
      selectId: null,
      text: document.body.innerText,
    }
  })
}

async function waitForRegister(page) {
  // The register has answered when the select or the unavailable state is up.
  await page
    .waitForFunction(
      () =>
        /Mine register unavailable/.test(document.body.innerText) ||
        [...document.querySelectorAll('select')].some((s) => s.options.length > 0),
      { timeout: 30000 }
    )
    .catch(() => {})
}

async function pagesUp(browser, mines) {
  for (const route of PAGES) {
    console.log(`\n${route}`)
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 })
    await waitForRegister(page)
    const c = await readMineControl(page)
    check(c.kind === 'select', 'a mine select, labelled "Mine"',
      c.kind === 'buttons' ? 'a row of mine buttons instead' : c.kind ? '' : 'no mine control labelled "Mine"')
    if (!c.options) { await page.close(); continue }

    const want = mines.map((m) => String(m.id))
    const got = c.options.map((o) => o.value)
    check(JSON.stringify(got) === JSON.stringify(want), `lists the register's ${mines.length} mines, by id, in order`,
      `options ${JSON.stringify(got)} vs register ${JSON.stringify(want)}`)
    const misnamed = mines.filter((m, i) => !c.options[i]?.text.includes(m.name) || !c.options[i]?.text.includes(m.mine_code))
    check(misnamed.length === 0, 'each option names its mine as the register does',
      misnamed.map((m) => m.mine_code).join(', '))
    check(c.value === want[0], 'the register\'s first mine is preselected', `selected ${JSON.stringify(c.value)}`)

    if (c.kind !== 'select') { await page.close(); continue }

    // Choose the last mine: the page now shows it (the old register had one).
    const last = mines[mines.length - 1]
    await page.select(`[id="${c.selectId}"]`, String(last.id))
    const shown = await page
      .waitForFunction((name) => document.querySelector('main')?.innerText.split(name).length > 2, { timeout: 15000 }, last.name)
      .then(() => true)
      .catch(() => false)
    // /method names the mine once in its body text besides the option.
    const shownOnce = shown || (route === '/method' &&
      (await page.evaluate((name) => document.querySelector('main')?.innerText.includes(`viewing ${name}`), last.name)))
    check(shownOnce, `choosing ${last.name} shows ${last.name}`)
    await page.close()
  }
}

async function pagesDown(browser, forbidden) {
  for (const route of PAGES) {
    console.log(`\n${route}, backend down`)
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 })
    await waitForRegister(page)
    const c = await readMineControl(page)
    check(/Mine register unavailable/.test(c.text), 'says the mine register is unavailable')
    check(c.options === null, 'offers no mine to select (nothing is preselected)',
      c.options ? `options ${JSON.stringify(c.options)}` : '')
    const named = forbidden.filter((s) => c.text.includes(s))
    const code = c.text.match(MINE_CODE)
    check(!named.length && !code, 'names no mine', [...named, ...(code ? [code[0]] : [])].join(', '))
    if (route === '/blending') {
      const blend = await page.$('#blend-volume')
      check(!!blend, 'the blend calculator, which needs no mine, is still shown')
    }
    await page.close()
  }
}

async function routeUp(mines) {
  console.log('\nmine-twin route')
  const last = mines[mines.length - 1]
  const ok = await postScenario(last.id)
  check(ok.status === 200, `a scenario for mine ${last.id} (${last.mine_code}) runs`, `status ${ok.status}: ${ok.text.slice(0, 160)}`)
  check(ok.body?.scenario?.mine_name === last.name && ok.body?.scenario?.mine_id === last.id,
    'under the register\'s name and id for that mine',
    `mine_name ${JSON.stringify(ok.body?.scenario?.mine_name)}, mine_id ${JSON.stringify(ok.body?.scenario?.mine_id)}`)

  const maxId = Math.max(...mines.map((m) => m.id))
  for (const id of [maxId + 1, 'balaghat']) {
    const r = await postScenario(id)
    check(r.status === 400, `mine ${JSON.stringify(id)}, not in the register: refused (400)`, `status ${r.status}: ${r.text.slice(0, 160)}`)
  }
}

async function routeDown(forbidden) {
  console.log('\nmine-twin route, backend down')
  for (const id of [1, 2, 999999]) {
    const r = await postScenario(id)
    const label = `mine ${id}, backend down`
    check(r.status === 503, `${label}: 503`, `status ${r.status}: ${r.text.slice(0, 160)}`)
    check(r.body?.is_live === false, `${label}: is_live is false`, `is_live=${JSON.stringify(r.body?.is_live)}`)
    const keys = r.body && typeof r.body === 'object' ? Object.keys(r.body) : []
    const extra = keys.filter((k) => !MESSAGE_KEYS.has(k))
    check(keys.length > 0 && extra.length === 0, `${label}: the telemetry route's shape, a message only`,
      extra.length ? `other keys: ${extra.join(', ')}` : '')
    const nums = numbersIn(r.body)
    check(nums.length === 0, `${label}: no number in the body`, nums.slice(0, 6).join('; '))
    const named = forbidden.filter((s) => r.text.includes(s))
    const code = r.text.match(MINE_CODE)
    check(!named.length && !code, `${label}: names no mine`, [...named, ...(code ? [code[0]] : [])].join(', '))
    check(typeof r.body?.error === 'string' && typeof r.body?.note === 'string' && r.body.note.length > 20,
      `${label}: says what happened`, r.body ? `error=${JSON.stringify(r.body.error)} note=${JSON.stringify(r.body.note)}` : r.text.slice(0, 160))
  }
  const slug = await postScenario('balaghat')
  check(slug.status === 400, 'a malformed id is still refused as malformed (400)', `status ${slug.status}`)
}

async function main() {
  console.log(`mine register — ${BACKEND_DOWN ? 'backend down' : 'backend up'} — ${BASE}`)
  const seed = readRegister()
  const forbidden = seed.flatMap((m) => [m.name, m.code])

  const reg = await getJson('/api/v1/mines')
  const mines = Array.isArray(reg.body) ? reg.body : []
  if (BACKEND_DOWN) {
    check(reg.status !== 200, 'precondition: the backend is down (the register does not answer)', `status ${reg.status}`)
  } else {
    check(reg.status === 200 && mines.length > 1, 'the register answers through the proxy', `status ${reg.status}, ${mines.length} mines`)
    if (mines.length < 2) return
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    if (BACKEND_DOWN) {
      await routeDown(forbidden)
      await pagesDown(browser, forbidden)
    } else {
      await routeUp(mines)
      await pagesUp(browser, mines)
    }
  } finally {
    await browser.close()
  }
}

main()
  .then(() => {
    console.log(`\n${failed === 0 ? 'PASS' : `FAIL — ${failed} check(s)`}`)
    process.exit(failed === 0 ? 0 : 1)
  })
  .catch((e) => { console.error(e); process.exit(1) })
