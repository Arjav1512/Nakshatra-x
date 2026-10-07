#!/usr/bin/env node
/**
 * The workflow's own hardening, checked so it cannot quietly regress.
 *
 *   node scripts/ci/check-workflow.js
 *
 * For every workflow in .github/workflows and every composite action in
 * .github/actions:
 *   - a third-party action is pinned to a full 40-character commit SHA, not a
 *     tag a maintainer (or an attacker with their token) can move;
 *   - actions/checkout does not leave the job's token in .git/config;
 * and for every workflow:
 *   - a top-level `permissions:` block exists and grants nothing beyond read;
 *   - a top-level `concurrency:` block sets `cancel-in-progress`;
 *   - every job sets `timeout-minutes`.
 *
 * Plain line matching, no YAML library: the files are small and regular, and
 * a CI check should not need a dependency the backend does not declare.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const failures = []
const fail = (file, msg) => failures.push(`${path.relative(ROOT, file)}: ${msg}`)

const listYaml = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { recursive: true })
        .filter((f) => /\.ya?ml$/.test(f))
        .map((f) => path.join(dir, f))
    : []

const workflows = listYaml(path.join(ROOT, '.github', 'workflows'))
const actions = listYaml(path.join(ROOT, '.github', 'actions'))
if (!workflows.length) fail(path.join(ROOT, '.github', 'workflows'), 'no workflow found')

for (const file of [...workflows, ...actions]) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const m = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/)
    if (!m) return
    const ref = m[1]
    if (ref.startsWith('./') || ref.startsWith('docker://')) return
    if (!/@[0-9a-f]{40}$/.test(ref)) fail(file, `line ${i + 1}: ${ref} is not pinned to a full commit SHA`)
    if (/^actions\/checkout@/.test(ref)) {
      // The step's own `with:` block, up to the next step or a dedent.
      const indent = line.search(/\S/)
      let ok = false
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]
        if (!l.trim()) continue
        const d = l.search(/\S/)
        if (d <= indent) break
        if (/^\s*persist-credentials:\s*false\b/.test(l)) ok = true
      }
      if (!ok) fail(file, `line ${i + 1}: actions/checkout without persist-credentials: false`)
    }
  })
}

for (const file of workflows) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')

  const block = (key) => {
    const start = lines.findIndex((l) => new RegExp(`^${key}:`).test(l))
    if (start === -1) return null
    const body = []
    for (let j = start + 1; j < lines.length && (/^\s/.test(lines[j]) || !lines[j].trim()); j++) body.push(lines[j])
    return { head: lines[start], body }
  }

  const perms = block('permissions')
  if (!perms) fail(file, 'no top-level permissions: block')
  else {
    const all = [perms.head, ...perms.body].join('\n')
    if (/write/.test(all.replace(/#.*$/gm, ''))) fail(file, 'top-level permissions grant write')
    if (/write-all|read-all/.test(perms.head)) fail(file, `top-level permissions are "${perms.head.trim()}", not scoped`)
  }
  for (const [i, l] of lines.entries()) {
    if (!/^\s+permissions:/.test(l)) continue
    const indent = l.search(/\S/)
    const own = [l]
    for (let j = i + 1; j < lines.length && (!lines[j].trim() || lines[j].search(/\S/) > indent); j++) own.push(lines[j])
    if (/write/.test(own.join('\n').replace(/#.*$/gm, ''))) fail(file, `line ${i + 1}: a job grants itself write permission`)
  }

  const conc = block('concurrency')
  if (!conc || !conc.body.some((l) => /^\s+cancel-in-progress:/.test(l))) {
    fail(file, 'no top-level concurrency: block with cancel-in-progress')
  }

  const jobsAt = lines.findIndex((l) => /^jobs:\s*$/.test(l))
  if (jobsAt === -1) { fail(file, 'no jobs:'); continue }
  const jobs = []
  for (let j = jobsAt + 1; j < lines.length; j++) {
    const m = lines[j].match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
    if (m) jobs.push({ name: m[1], start: j })
    else if (/^\S/.test(lines[j])) break
  }
  if (!jobs.length) fail(file, 'no jobs found under jobs:')
  jobs.forEach((job, k) => {
    const end = k + 1 < jobs.length ? jobs[k + 1].start : lines.length
    const own = lines.slice(job.start + 1, end)
    if (!own.some((l) => /^ {4}timeout-minutes:\s*\d+/.test(l))) fail(file, `job "${job.name}" has no timeout-minutes`)
  })
  console.log(`${path.relative(ROOT, file)}: ${jobs.length} job(s) checked`)
}
console.log(`${actions.length} composite action(s) checked`)

for (const f of failures) console.log(`  FAIL  ${f}`)
console.log(`\n${failures.length ? 'FAIL' : 'PASS'} — ${failures.length} workflow hardening problem(s)`)
process.exit(failures.length ? 1 : 0)
