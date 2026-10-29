#!/usr/bin/env node
/**
 * Every Next.js API route is a thin proxy to FastAPI, or it is on a justified
 * list.
 *
 *   npm run lint:api-routes
 *
 * The provenance guards check what FastAPI serves (backend/test_api_provenance.py)
 * and what the browser renders (provenance-guard.js). Neither sees a figure
 * computed, or typed in, inside a Next.js route handler. That figure carries
 * no artifact, no model version and no backtest, and it is how most of this
 * project's fabrications reached the screen (docs/INTEGRITY.md). This guard
 * closes that gap statically, on every `src/app/api/**\/route.ts`.
 *
 * A THIN PROXY
 * ------------
 * - reaches FastAPI through `@/lib/backend` (`fetchFromBackend`, or `backendUrl()`
 *   for a byte stream), and imports nothing beyond PROXY_IMPORTS;
 * - computes nothing: no `Math.`, no `*`, `/`, `%`, no `.reduce(`;
 * - holds no figure. A numeric literal is allowed only as an HTTP status, a
 *   timeout, or a validation bound (`.min()`, `.max()`, `.length()`). A
 *   numeric string is allowed only as a query parameter's default, or the
 *   value it is compared with.
 *
 * Anything else must be on LISTED. Each entry gives its kind and its reason, and
 * the exact modules it imports, so a listed route cannot quietly start pulling
 * in a data module. A listed route that has become a thin proxy must leave the
 * list, and a listed path that no longer exists fails, so the list stays true.
 *
 * Comments, strings and regex literals are blanked before the checks, so a
 * number in a comment or inside a regex quantifier is not a figure.
 */
const fs = require('fs')
const path = require('path')

const FRONTEND = path.resolve(__dirname, '..')
const API = path.join(FRONTEND, 'src', 'app', 'api')

const PROXY_IMPORTS = new Set(['next/server', '@/lib/backend', '@/lib/security', 'zod'])

const IDENTITY = 'identity'
const LISTED = {
  'src/app/api/admin/auth/route.ts': {
    kind: IDENTITY,
    why: 'Administrator sign-in and sign-out against Supabase; issues and clears the signed admin token. Serves no figure.',
    imports: ['next/server', 'next/headers', '@/lib/supabase', '@/lib/admin-slot', '@/lib/auth', '@/lib/session'],
  },
  'src/app/api/admin/profiles/route.ts': {
    kind: IDENTITY,
    why: 'Lists operator profiles for the admin console, behind requireAdmin(). Serves no figure.',
    imports: ['next/server', '@/lib/supabase', '@/lib/auth'],
  },
  'src/app/api/admin/setup/route.ts': {
    kind: IDENTITY,
    why: 'One-time claim of the single administrator slot. Serves no figure.',
    imports: ['next/server', 'next/headers', '@/lib/supabase', '@/lib/admin-slot', '@/lib/session'],
  },
  'src/app/api/auth/github/route.ts': {
    kind: IDENTITY,
    why: 'Starts GitHub OAuth with a single-use state cookie. Serves no figure.',
    imports: ['next/server', 'next/headers', 'crypto'],
  },
  'src/app/api/auth/github/callback/route.ts': {
    kind: IDENTITY,
    why: 'Completes GitHub OAuth, verifies state, issues the signed session. Serves no figure.',
    imports: ['next/server', 'next/headers', '@/lib/supabase', '@/lib/session'],
  },
  'src/app/api/auth/guest/route.ts': {
    kind: IDENTITY,
    why: 'Issues a signed guest session. Serves no figure.',
    imports: ['next/server', 'next/headers', 'crypto', '@/lib/session'],
  },
  'src/app/api/auth/otp/route.ts': {
    kind: IDENTITY,
    why: 'E-mail one-time-code sign-in, with attempt caps and rate limits (those numbers are limits, not figures). Serves no figure.',
    imports: ['next/server', 'next/headers', '@/lib/session', 'crypto', 'nodemailer', '@/lib/supabase', '@/lib/rate-limit'],
  },
  'src/app/api/auth/session/route.ts': {
    kind: IDENTITY,
    why: 'Reads and clears the signed session cookie. Serves no figure.',
    imports: ['next/server', 'next/headers', '@/lib/session'],
  },
  'src/app/api/v1/geocode/route.ts': {
    kind: 'external-proxy',
    why:
      'Place search through Nominatim with a Photon fallback (lib/upstreams), not FastAPI. A built-in gazetteer of city ' +
      'coordinates answers common names offline, and results are filtered to India and de-duplicated. Those numbers are ' +
      'locations and filters; no measurement or model output is computed or served.',
    imports: ['next/server', '@/lib/upstreams'],
  },
  'src/app/api/v1/mine-twin/route.ts': {
    kind: 'assumption-arithmetic',
    why:
      'Mine twin what-if: multiplies a baseline the caller read from the mine\'s forecast artifact (sent with its provenance) ' +
      'by planner factors the caller chose on screen, and labels the result kind: "assumption". It holds no figure of its ' +
      'own; its numbers are input bounds. The one route that computes in Next.js, and a candidate to move to FastAPI.',
    imports: ['next/server', 'crypto', '@/lib/scenario-assumptions', '@/components/mission-control/data'],
  },
  'src/app/api/v1/mines/[mineId]/telemetry/route.ts': {
    kind: 'proxy-with-degraded-fallback',
    why:
      'A thin proxy while FastAPI answers. When it does not, it returns lib/degraded-telemetry, which nulls every reading ' +
      'but still serves forecast.total_planned_tonnes: a plan target hardcoded in that module, pro-rated over the horizon, ' +
      'in a payload flagged synthetic. Known and disclosed (PR #39); nulling it is a behaviour change left to the owner.',
    imports: ['next/server', '@/lib/security', '@/lib/backend', '@/lib/degraded-telemetry'],
  },
}

