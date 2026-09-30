import { type NextRequest, NextResponse } from 'next/server'
import { ASSUMPTION_NOTE } from '@/lib/scenario-assumptions'

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
  mineName: string
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

/** Scenarios this process has been asked to compute. Empty until then. */
let SCENARIOS: any[] = []

function badRequest(error: string, note: string) {
  return NextResponse.json({ success: false, error, note }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SimInput

    const baseProd = body.baselineProduction
    if (typeof baseProd !== 'number' || !Number.isFinite(baseProd) || baseProd <= 0) {
      return badRequest(
        'baselineProduction is required and must be a positive number.',
        'Every figure this endpoint returns is derived from the baseline, so it is not defaulted. ' +
          'Read it from the mine forecast artifact.'
      )
    }
    if (!body.baselineSource) {
      return badRequest(
        'baselineSource is required.',
        'The baseline carries its own provenance onto the scenario; a figure without it cannot be attributed.'
      )
    }

    const factors = body.factors ?? {}
    const values = Object.values(factors)
    if (!values.length || values.some((f) => typeof f !== 'number' || !Number.isFinite(f) || f <= 0)) {
      return badRequest(
        'factors must be a non-empty map of positive numbers.',
        'The multipliers are planner assumptions supplied by the caller and shown on screen; ' +
          'this endpoint does not hold a private copy.'
      )
    }

    const multiplier = values.reduce((a, f) => a * f, 1)
    const predicted = Math.round(baseProd * multiplier)

    const scenario = {
      id: `scen-${Date.now()}`,
      mine_id: body.mineId,
      mine_name: body.mineName,
      selections: body.selections ?? {},
      factors,
      combined_multiplier: Number(multiplier.toFixed(4)),
      baseline_production_t: baseProd,
      baseline_source: body.baselineSource,
      baseline_model_version: body.baselineModelVersion ?? null,
      estimated_production_t: predicted,
      difference_t: predicted - baseProd,
      kind: 'assumption' as const,
      created_at: new Date().toISOString(),
    }

    SCENARIOS = [scenario, ...SCENARIOS.slice(0, 19)]

    return NextResponse.json({
      success: true,
      model_note: ASSUMPTION_NOTE,
      kind: 'assumption',
      estimated: predicted,
      difference: predicted - baseProd,
      combined_multiplier: scenario.combined_multiplier,
      scenario,
      scenarios: SCENARIOS,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Scenario calculation failed' },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ scenarios: SCENARIOS, model_note: ASSUMPTION_NOTE })
}
