/**
 * What a rendered number has to satisfy — one definition, two guards.
 *
 * tools/provenance-guard.js applies it to every route as it loads;
 * tools/interaction-sweep.js applies it again after every click, because the
 * fabrications found late in this project (the map's sin()-derived layer
 * captions, the map-click "dossier") existed only after an interaction. Two
 * copies of these lists would drift, and a guard that drifts from the other
 * certifies nothing.
 */

/**
 * Text that looks like a measurement.
 *
 * Deliberately broad — a false positive costs one allowlist entry with a
 * reason, a false negative costs an unattributed number on screen.
 */
const DATA_SHAPED = [
  /\d+(?:\.\d+)?\s?%/,                               // 99.1%
  /\d[\d,]*(?:\.\d+)?\s?(?:t|kt|Mt|tonnes?)\b/i,     // 12,689 t
  /\d+(?:\.\d+)?\s?(?:mm|cm|km|m|ha|km²)\b/,         // 104.71 mm
  /\d+(?:\.\d+)?\s?°\s?[CF]?/,                       // 25.74 °C
  /\d+(?:\.\d+)?\s?(?:hours?|hrs?|days?)\b\/?(?:week|day)?/i,  // not bare `d`: "3D Map" is not a duration
  /\b0\.\d{2,}\b/,                                   // 0.812 — a probability or score
  /\b\d{1,3}(?:,\d{3})+\b/,                          // 12,689
  /₹\s?[\d,]+/,                                      // currency
]

/**
 * Chrome that is legitimately numeric and is not a measurement.
 * Every entry needs a reason; an allowlist without reasons becomes a dumping
 * ground and the guard stops meaning anything.
 */
const ALLOW = [
  { re: /^\s*\d{4}-\d{2}-\d{2}\s*$/,            why: 'ISO date' },
  { re: /\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/, why: 'human date' },
  { re: /\bv\d+(?:\.\d+)*\b/,                    why: 'version string' },
  { re: /\b\d+\.\d+\.\d+\b/,                     why: 'semantic version' },
  { re: /\bPRD\b|§\s?\d|\b[A-Z]-\d+\b|\bN-\d+\b|\bD-\d+\b/, why: 'PRD / requirement reference' },
  { re: /\bSIH\s?\d+\b/,                         why: 'problem statement number' },
  { re: /\b(?:19|20)\d{2}\b/,                    why: 'calendar year' },
  { re: /^\s*\d{1,2}\s*$/,                       why: 'bare small integer — pagination, list index, axis tick' },
  { re: /nakshatra-[a-z0-9-]+/i,                 why: 'model or generator version identifier' },
  { re: /seasonal-naive-\d+-v\d+/,               why: 'baseline version identifier' },
  { re: /track-a-[a-z0-9-]+/i,                   why: 'Track A model version identifier' },
  { re: /\b\d{1,2}:\d{2}\b/,                     why: 'clock time' },
  { re: /MOIL-[A-Z]{3}-\d{2}/,                   why: 'mine code' },
  { re: /\b(?:past|last|previous|rolling|over|preceding)\s+\d+\s*(?:days?|hours?|weeks?|months?)\b/i,
    why: 'time-window phrase in prose — names the window a figure covers, is not itself a figure' },
  { re: /^[A-Za-z][A-Za-z ()/-]{0,30},?\s*\d+\s*-?\s*(?:d|day|days|h|hour|hours|wk|week|weeks|mo|month|months)\b\.?$/i,
    why: 'metric label naming its own window ("Rainfall, 14 days") — the figure is the value beside it, not this' },
]

/**
 * The only values allowed on screen with the backend down: what the person in
 * front of it typed. A number the user entered into a form is theirs, not a
 * claim the app is making.
 */
const OFFLINE_ALLOW = [
  /^\s*[\d,.]+\s*(?:Tonnes?|t)?\s*$/i,
]

/**
 * A value that failed to compute, printed anyway. Attributed or not, these are
 * never correct on screen: "NaN%" was the map-click dossier's headline figure.
 */
const BROKEN = /\bNaN\b|\bundefined\b|(?<![\w-])-?Infinity\b|\[object Object\]/

function allowed(text) {
  for (const a of ALLOW) if (a.re.test(text)) return a.why
  return null
}

function looksLikeData(text) {
  return DATA_SHAPED.some((re) => re.test(text))
}

/**
 * Every visible text node on the page, with whether it sits inside a
 * provenance envelope. Runs in the page (passed to `page.evaluate`), so it
 * may not close over anything in this file.
 */
function collectTextNodes() {
  const out = []
  // Per element, its own text: the direct text nodes joined. JSX splits
  // `{tolerance}%` into "20" and "%", and `{n}% prediction interval` into "80"
  // and "% prediction interval" — read one node at a time, neither half looks
  // like a figure, so a figure could reach the screen unattributed by being
  // written with an expression in the middle.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  let el
  while ((el = walker.nextNode())) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue
    let text = ''
    for (const c of el.childNodes) if (c.nodeType === 3) text += c.textContent
    text = text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    // Invisible text is not a claim to anyone.
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    if (el.closest('[aria-hidden="true"]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    const attributed = !!el.closest('[data-provenance]')
    const where = []
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      where.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string'
        ? '.' + e.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        : ''))
      if (where.length >= 3) break
    }
    // A card that is showing "unavailable" may keep its label: "Rainfall,
    // 14 days" names the window a missing figure would have covered. It is
    // not itself a figure, and hiding the label would leave an unlabelled
    // empty card.
    const holder = el.closest('[data-provenance]')
    const inUnavailable = !!holder && /\bunavailable\b/i.test(holder.textContent || '')
    // Provenance printed on an asset that ships with the page — a scene id,
    // its date, its cloud cover. It travels with the image in the repo, so it
    // cannot go stale against an upstream and its presence offline says
    // nothing about whether the app invents data. Narrow on purpose: only
    // inside a <figure> that carries a provenance attribute.
    const isAssetCaption = !!el.closest('figure') && !!holder
    out.push({ text: text.slice(0, 120), attributed, inUnavailable, isAssetCaption, where: where.join(' < ') })
  }
  return out
}

/**
 * The rule itself. `offline` is the backend-down question: with no data
 * source, anything data-shaped still on screen came from the client.
 */
function violationsIn(nodes, { offline = false } = {}) {
  const out = []
  for (const node of nodes) {
    if (BROKEN.test(node.text)) {
      out.push({ ...node, rule: 'a value that failed to compute (NaN / undefined / Infinity) is on screen' })
      continue
    }
    if (!looksLikeData(node.text)) continue
    if (allowed(node.text)) continue
    if (node.attributed) {
      if (offline && !node.inUnavailable && !node.isAssetCaption &&
          !OFFLINE_ALLOW.some((re) => re.test(node.text))) {
        out.push({ ...node, rule: 'a figure is on screen with the backend down' })
      }
      continue
    }
    out.push({ ...node, rule: 'a figure outside any provenance envelope' })
  }
  return out
}

module.exports = {
  DATA_SHAPED, ALLOW, OFFLINE_ALLOW, BROKEN,
  allowed, looksLikeData, collectTextNodes, violationsIn,
}
