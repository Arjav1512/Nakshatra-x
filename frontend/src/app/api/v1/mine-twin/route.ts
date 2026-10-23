import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { ASSUMPTION_GROUPS, ASSUMPTION_NOTE } from '@/lib/scenario-assumptions'
import { FALLBACK_MINES } from '@/components/mission-control/data'

/**
 * What-if scenario calculator (PRD C-6 scenario comparison, C-4 assumptions).
 *
 * This multiplies a real baseline by coefficients the planner supplies. It is
 * arithmetic over stated assumptions, and the response says so in every field
 * that leaves here.
 *
 * WHAT CHANGED, AND WHY
 * ---------------------
 * 1. The multiplier tables lived here, invisible to the person using them. They
 *    now live in `src/lib/scenario-assumptions.ts`, are rendered on screen with
 *    their values, and are editable — so the assumptions are part of the result
 *    rather than a note nobody reads. The caller sends the factors it used.
 *
 * 2. `IN_MEMORY_SCENARIOS` shipped **pre-populated** with two fabricated runs —
 *    Balaghat 16,620/14,200/2,420 and Bharweli 13,850/12,200/1,650 — stamped
 *    `Date.now() - 3600000` and `- 7200000` so they presented as saved work from
 *    one and two hours ago. Nothing computed them. They rendered with the
 *    service layer stopped, which is how they were found. A scenario exists only
 *    when someone runs one.
 *
 * 3. `riskDelta` was a hardcoded ternary — 0.06 / 0.08 / -0.05 / -0.03 keyed off
 *    which control moved. Nothing in this system estimates a change in risk, so
 *    it is gone rather than dressed up.
 *
 * The baseline is not defaulted and not accepted from a client constant: the
 * caller reads it from the mine's forecast artifact and sends it with its
 * provenance, and without it this endpoint returns 400.
 */

type SimInput = {
  mineId: string
  /** Ignored: the mine's name is taken from the server's own mine list. */
  mineName?: string
  /** The factor actually used per assumption group, as shown in the UI. */
  factors: Record<string, number>
  /** Human-readable selection per group, for the record. */
  selections: Record<string, string | number>
  /** Baseline tonnes, read from the mine's forecast artifact. */
  baselineProduction: number
  /** Where that baseline came from, carried through onto the scenario. */
  baselineSource: string
  baselineModelVersion?: string | null
}

/**
 * 4. The history is the browser's, not this process's.
 *
 * Scenarios used to be appended to a module-level array and returned to every
 * caller, so a planner's runs — under a heading reading "Scenarios you have run
 * · this session only" — appeared on every other visitor's screen, along with
 * any text a direct API caller chose to send (a 2 MB mine name was stored and
 * served back). This endpoint now keeps nothing: it validates, computes and
 * returns one scenario, and MineTwinPanel keeps the history in sessionStorage,
 * which is what "this session only" says.
 */

/** Bounds on one request. The panel sends well under 1 KB. */
const MAX_BODY_BYTES = 8 * 1024
/** A multiplier outside this range is not a plausible planner assumption. */
const FACTOR_MIN = 0.01
const FACTOR_MAX = 10
const MAX_BASELINE_T = 1e9
const MAX_TEXT = 300

const GROUPS = new Map(ASSUMPTION_GROUPS.map((g) => [g.id as string, g]))

function badRequest(error: string, note: string) {
  return NextResponse.json({ success: false, error, note }, { status: 400 })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: 'Request body too large.' }, { status: 413 })
  }
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: 'Request body too large.' }, { status: 413 })
  }

  let body: SimInput
  try {
    body = JSON.parse(raw) as SimInput
  } catch {
    return badRequest('Malformed JSON body.', 'Send the scenario as a JSON object.')
  }
  if (!isRecord(body)) {
    return badRequest('Malformed JSON body.', 'Send the scenario as a JSON object.')
  }

  const baseProd = body.baselineProduction
  if (typeof baseProd !== 'number' || !Number.isFinite(baseProd) || baseProd <= 0 || baseProd > MAX_BASELINE_T) {
    return badRequest(
      'baselineProduction is required and must be a positive number.',
      'Every figure this endpoint returns is derived from the baseline, so it is not defaulted. ' +
        'Read it from the mine forecast artifact.'
    )
  }
  if (typeof body.baselineSource !== 'string' || !body.baselineSource.trim() || body.baselineSource.length > MAX_TEXT) {
    return badRequest(
      'baselineSource is required.',
      'The baseline carries its own provenance onto the scenario; a figure without it cannot be attributed.'
    )
  }
  const modelVersion = body.baselineModelVersion ?? null
  if (modelVersion !== null && (typeof modelVersion !== 'string' || modelVersion.length > 80)) {
    return badRequest('baselineModelVersion must be a short string or null.', 'It names the forecaster that produced the baseline.')
  }

  // The mine and its name come from this server's mine list, not the caller.
  const mine = FALLBACK_MINES.find((m) => m.id === body.mineId)
  if (!mine) {
    return badRequest('Unknown mineId.', 'Scenarios run against a mine this system knows.')
  }

  const factors = isRecord(body.factors) ? body.factors : {}
  const entries = Object.entries(factors)
  if (
    !entries.length ||
    entries.some(
      ([k, f]) =>
        !GROUPS.has(k) || typeof f !== 'number' || !Number.isFinite(f) || f < FACTOR_MIN || f > FACTOR_MAX
    )
  ) {
    return badRequest(
      `factors must map assumption groups to numbers between ${FACTOR_MIN} and ${FACTOR_MAX}.`,
      'The multipliers are planner assumptions supplied by the caller and shown on screen; ' +
        'this endpoint does not hold a private copy.'
    )
  }

  const selections = isRecord(body.selections) ? body.selections : {}
  for (const [k, v] of Object.entries(selections)) {
    const group = GROUPS.get(k)
    if (!group || !group.options.some((o) => o.value === v)) {
      return badRequest('Unknown selection.', `Each selection must be one of the options shown for ${k}.`)
    }
  }

  const values = entries.map(([, f]) => f as number)
  const multiplier = values.reduce((a, f) => a * f, 1)
  const predicted = Math.round(baseProd * multiplier)

  const scenario = {
    id: randomUUID(),
    mine_id: mine.id,
    mine_name: mine.name,
    selections,
    factors,
    combined_multiplier: Number(multiplier.toFixed(4)),
    baseline_production_t: baseProd,
    baseline_source: body.baselineSource,
    baseline_model_version: modelVersion,
    estimated_production_t: predicted,
    difference_t: predicted - baseProd,
    kind: 'assumption' as const,
    created_at: new Date().toISOString(),
  }

  return NextResponse.json({
    success: true,
    model_note: ASSUMPTION_NOTE,
    kind: 'assumption',
    estimated: predicted,
    difference: predicted - baseProd,
    combined_multiplier: scenario.combined_multiplier,
    scenario,
  })
}
