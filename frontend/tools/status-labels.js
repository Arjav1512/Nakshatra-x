/**
 * Every status label on the page, measured — including the ones axe skips.
 *
 * Used by tools/a11y.js and tools/a11y-map-layers.js on the same page states
 * they audit with axe.
 *
 * Why this exists beside axe: axe reports a colour-contrast node as a
 * violation, a pass, or "incomplete" — and in an online run it did none of the
 * three for the layer switcher's labels (docs/CI.md), the same "ON" that
 * measured 3.85:1 offline. A status label is the text that says what state the
 * data is in (LIVE, CACHED, SYNTHETIC, DEGRADED, unavailable, ON). It is the
 * one kind of text this product cannot afford to be unreadable, so each one is
 * found by its colour and measured directly.
 *
 * A status label is any element with its own text whose computed colour is
 * one of the status or accent tokens (src/app/tokens.css). Its background is
 * the visual stack under it (elementsFromPoint), composited down to the first
 * opaque layer, with element opacity applied; a CSS gradient counts at its
 * worst stop. WCAG 2.2 SC 1.4.3: 4.5:1, or 3:1 for large text (>= 24 px, or
 * >= 18.66 px bold).
 *
 * Measured: labels below the fold (scrolled to) and inside closed <details>
 * (opened, then closed again). Skipped: disabled controls (exempt under the
 * same criterion) and text an ancestor clips away entirely. A label over an
 * image, or with no opaque background under it, cannot be measured; it is
 * reported by name as UNVERIFIABLE and fails the audit like a low ratio,
 * because a label nobody has measured has not been shown to be readable.
 */
const fs = require('node:fs')
const path = require('node:path')

const STATUS_TOKENS = ['accent', 'status-nominal', 'status-caution', 'status-critical', 'status-unknown']

/**
 * The status and accent colours, read from the token file, so they cannot drift.
 *
 * Every definition counts, not only the first: tokens.css defines each one for
 * the light surfaces and again inside .chrome-dark (the map's dark chrome), and
 * a label drawn in either value is a status label. The first is named as the
 * token; later ones as "<token> (<n>)", e.g. "accent (2)".
 */
function statusTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'tokens.css'), 'utf8')
  const out = {}
  for (const name of STATUS_TOKENS) {
    const all = [...css.matchAll(new RegExp(`--color-${name}:\\s*#([0-9a-fA-F]{6})`, 'g'))]
    if (!all.length) throw new Error(`token --color-${name} not found in tokens.css`)
    all.forEach((m, i) => {
      out[i === 0 ? name : `${name} (${i + 1})`] = [0, 2, 4].map((j) => Number.parseInt(m[1].slice(j, j + 2), 16))
    })
  }
  // status-unknown shares its value with text-tertiary, so tertiary text is
  // measured too and named for both.
  const tertiary = css.match(/--color-text-tertiary:\s*#([0-9a-fA-F]{6})/)
  if (tertiary && css.includes(`--color-status-unknown: #${tertiary[1]}`)) {
    out['status-unknown / text-tertiary'] = out['status-unknown']
    delete out['status-unknown']
  }
  return out
}

