#!/usr/bin/env node
/**
 * One mine register: FastAPI's. No file in the Next.js app defines a mine.
 *
 *   npm run lint:mine-register
 *
 * Static, about a second, no servers. Runs in CI's Frontend job.
 *
 * WHY THIS EXISTS. DEF-1 was one mine's record served under another's id, and
 * every instance of it ran through a copy of the register kept in Next.js:
 *   - the /api/v1/mines route's own slug-keyed register (D-028);
 *   - the telemetry fallback's register, which turned an unknown id into
 *     Balaghat (#40);
 *   - `FALLBACK_MINES`, a register of one that /blending, /method and
 *     /mine-twin chose from and the mine-twin route validated against, plus
 *     copies of its row in MineTwinPanel and the Track A map, the map's search
 *     table, the geocoder's gazetteer, and three hand-kept "pilot" records.
 * A copy can only drift from the register, and with the service layer down it
 * goes on naming mines the system cannot vouch for. So every mine on screen is
 * read from FastAPI's register at runtime, and this guard fails on any file in
 * src/ that defines one.
 *
 * WHAT COUNTS AS DEFINING A MINE. Comments are blanked first: a docblock may
 * name the mine a bug served. In what is left:
 *   code        any mine code (MOIL-XXX-NN), in any position;
 *   name        a register mine's name as a whole string ('Balaghat'), as an
 *               object key (`balaghat:`, `'dongri buzurg':`), or inside the
 *               value of a name field (`name: 'Balaghat Pyrolusite Syncline'`);
 *   id          a mine id bound to a number (`numericId: 1`, `mine_id = 1`,
 *               `/mines/1/`, `?mine=1`);
 *   coordinates a register mine's coordinates as a lat/lng pair or a [lat, lng]
 *               tuple, to 0.006°, however the mine is labelled.
 * Prose is not a definition. A search box's "e.g. Balaghat" names a place to
 * type, and a sentence in generated text names no record.
 *
 * WHERE THE REGISTER IS READ FROM. The names, codes and coordinates this looks
 * for are parsed from FastAPI's seed register (`DEFAULT_MINES` in
 * backend/app/api/routes.py), so the guard keeps no list of its own and
 * follows the register when it changes. If the seed cannot be parsed, the
 * guard fails.
 *
 * TWO EXCEPTIONS, each stated and checked:
 *   - src/lib/pilot-mines.ts names the pilot mines, by register code and
 *     nothing else (each line `export const …_CODE = 'MOIL-XXX-NN'`). A
 *     designation of which mine to feature, not a register: id, name and
 *     coordinates come from the register at runtime.
 *   - src/data/synthetic-history.json carries `mines_modelled`, a label on a
 *     generated series, written by backend/app/ingestion/export.py. The
 *     generator is in the forecast import chain and is not edited here, and
 *     no file in src/ may read the field (checked).
 */
const fs = require('node:fs')
const path = require('node:path')

const FRONTEND = path.resolve(__dirname, '..')
const SRC = path.join(FRONTEND, 'src')
const REGISTER_FILE = path.resolve(FRONTEND, '..', 'backend', 'app', 'api', 'routes.py')
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'])

const CODE = /MOIL-[A-Z]{3}-\d{2}/g
const COORD_TOLERANCE = 0.006

const DESIGNATION_FILE = 'src/lib/pilot-mines.ts'
const DESIGNATION_LINE = /^export const [A-Z0-9_]+_CODE = 'MOIL-[A-Z]{3}-\d{2}'$/

/** JSON keys that may hold mine names, per file, with the reason. */
const ALLOWED_JSON_KEYS = {
  'src/data/synthetic-history.json': {
    keys: ['mines_modelled'],
    why:
      'A label on a generated series, written by backend/app/ingestion/export.py, which sits in the forecast import ' +
      'chain and is not edited here. No file in src/ reads it.',
  },
}

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

/** FastAPI's seed register, parsed from the Python source. */
function readRegister(file = REGISTER_FILE) {
  if (!fs.existsSync(file)) throw new Error(`the register's seed file is missing: ${file}`)
  const py = fs.readFileSync(file, 'utf8')
  const block = py.match(/^DEFAULT_MINES\s*=\s*\[([\s\S]*?)^\]/m)
  if (!block) throw new Error(`no DEFAULT_MINES list in ${path.relative(process.cwd(), file)}`)
  const mines = []
  for (const row of block[1].matchAll(/\{([^{}]*)\}/g)) {
    const field = (k) => row[1].match(new RegExp(`"${k}"\\s*:\\s*("([^"]*)"|-?[\\d.]+)`))
    const str = (k) => field(k)?.[2]
    const num = (k) => Number(field(k)?.[1])
    const m = { code: str('mine_code'), name: str('name'), lat: num('latitude'), lng: num('longitude') }
    if (!m.code || !m.name || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) {
      throw new Error(`could not parse a register row: {${row[1].trim().slice(0, 120)}}`)
    }
    mines.push(m)
  }
  if (mines.length < 2) throw new Error(`parsed ${mines.length} mine(s) from DEFAULT_MINES; expected the register`)
  return mines
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/** Characters after which a `/` starts a regex literal rather than a division. */
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])

