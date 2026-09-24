/**
 * Route-enumerating authorisation test.
 *
 *   npm run test:auth
 *
 * Needs this app on :3000 (FastAPI not required — every assertion is about
 * authorisation, which is decided before any proxying).
 *
 * WHY THIS EXISTS. The security pass in an earlier phase verified the routes it
 * had edited. Two it had not edited stayed open for months: PUT /api/admin/mines
 * had no check at all, and GET /api/admin/profiles authorised on
 * `admin_session === 'true'` — a cookie its own issuer documents as a
 * non-authoritative UI hint. A hand-written list of routes to check is a list of
 * routes someone remembered.
 *
 * So the route list is generated from the filesystem. A new route handler is
 * covered the moment it is created, and a new state-changing handler that
 * forgets its guard fails this test rather than waiting to be noticed.
 *
 * SCOPE
 *   - every handler under /api/admin/*, regardless of method;
 *   - every state-changing handler (POST/PUT/PATCH/DELETE) anywhere under /api/*.
 *
 * Each is probed three ways — no cookie, a forged `admin_session=true`, and a
 * tampered signed token — and must answer 401 or 403 to all three.
 *
 * Endpoints that are public by design are listed in PUBLIC below, each with the
 * reason. That list is the only way to pass without a guard, and it is short on
 * purpose.
 */
const fs = require('node:fs')
const path = require('node:path')

const BASE = process.env.AUTH_BASE || 'http://localhost:3000'
const API_DIR = path.resolve(__dirname, '../src/app/api')

/**
 * Public by design. Each entry must say why, and "it would be inconvenient
 * otherwise" is not a reason.
 */
const PUBLIC = {
  'POST /api/admin/auth':
    'The admin sign-in endpoint. It must be reachable without a token; that is how a token is obtained. It rate-limits and returns 401 on bad credentials.',
  'DELETE /api/admin/auth':
    'Sign-out. Clears cookies and reads nothing privileged; requiring a valid token to discard a token is circular.',
  'GET /api/admin/setup':
    'Reports whether the single admin slot has been claimed, which the setup page needs before any admin exists. Discloses one boolean.',
  'POST /api/admin/setup':
    'First-run bootstrap: it creates the first admin when none exists, so there is no token to present. It is guarded by the slot-sealed rule instead — once an admin exists it returns 403 (ADMIN_SLOT_SEALED).',
  'POST /api/auth/guest':
    'Mints a guest session. Guest access is an intended product capability (docs/DEMO.md), and the session it issues carries the guest role only.',
  'POST /api/auth/otp':
    'Sends a one-time code to an email address. Public by necessity — it is a step in signing in.',
  'DELETE /api/auth/session':
    'Operator sign-out. Same reasoning as the admin logout above.',
  'POST /api/v1/optimize-blending':
    'Stateless computation. Proxies a linear program, persists nothing, and returns no user or operational record.',
  'POST /api/v1/prospectivity/predict':
    'Stateless computation. Scores a coordinate against the published model; persists nothing.',
  'POST /api/v1/historical-forecasts':
    'Stateless computation over a seeded synthetic series. Persists nothing.',
  'POST /api/v1/mine-twin':
    'Stateless what-if calculation. It does append to an in-memory scenario buffer capped at 20 entries, which holds no user or operational data and is read by no decision path — an accepted, documented residual rather than a guarded endpoint.',
}

/** Probes. All three must be rejected. */
const PROBES = [
  { name: 'no cookie', headers: {} },
  { name: 'forged admin_session=true', headers: { Cookie: 'admin_session=true' } },
  {
    name: 'tampered signed token',
    headers: { Cookie: 'nx_admin_token=eyJpZCI6ImFkbWluIn0.deadbeefdeadbeef; nx-operator-session=eyJyb2xlIjoic3VwZXJhZG1pbiJ9.deadbeef' },
  },
]

function enumerateRoutes(dir, prefix = '/api') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // [mineId] -> a concrete id, so the handler actually runs
      const seg = entry.name.startsWith('[') ? '1' : entry.name
      out.push(...enumerateRoutes(p, `${prefix}/${seg}`))
    } else if (entry.name === 'route.ts') {
      const src = fs.readFileSync(p, 'utf8')
      const methods = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1])
      for (const method of methods) out.push({ route: prefix, method })
    }
  }
  return out
}

function inScope({ route, method }) {
  if (route.startsWith('/api/admin/')) return true
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
}

let failed = 0
const checked = []

async function main() {
  const all = enumerateRoutes(API_DIR).sort((a, b) =>
    (a.route + a.method).localeCompare(b.route + b.method)
  )
  const scoped = all.filter(inScope)

  console.log(`Discovered ${all.length} handlers under /api; ${scoped.length} in scope.\n`)

  // A stale allowlist is its own defect: an entry for a route that no longer
  // exists hides the fact that nothing is being checked.
  const keys = new Set(scoped.map((r) => `${r.method} ${r.route}`))
  for (const k of Object.keys(PUBLIC)) {
    if (!keys.has(k)) {
      console.log(`  FAIL  allowlist names "${k}", which is not an in-scope handler`)
      failed++
    }
  }

  for (const { route, method } of scoped) {
    const key = `${method} ${route}`
    if (PUBLIC[key]) {
      console.log(`  skip  ${key.padEnd(46)} public: ${PUBLIC[key].slice(0, 62)}…`)
      continue
    }

    for (const probe of PROBES) {
      let status = 0
      try {
        const res = await fetch(BASE + route, {
          method,
          headers: { 'Content-Type': 'application/json', ...probe.headers },
          body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
          redirect: 'manual',
        })
        status = res.status
      } catch (e) {
        status = -1
      }
      const ok = status === 401 || status === 403
      if (!ok) failed++
      checked.push({ key, probe: probe.name, status, ok })
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key.padEnd(46)} ${probe.name.padEnd(28)} -> ${status}`)
    }
  }

  const passed = checked.filter((c) => c.ok).length
  console.log(
    `\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed}/${checked.length} probes rejected, ` +
      `${Object.keys(PUBLIC).length} handlers public by design\n`
  )
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