/** Runs in the page. Returns one row per status label. */
function measureInPage(tokens) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  // Any CSS colour Chrome can compute — rgb(), color(srgb …), oklab() from
  // Tailwind's color-mix() opacity modifiers — read back as sRGB + alpha.
  const rgba = (css) => {
    if (!css || css === 'transparent') return [0, 0, 0, 0]
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const over = (top, a, under) => top.map((c, i) => c * a + under[i] * (1 - a))
  const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  const tokenOf = ([r, g, b]) =>
    Object.keys(tokens).find((k) => tokens[k].every((v, i) => Math.abs(v - [r, g, b][i]) <= 1))
  const opacityOf = (el) => {
    let o = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
    return o
  }
  const IMAGERY = new Set(['IMG', 'CANVAS', 'VIDEO', 'IFRAME', 'image'])
  const COLOUR = /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\([^()]*\)/g

  // A closed <details> hides labels a reader is one click from seeing; open
  // every one while measuring, and close them again after.
  const closed = [...document.querySelectorAll('details:not([open])')]
  for (const d of closed) d.open = true

  const rows = []
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own.length) continue
    if (!el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue
    const cs = getComputedStyle(el)
    const fg = rgba(cs.color)
    const token = tokenOf(fg)
    if (!token) continue
    if (el.closest(':disabled, [aria-disabled="true"]')) continue
    const range = document.createRange()
    range.selectNodeContents(own[0])
    const firstRect = () => [...range.getClientRects()].find((r) => r.width > 1 && r.height > 1)
    if (!firstRect()) continue // clipped (sr-only) or not laid out
    const text = own.map((n) => n.textContent.trim()).join(' ').slice(0, 40)
    const size = Number.parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5

    // A label below the fold is scrolled to, so the stack under it is the one
    // a reader sees.
    let rect = firstRect()
    if (rect.top < 0 || rect.bottom > innerHeight || rect.left < 0 || rect.right > innerWidth) {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
      rect = firstRect()
    }
    // Text an ancestor clips away entirely (a map label outside the map's
    // frame) is seen by no one, so there is nothing to measure. Text an
    // ancestor clips partly — a map label straddling the map's edge — is
    // measured where it is visible: the centre of its box intersected with
    // every clipping ancestor. Sampling the centre of the whole box measured
    // the half that is not drawn, against whatever lay outside the frame
    // (found when the page around the dark map became light: a 5 px sliver of
    // "Tirodi" over the map, sampled 15 px outside it on the page).
    // Only ancestors clip here, not the viewport, so text pushed off-screen
    // is still sampled where it is laid out and still fails as before.
    let vis = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    for (let e = el.parentElement; e; e = e.parentElement) {
      const ecs = getComputedStyle(e)
      if (ecs.overflowX === 'visible' && ecs.overflowY === 'visible') continue
      const c = e.getBoundingClientRect()
      vis = {
        left: Math.max(vis.left, c.left), right: Math.min(vis.right, c.right),
        top: Math.max(vis.top, c.top), bottom: Math.min(vis.bottom, c.bottom),
      }
    }
    if (vis.right - vis.left < 1 || vis.bottom - vis.top < 1) continue
    const cx = (vis.left + vis.right) / 2
    const cy = (vis.top + vis.bottom) / 2
    const stack = document.elementsFromPoint(cx, cy)
    let i = stack.indexOf(el)
    // pointer-events: none keeps an element out of elementsFromPoint; its
    // nearest ancestor that is in the stack stands in for it.
    for (let e = el; i === -1 && e; e = e.parentElement) i = stack.indexOf(e)

    // Each layer is one or more possible colours: a background colour is one,
    // a CSS gradient is each of its stops, measured at its worst.
    const layers = []
    let unverifiable = i === -1 ? 'not on screen where it is laid out' : null
    let opaque = false
    for (const s of i === -1 ? [] : stack.slice(i)) {
      if (IMAGERY.has(s.tagName) || IMAGERY.has(s.nodeName)) { unverifiable = `over ${s.tagName.toLowerCase()}`; break }
      const scs = getComputedStyle(s)
      const image = scs.backgroundImage
      if (image && image !== 'none') {
        if (image.includes('url(')) { unverifiable = 'over a background image'; break }
        const stops = (image.match(COLOUR) || []).map(rgba)
        if (stops.length) layers.push(stops)
        if (stops.length && stops.every((c) => c[3] >= 0.999)) { opaque = true; break }
      }
      const bg = rgba(scs.backgroundColor)
      if (bg[3] > 0) layers.push([bg])
      if (bg[3] >= 0.999) { opaque = true; break }
    }
    if (!unverifiable && !opaque) unverifiable = 'no opaque background under it'
    if (unverifiable) {
      rows.push({ text, token, verdict: 'UNVERIFIABLE', reason: unverifiable })
      continue
    }
    let backs = [[0, 0, 0]]
    for (const alts of layers.reverse()) {
      backs = backs.flatMap((b) => alts.map((c) => over(c.slice(0, 3), c[3], b)))
    }
    const alpha = fg[3] * opacityOf(el)
    const measured = backs
      .map((b) => { const f = over(fg.slice(0, 3), alpha, b); return { f, b, r: ratio(f, b) } })
      .sort((x, y) => x.r - y.r)[0]
    rows.push({
      text, token, fg: hex(measured.f), bg: hex(measured.b), ratio: Math.round(measured.r * 100) / 100, need,
      verdict: measured.r >= need ? 'PASS' : 'FAIL',
    })
  }
  for (const d of closed) d.open = false
  return rows
}

/**
 * Measure the page's status labels and print a one-line summary plus each
 * failure. `fails` holds both the labels below threshold and the unverifiable.
 */
async function auditStatusLabels(page, label) {
  const rows = await page.evaluate(measureInPage, statusTokens())
  const below = rows.filter((r) => r.verdict === 'FAIL')
  const unverifiable = rows.filter((r) => r.verdict === 'UNVERIFIABLE')
  const worst = rows.filter((r) => r.ratio).sort((a, b) => a.ratio - b.ratio)[0]
  console.log(
    `    status labels ${label}: ${rows.length} found, ${below.length} below threshold` +
      `${unverifiable.length ? `, ${unverifiable.length} unverifiable` : ''}` +
      `${worst ? `; lowest ${worst.ratio}:1 ("${worst.text}", ${worst.token})` : ''}`
  )
  for (const f of below) console.log(`      FAIL  "${f.text}"  ${f.token} ${f.fg} on ${f.bg}  ${f.ratio}:1 < ${f.need}:1`)
  for (const u of unverifiable) console.log(`      UNVERIFIABLE  "${u.text}"  ${u.token} — ${u.reason}`)
  return { rows, fails: [...below, ...unverifiable] }
}

module.exports = { auditStatusLabels, statusTokens }