/**
 * Blank comments (same length, so line numbers hold). Strings, template text
 * and JSX text are kept: they are where a mine would be defined.
 */
function blankComments(src) {
  const out = src.split('')
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ' }
  const prevSignificant = (at) => {
    let k = at - 1
    while (k >= 0 && /\s/.test(src[k])) k--
    if (k < 0) return ''
    const word = src.slice(Math.max(0, k - 5), k + 1)
    if (/(?:^|[^\w$])(?:return|typeof)$/.test(word)) return '('
    return src[k]
  }
  let k = 0
  while (k < src.length) {
    const c = src[k]
    const n = src[k + 1]
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
    if (c === '"' || c === "'" || c === '`') {
      let e = k + 1
      while (e < src.length && src[e] !== c && (c === '`' || src[e] !== '\n')) { if (src[e] === '\\') e++; e++ }
      k = e + 1; continue
    }
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
      k = e + 1; continue
    }
    k++
  }
  return out.join('')
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** Every way `text` defines a mine from `register`. */
function findDefinitions(text, register) {
  const found = []
  const add = (rule, index, what) => found.push({ rule, line: lineAt(text, index), what: what.replace(/\s+/g, ' ') })

  for (const m of text.matchAll(CODE)) add('code', m.index, m[0])

  for (const mine of register) {
    const name = escapeRe(mine.name)
    const first = escapeRe(mine.name.split(/\s+/)[0])
    // The whole string is the name.
    for (const m of text.matchAll(new RegExp(`(['"\`])\\s*${name}\\s*\\1`, 'gi'))) add('name', m.index, m[0])
    // An object key: `balaghat:`, `'dongri buzurg':`, `dongri:`.
    for (const m of text.matchAll(new RegExp(`(?:^|[{,\\s])(['"]?)(?:${name}|${first})\\1\\s*:(?!:)`, 'gim'))) {
      add('name', m.index, m[0].trim())
    }
    // The value of a name field.
    for (const m of text.matchAll(
      new RegExp(`\\b(?:name|mineName|mine_name|displayName)['"]?\\s*:\\s*(['"\`])[^'"\`\\n]*\\b${name}\\b[^'"\`\\n]*\\1`, 'gi')
    )) add('name', m.index, m[0])
  }

  for (const m of text.matchAll(/\b(?:numericId|mineId|mine_id)['"]?\s*[:=]\s*\d+/g)) add('id', m.index, m[0])
  for (const m of text.matchAll(/\/mines\/\d+(?=[/?'"`\s]|$)|[?&]mine=\d+/g)) add('id', m.index, m[0])

  const near = (lat, lng) =>
    register.find((r) => Math.abs(r.lat - lat) <= COORD_TOLERANCE && Math.abs(r.lng - lng) <= COORD_TOLERANCE)
  const pairs = [
    /\b(?:lat|latitude)['"]?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*['"]?(?:lng|lon|long|longitude)['"]?\s*:\s*(-?\d+(?:\.\d+)?)/g,
    /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g,
  ]
  for (const re of pairs) {
    for (const m of text.matchAll(re)) {
      const hit = near(Number(m[1]), Number(m[2]))
      if (hit) add('coordinates', m.index, `${m[0]} (${hit.name}'s)`)
    }
  }
  return found
}

/** What a file defines, after its comments are blanked and its exceptions applied. */
function checkFile(rel, src, register) {
  const ext = path.extname(rel)
  if (ext === '.json') {
    const allowed = ALLOWED_JSON_KEYS[rel]
    if (!allowed) return findDefinitions(src, register)
    let data
    try { data = JSON.parse(src) } catch (e) { return [{ rule: 'parse', line: 1, what: String(e.message) }] }
    const problems = []
    for (const key of allowed.keys) {
      if (!(key in data)) problems.push({ rule: 'stale exception', line: 1, what: `allowed key "${key}" is not in the file; remove it from ALLOWED_JSON_KEYS` })
      delete data[key]
    }
    return [...problems, ...findDefinitions(JSON.stringify(data, null, 1), register)]
  }

  const code = blankComments(src)
  if (rel !== DESIGNATION_FILE) return findDefinitions(code, register)

  // The designation file: codes on designation lines and nothing else.
  const found = findDefinitions(code, register)
  const lines = code.split('\n')
  return found.filter((f) => !(f.rule === 'code' && DESIGNATION_LINE.test(lines[f.line - 1].trim())))
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (EXTENSIONS.has(path.extname(e.name))) out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------
// Self-test: what must be caught, and what must not
// ---------------------------------------------------------------------------

function selfTest(register) {
  const [a, b] = register
  const catches = {
    'a code': `const PILOT = '${a.code}'`,
    'a whole-string name': `mines.find((m) => m.name === '${b.name}')`,
    'a JSON name': `{ "mines": ["${a.name}"] }`,
    'a name as an object key': `const T = { ${a.name.toLowerCase().split(' ')[0]}: { x: 1 } }`,
    'a name in a name field': `const p = { name: '${a.name} Ore Belt', type: 'hub' }`,
    'an id bound to a number': `const m = { numericId: 3 }`,
    'an id in a path': "fetch('/api/v1/mines/4/forecast')",
    'an id in a query': "href='/console?mine=2&track=b'",
    'coordinates as a pair': `const c = { lat: ${a.lat}, lng: ${a.lng} }`,
    'coordinates as a tuple': `center: [${b.lat}, ${b.lng}],`,
    'a code in JSX text': `<p>Pilot ${a.code}</p>`,
  }
  const passes = {
    'a name in a comment': `// ${a.name} was served for every id (DEF-1)\nconst x = 1`,
    'a code in a block comment': `/* ${a.code} */ const y = 2`,
    'a name in prose': `placeholder="${a.name}, Nagpur, a district or a place name"`,
    'a name in a sentence of generated text': `directive: 'Infill drilling along the East ${a.name} strike.'`,
    'an unrelated coordinate': 'center: [22.5, 80],',
    'an id read from the register': 'fetchForecast(selectedMine.numericId)',
    'a register lookup by designation': "register.mines.find((m) => m.code === TRACK_B_PILOT_CODE)",
  }
  const failures = []
  for (const [label, src] of Object.entries(catches)) {
    if (!checkFile('src/x.tsx', src, register).length) failures.push(`missed ${label}: ${src}`)
  }
  for (const [label, src] of Object.entries(passes)) {
    const f = checkFile('src/x.tsx', src, register)
    if (f.length) failures.push(`flagged ${label}: ${src} -> ${f.map((x) => x.what).join(', ')}`)
  }
  // The designation file allows a code on a designation line, and nothing else.
  const okDesignation = `export const TRACK_B_PILOT_CODE = '${a.code}'`
  if (checkFile(DESIGNATION_FILE, okDesignation, register).length) failures.push('flagged a designation line')
  const badDesignation = `${okDesignation}\nexport const PILOT = { name: '${a.name}', lat: ${a.lat}, lng: ${a.lng} }`
  if (checkFile(DESIGNATION_FILE, badDesignation, register).length < 2) failures.push('missed a record in the designation file')
  const smuggled = `export const LIST = ['${a.code}', '${b.code}']`
  if (!checkFile(DESIGNATION_FILE, smuggled, register).length) failures.push('missed a code list in the designation file')
  // An allowed JSON key holds names; any other key does not get the exception.
  const json = JSON.stringify({ mines_modelled: [a.name], other: [b.name] })
  if (!checkFile('src/data/synthetic-history.json', json, register).length) failures.push('the JSON exception covered another key')
  return failures
}

// ---------------------------------------------------------------------------

function main() {
  let register
  try {
    register = readRegister()
  } catch (e) {
    console.error(`FAIL: ${e.message}`)
    process.exit(1)
  }

  const selfFailures = selfTest(register)
  if (selfFailures.length) {
    console.error('FAIL: self-test')
    for (const f of selfFailures) console.error(`  ${f}`)
    process.exit(1)
  }

  const problems = []
  const files = walk(SRC)
  for (const file of files) {
    const rel = path.relative(FRONTEND, file).split(path.sep).join('/')
    const src = fs.readFileSync(file, 'utf8')
    for (const f of checkFile(rel, src, register)) problems.push(`${rel}:${f.line}  ${f.rule}: ${f.what}`)
    // The allowed JSON keys are labels, not data: nothing may read them.
    if (!rel.endsWith('.json')) {
      for (const { keys } of Object.values(ALLOWED_JSON_KEYS)) {
        for (const key of keys) {
          const at = blankComments(src).indexOf(key)
          if (at !== -1) problems.push(`${rel}:${lineAt(src, at)}  reads ${key}, which is allowed only as an unread label`)
        }
      }
    }
  }

  if (problems.length) {
    console.error(`FAIL: ${problems.length} mine definition(s) outside FastAPI's register\n`)
    for (const p of problems) console.error(`  ${p}`)
    console.error(
      '\nRead mines from the register at runtime (components/mission-control/mine-register.ts, or ' +
        "fetchFromBackend('/api/v1/mines') in a route). A pilot is named by code in src/lib/pilot-mines.ts."
    )
    process.exit(1)
  }
  console.log(
    `PASS: ${files.length} files in src/ define no mine. The register (${register.length} mines) is read from ` +
      `${path.relative(path.resolve(FRONTEND, '..'), REGISTER_FILE)}. Self-test passed.`
  )
}

if (require.main === module) main()
module.exports = { readRegister, checkFile, blankComments, findDefinitions }
