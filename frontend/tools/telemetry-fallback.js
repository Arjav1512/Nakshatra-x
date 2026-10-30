#!/usr/bin/env node
/**
 * Mine telemetry never stands in for another mine, and never states a figure
 * the service layer did not serve.
 *
 *   npm run test:telemetry                     # backend up (offline or live)
 *   npm run test:telemetry -- --backend-down   # backend stopped (CI stops it)
 *
 * Needs this app on :3000 (E2E_BASE to override). HTTP only, no browser.
 *
 * WHY THIS EXISTS. DEF-1 was one mine's record served under another's id:
 * `parseInt(id) || 1` turned any id that failed to parse into Balaghat. Its
 * second instance sat in the fallback. When FastAPI answered anything but 200,
 * the Next.js route built a "degraded" payload from a mine register hardcoded
 * in lib/degraded-telemetry.ts, with `MINE_REGISTER[id] || MINE_REGISTER[1]`.
 * So /api/v1/mines/99/telemetry, which FastAPI answers 404, came back 200 with
 * Balaghat's name, code and coordinates. And every degraded payload carried
 * `forecast.total_planned_tonnes`, a plan target typed into Next.js.
 *
 * BACKEND UP
 *   - A known mine answers 200, served through FastAPI, under its own code. A
 *     404 below could otherwise mean a broken backend rather than the
 *     register's answer. The mine is the register's last one, not mine 1,
 *     because mine 1 is what a substitution would return.
 *   - Ids the register does not have answer 404, with a message. The body names
 *     no mine in the register (the register is read from /api/v1/mines, not
 *     from a list kept here) and holds no number.
 *
 * BACKEND DOWN
 *   - Nothing can say whether an id exists, because the register lives in
 *     FastAPI. Every id, known or not, answers 503 with `is_live: false`, and
 *     the body is a message only: no number, no mine code, no data key.
 */
const BASE = process.env.E2E_BASE || 'http://localhost:3000'
const BACKEND_DOWN = process.argv.includes('--backend-down')

/** What an answer that carries no telemetry may hold: a message, and its flags. */
const MESSAGE_KEYS = new Set(['error', 'detail', 'note', 'is_live', 'served_by'])
const MINE_CODE = /MOIL-[A-Z]{3}-\d{2}/

let failed = 0
function check(ok, label, detail) {
  if (!ok) failed++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n          ${detail}` : ''}`)
}

/** Every number anywhere in a JSON value, with its path. */
function numbersIn(value, at = '$', out = []) {
  if (typeof value === 'number') out.push(`${at} = ${value}`)
  else if (Array.isArray(value)) value.forEach((v, i) => numbersIn(v, `${at}[${i}]`, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) numbersIn(v, `${at}.${k}`, out)
  }
  return out
}

async function get(path) {
  try {
    const res = await fetch(BASE + path, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = null }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: -1, body: null, text: String(e?.message || e) }
  }
}

/** An answer that is a message and nothing else. */
function checkMessageOnly(label, r, forbidden) {
  const keys = r.body && typeof r.body === 'object' ? Object.keys(r.body) : []
  const extra = keys.filter((k) => !MESSAGE_KEYS.has(k))
  check(extra.length === 0, `${label}: the body is a message only`, extra.length ? `data keys: ${extra.join(', ')}` : '')
  const nums = numbersIn(r.body)
  check(nums.length === 0, `${label}: no number anywhere in the body`, nums.slice(0, 6).join('; '))
  const named = forbidden.filter((s) => r.text.includes(s))
  const code = r.text.match(MINE_CODE)
  check(!named.length && !code, `${label}: names no mine`, [...named, ...(code ? [code[0]] : [])].join(', '))
  check(
    typeof r.body?.error === 'string' && typeof r.body?.note === 'string' && r.body.note.length > 20,
    `${label}: says what happened`,
    r.body ? `error=${JSON.stringify(r.body.error)} note=${JSON.stringify(r.body.note)}` : r.text.slice(0, 160)
  )
}

async function backendUp() {
  const reg = await get('/api/v1/mines')
  const mines = Array.isArray(reg.body) ? reg.body : []
  check(reg.status === 200 && mines.length > 0, 'the mine register answers through the proxy', `status ${reg.status}`)
  if (!mines.length) return

  const last = mines.reduce((a, b) => (b.id > a.id ? b : a))
  const known = await get(`/api/v1/mines/${last.id}/telemetry`)
  check(
    known.status === 200 && typeof known.body?.proxied_from === 'string',
    `mine ${last.id} (${last.mine_code}): 200, served through FastAPI`,
    `status ${known.status}`
  )
  check(
    known.body?.mine?.code === last.mine_code,
    `mine ${last.id}: its own record, not another mine's`,
    `served code ${JSON.stringify(known.body?.mine?.code)}`
  )

  const names = mines.flatMap((m) => [m.name, m.mine_code]).filter(Boolean)
  const maxId = Math.max(...mines.map((m) => m.id))
  for (const id of [maxId + 1, 999999]) {
    const r = await get(`/api/v1/mines/${id}/telemetry`)
    check(r.status === 404, `unknown mine ${id}: 404`, `status ${r.status}`)
    checkMessageOnly(`unknown mine ${id}`, r, names)
  }
}

async function backendDown() {
  // Precondition: the backend really is down. Otherwise a pass here proves
  // nothing about the fallback.
  const reg = await get('/api/v1/mines')
  check(reg.status !== 200, 'precondition: the backend is down (the register does not answer)', `status ${reg.status}`)

  // 1 is the id a substitution resolved to; 999999 is in no register.
  for (const id of [1, 2, 999999]) {
    const r = await get(`/api/v1/mines/${id}/telemetry`)
    check(r.status === 503, `mine ${id}, backend down: 503`, `status ${r.status}`)
    check(r.body?.is_live === false, `mine ${id}, backend down: is_live is false`, `is_live=${JSON.stringify(r.body?.is_live)}`)
    checkMessageOnly(`mine ${id}, backend down`, r, ['Balaghat'])
  }
}

async function main() {
  console.log(`telemetry fallback — ${BACKEND_DOWN ? 'backend down' : 'backend up'} — ${BASE}\n`)
  await (BACKEND_DOWN ? backendDown() : backendUp())
  console.log(`\n${failed === 0 ? 'PASS' : `FAIL — ${failed} check(s)`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
