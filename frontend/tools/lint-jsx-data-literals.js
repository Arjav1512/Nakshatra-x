#!/usr/bin/env node
/**
 * Flag numeric literals rendered as data in JSX.
 *
 *   npm run lint:literals
 *
 * The rendered-page guard checks the screen and only sees states a crawler can
 * reach. `Measured<T>` closes the `Metric` path at compile time. This closes
 * the third gap: a number typed straight into markup, which needs no component
 * and no envelope.
 *
 * It found "725-point spatial grid" in prose while the model scored 1,710 —
 * a wrong number, invisible to grep because 725 is a plausible integer in a
 * sentence, and invisible to the crawler because it rendered perfectly.
 *
 * WHAT COUNTS
 * -----------
 * A numeric literal in JSX *text* — between tags, or inside a `{'...'}` string
 * child — that carries a unit or reads as a measurement. Attributes, classNames,
 * viewBox, style values, array indices and arithmetic are not text and are not
 * flagged.
 *
 * Deliberately conservative on shape and loud on what it does catch: a false
 * positive costs one `// data-literal-ok:` with a reason, a false negative is a
 * number on screen that nobody can source.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', 'src')
const FIX_HINT = '// data-literal-ok: <reason>'

/** Text that reads as a measurement rather than as chrome. */
const DATA_SHAPED = [
  /\d+(?:\.\d+)?\s?%/,
  /\d[\d,]*(?:\.\d+)?\s?(?:t|kt|Mt|tonnes?)\b/i,
  /\d+(?:\.\d+)?\s?(?:mm|cm|km|ha)\b/,
  /\d+(?:\.\d+)?\s?°\s?[CF]/,
  /\b\d{1,3}(?:,\d{3})+\b/,
  /₹\s?[\d,]+/,
  /\b\d+(?:\.\d+)?[-\s]?(?:point|cell|node)\b/i,
]

const ALLOW = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\bv\d+(?:\.\d+)*\b/,
  /\bPRD\b|§\s?\d|\b[A-Z]-\d+\b/,
  /\b(?:19|20)\d{2}\b/,
  /\b\d{1,2}:\d{2}\b/,
  /MOIL-[A-Z]{3}-\d{2}/,
]

const findings = []

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')

  // Track block comments: prose about a removed fabrication is not a
  // fabrication, and this file is full of it by design.
  let inBlockComment = false

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (inBlockComment) {
      if (/\*\//.test(line)) inBlockComment = false
      return
    }
    if (/^\{?\/\*/.test(trimmed) && !/\*\//.test(trimmed)) { inBlockComment = true; return }
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return
    if (/^\{?\/\*.*\*\/\}?$/.test(trimmed)) return
    // Animation and CSS config read like percentages but position nothing.
    if (/^\s*(?:start|end|ease|duration|delay|stagger|scrub|yPercent|xPercent|opacity|scale|rotate|top|left|right|bottom|width|height|translate\w*)\s*:/.test(line)) return
    // An explicit, reasoned exemption on this line or the one above.
    if (/data-literal-ok:/.test(line) || /data-literal-ok:/.test(lines[i - 1] ?? '')) return

    // JSX text: a line that is not an attribute and sits between tags.
    // Attributes look like `name={...}` or `name="..."`; skip those outright.
    const withoutAttrs = line
      .replace(/\b[\w-]+=\{[^}]*\}/g, ' ')
      .replace(/\b[\w-]+="[^"]*"/g, ' ')
      .replace(/\b[\w-]+='[^']*'/g, ' ')

    // Only consider text that is actually rendered: between > and <, or a
    // string child in braces.
    const textChunks = []
    const between = withoutAttrs.match(/>([^<>{}]+)</g) || []
    for (const c of between) textChunks.push(c.slice(1, -1))
    const braced = withoutAttrs.match(/\{\s*['"`]([^'"`]+)['"`]\s*\}/g) || []
    for (const c of braced) textChunks.push(c)
    // A bare text line inside a JSX block (no tags on it at all).
    if (!/[<>]/.test(withoutAttrs) && /^[^{}()[\];=]*$/.test(withoutAttrs.trim())) {
      textChunks.push(withoutAttrs)
    }

    for (const chunk of textChunks) {
      const text = chunk.trim()
      if (!text) continue
      if (ALLOW.some((re) => re.test(text))) continue
      if (!DATA_SHAPED.some((re) => re.test(text))) continue
      findings.push({
        file: path.relative(path.resolve(__dirname, '..', '..'), file),
        line: i + 1,
        text: text.slice(0, 90),
      })
    }
  })
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.tsx$/.test(entry.name)) scanFile(full)
  }
}

walk(ROOT)

for (const f of findings) {
  console.log(`  ${f.file}:${f.line}\n      ${JSON.stringify(f.text)}`)
}
console.log(
  `\n${findings.length === 0 ? 'PASS' : 'FAIL'} — ${findings.length} numeric literal(s) rendered as data in JSX`
)
if (findings.length) {
  console.log(`\nEach one is either a number that should come from an envelope, or chrome that\nneeds \`${FIX_HINT}\` on the line above saying why.\n`)
}
process.exit(findings.length === 0 ? 0 : 1)