// ---------------------------------------------------------------------------
// Source scanning
// ---------------------------------------------------------------------------

/** Characters after which a `/` starts a regex literal rather than a division. */
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])

/**
 * Blank comments, string and template text, and regex literals (same length, so
 * offsets hold), keeping `${...}` expressions as code. Returns the blanked code
 * and every string literal's value with its offset.
 */
function scan(src) {
  const out = src.split('')
  const strings = []
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ' }
  let i = 0
  const prevSignificant = (at) => {
    let k = at - 1
    while (k >= 0 && /\s/.test(out[k])) k--
    if (k < 0) return ''
    // `return /re/` and `typeof /re/` start a regex too.
    const word = out.slice(Math.max(0, k - 5), k + 1).join('')
    if (/(?:^|[^\w$])(?:return|typeof)$/.test(word)) return '('
    return out[k]
  }
  function template(start) {
    // `start` is the opening backtick. Returns the index after the closing one.
    let k = start + 1
    let textFrom = k
    while (k < src.length) {
      if (src[k] === '\\') { k += 2; continue }
      if (src[k] === '`') { blank(textFrom, k); return k + 1 }
      if (src[k] === '$' && src[k + 1] === '{') {
        blank(textFrom, k)
        k = code(k + 2, '}')
        textFrom = k
        continue
      }
      k++
    }
    blank(textFrom, k)
    return k
  }
  function code(start, closer) {
    let k = start
    let depth = 0
    while (k < src.length) {
      const c = src[k]
      const n = src[k + 1]
      if (closer && c === closer && depth === 0) return k + 1
      if (c === '{') depth++
      else if (c === '}') depth--
      if (c === '/' && n === '/') {
        const e = src.indexOf('\n', k)
        const end = e === -1 ? src.length : e
        blank(k, end); k = end; continue
      }
      if (c === '/' && n === '*') {
        const e = src.indexOf('*/', k + 2)
        const end = e === -1 ? src.length : e + 2
        blank(k, end); k = end; continue
      }
      if (c === '"' || c === "'") {
        let e = k + 1
        while (e < src.length && src[e] !== c) { if (src[e] === '\\') e++; e++ }
        strings.push({ value: src.slice(k + 1, e), at: k })
        blank(k + 1, e); k = e + 1; continue
      }
      if (c === '`') { k = template(k); continue }
      if (c === '/' && REGEX_PRECEDERS.has(prevSignificant(k))) {
        let e = k + 1
        let inClass = false
        while (e < src.length && src[e] !== '\n') {
          if (src[e] === '\\') { e += 2; continue }
          if (src[e] === '[') inClass = true
          else if (src[e] === ']') inClass = false
          else if (src[e] === '/' && !inClass) break
          e++
        }
        e++
        while (e < src.length && /[a-z]/i.test(src[e])) e++
        blank(k, e); k = e; continue
      }
      k++
    }
    return k
  }
  code(0, null)
  return { code: out.join(''), strings }
}

