#!/usr/bin/env node
/**
 * Biome: fail only if this tree is worse than the base it will merge into.
 *
 *   node tools/biome-no-worse.js <base-frontend-dir>
 *
 * The codebase carries Biome findings from before Biome was introduced (33
 * errors and 79 warnings on main when this was written), so "Biome must pass"
 * would fail every PR, and "Biome is informational" would let new findings in
 * unseen. The gate is the difference: errors and warnings may not go up.
 *
 * HOW THE BASELINE IS PINNED
 * --------------------------
 * Not as a number in a file — a committed count goes stale the day someone
 * fixes a finding, and from then on it lets regressions back in up to the old
 * count. The baseline is the base commit itself, measured in the same run:
 *
 *   - same Biome binary for both trees (this checkout's node_modules, exact
 *     version from package-lock.json);
 *   - same configuration for both: this tree's biome.json is copied over the
 *     base checkout's, so the comparison measures the code change and nothing
 *     else. A PR that edits biome.json shows up in review, not in this count.
 *
 * CI passes the PR's base commit (github.event.pull_request.base.sha), checked
 * out in a separate worktree. Infos are reported, not gated.
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const HEAD_DIR = path.resolve(__dirname, '..')
const BASE_DIR = process.argv[2] && path.resolve(process.argv[2])
if (!BASE_DIR || !fs.existsSync(path.join(BASE_DIR, 'src'))) {
  console.error('usage: node tools/biome-no-worse.js <base-frontend-dir>  (a checkout of the base commit\'s frontend/)')
  process.exit(2)
}
const BIOME = path.join(HEAD_DIR, 'node_modules', '.bin', 'biome')

function summary(dir) {
  let out
  try {
    out = execFileSync(BIOME, ['lint', 'src', '--reporter=json'], { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    // Biome exits non-zero whenever there are errors; the report is still on stdout.
    out = err.stdout
  }
  const s = JSON.parse(out).summary
  return { errors: s.errors, warnings: s.warnings, infos: s.infos }
}

fs.copyFileSync(path.join(HEAD_DIR, 'biome.json'), path.join(BASE_DIR, 'biome.json'))
const version = execFileSync(BIOME, ['--version'], { encoding: 'utf8' }).trim()
const base = summary(BASE_DIR)
const head = summary(HEAD_DIR)

console.log(`\nBiome (${version}), this tree's biome.json for both\n`)
console.log('            base   this tree')
for (const k of ['errors', 'warnings', 'infos']) {
  const gated = k === 'infos' ? '   (not gated)' : head[k] > base[k] ? '   WORSE' : ''
  console.log(`  ${k.padEnd(9)} ${String(base[k]).padStart(5)}   ${String(head[k]).padStart(5)}${gated}`)
}
const worse = ['errors', 'warnings'].filter((k) => head[k] > base[k])
if (worse.length) {
  console.log(`\nFAIL — more ${worse.join(' and ')} than the base. Run \`npx biome lint src\` to see them.`)
  process.exit(1)
}
console.log('\nPASS — no more errors or warnings than the base.')