function importsOf(src) {
  const found = new Set()
  for (const m of src.matchAll(/^\s*import\s[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/gm)) found.add(m[1])
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.add(m[1])
  return found
}

const NUMERIC_LITERAL = /(?<![\w$.])\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?/gi
const ALLOWED_NUMBER_CONTEXT = [
  /\bstatus\s*(?::|===|!==|==|!=)\s*$/, // HTTP status
  /\btimeoutMs\s*:\s*(?:[\w$.]+\s*\?\s*(?:\d+\s*:\s*)?)?$/, // timeout, plain or `live ? a : b`
  /\bAbortSignal\.timeout\(\s*$/,
  /\.(?:min|max|length|gte|lte|gt|lt)\(\s*-?\s*$/, // validation bound
]
// The parameter name is a string too, so it arrives blanked: get('     ') ?? '14'
const ALLOWED_NUMERIC_STRING_CONTEXT = /searchParams\.get\(\s*(['"])\s*\1\s*\)\s*(?:\?\?|\|\||===|!==)\s*$/

function lineOf(src, at) {
  return src.slice(0, at).split('\n').length
}

/** Why `src` is not a thin proxy: an empty list means it is one. */
function proxyViolations(src) {
  const problems = []
  const { code, strings } = scan(src)
  const imports = importsOf(src)

  for (const mod of imports) {
    if (!PROXY_IMPORTS.has(mod)) problems.push(`imports ${mod}, which a proxy has no use for`)
  }
  const reachesBackend =
    imports.has('@/lib/backend') && (/\bfetchFromBackend\s*[<(]/.test(code) || /\bbackendUrl\s*\(\s*\)/.test(code))
  if (!reachesBackend) problems.push('does not reach FastAPI through @/lib/backend (fetchFromBackend or backendUrl())')

  for (const [re, what] of [
    [/\bMath\./g, 'Math.'],
    [/\.reduce\s*\(/g, '.reduce('],
    [/[^*/]\*(?!\*)(?!\/)|\*\*/g, 'multiplication'],
    [/(?<![/*])\/(?![/*])/g, 'division'],
    [/%/g, 'modulo'],
  ]) {
    for (const m of code.matchAll(re)) problems.push(`line ${lineOf(src, m.index)}: computes (${what})`)
  }

  for (const m of code.matchAll(NUMERIC_LITERAL)) {
    const before = code.slice(Math.max(0, m.index - 60), m.index).replace(/\s+/g, ' ')
    if (!ALLOWED_NUMBER_CONTEXT.some((re) => re.test(before))) {
      problems.push(`line ${lineOf(src, m.index)}: numeric literal ${m[0]} is not a status, timeout or bound`)
    }
  }
  for (const s of strings) {
    if (!/^\s*-?\d+(?:\.\d+)?\s*%?\s*$/.test(s.value)) continue
    const before = code.slice(Math.max(0, s.at - 60), s.at).replace(/\s+/g, ' ')
    if (!ALLOWED_NUMERIC_STRING_CONTEXT.test(before)) {
      problems.push(`line ${lineOf(src, s.at)}: numeric string '${s.value}' is not a query parameter default`)
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// A guard on the guard: run every time, so the checks cannot silently go blind.
// ---------------------------------------------------------------------------

function selfTest() {
  const ok = `import { NextResponse } from 'next/server'
import { fetchFromBackend, backendUrl } from '@/lib/backend'
import { z } from 'zod'
const Q = z.object({ lat: z.number().min(-90).max(90) })
const SAFE = /^[a-z0-9-]{1,40}$/ // 3.14 in a comment is not a figure
export async function GET(request: Request) {
  const top = new URL(request.url).searchParams.get('top_n') ?? '10'
  const r = await fetchFromBackend(\`/api/v1/x?top_n=\${encodeURIComponent(top)}\`, { timeoutMs: 30000 })
  if (r.ok) return NextResponse.json({ ...r.data, note: 'AUC 0.85 in a sentence is a string, not code', from: backendUrl() })
  if (r.status === 404) return NextResponse.json(r.body, { status: 404 })
  return NextResponse.json({ error: r.error }, { status: 503 })
}`
  const bad = {
    'a hardcoded figure': ok.replace("note: 'AUC 0.85 in a sentence is a string, not code'", 'auc: 0.85'),
    'a computed figure': ok.replace('...r.data,', '...r.data, tonnes: Math.round(r.data.daily * days),'),
    'a numeric string served as a figure': ok.replace("note: 'AUC 0.85 in a sentence is a string, not code'", "coverage: '0.806'"),
    'a data module': ok.replace("import { z } from 'zod'", "import { z } from 'zod'\nimport { HISTORICAL_DATABASE_1977_2026 } from '@/lib/historical-database'"),
    'no backend at all': ok.replace(/fetchFromBackend|backendUrl/g, 'fetch'),
  }
  const failures = []
  const okProblems = proxyViolations(ok)
  if (okProblems.length) failures.push(`a clean proxy was rejected: ${okProblems.join('; ')}`)
  for (const [name, src] of Object.entries(bad)) {
    if (!proxyViolations(src).length) failures.push(`a proxy with ${name} was accepted`)
  }
  return failures
}

// ---------------------------------------------------------------------------

function routeFiles(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...routeFiles(p))
    else if (/^route\.(?:ts|tsx|js|mjs)$/.test(entry.name)) found.push(p)
  }
  return found
}

function main() {
  const failures = []

  for (const f of selfTest()) failures.push(`self-test: ${f}`)

  const routes = routeFiles(API).map((p) => path.relative(FRONTEND, p).split(path.sep).join('/')).sort()
  const byKind = {}
  for (const rel of routes) {
    const src = fs.readFileSync(path.join(FRONTEND, rel), 'utf8')
    const listed = LISTED[rel]
    const problems = proxyViolations(src)
    if (!listed) {
      if (problems.length) failures.push(`${rel} is not a thin proxy and is not on the justified list:\n      ${problems.join('\n      ')}`)
      byKind.proxy = (byKind.proxy || 0) + 1
      continue
    }
    if (!listed.why || listed.why.trim().length < 20) failures.push(`${rel}: its LISTED entry needs a real justification`)
    if (!problems.length) failures.push(`${rel} is a thin proxy now; remove it from LISTED`)
    const actual = [...importsOf(src)].sort()
    const declared = [...listed.imports].sort()
    if (actual.join('\n') !== declared.join('\n')) {
      failures.push(
        `${rel}: imports changed since it was justified. Declared [${declared.join(', ')}], actual [${actual.join(', ')}]. ` +
          'Re-review the route and update its entry.'
      )
    }
    byKind[listed.kind] = (byKind[listed.kind] || 0) + 1
  }
  for (const rel of Object.keys(LISTED)) {
    if (!routes.includes(rel)) failures.push(`LISTED names ${rel}, which no longer exists; remove the entry`)
  }

  const summary = Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')
  if (failures.length) {
    console.error(`FAIL: ${failures.length} problem(s) across ${routes.length} API route(s)\n`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`PASS: ${routes.length} API routes, ${summary}. Self-test passed.`)
}

if (require.main === module) main()
module.exports = { proxyViolations, scan, LISTED }
