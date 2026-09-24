import { type NextRequest, NextResponse } from 'next/server'

type SimInput = {
  mineId: string
  mineName: string
  shiftWindow: '04-10' | '06-14' | '22-06'
  blastingDelayHours: 0 | 6 | 12
  redeploy: 'none' | '1-crusher' | '1-shovel-1-dumper'
  dryBlastTolerance: 10 | 20 | 30
  baselineProduction: number
  currentRisk?: number
}

/**
 * Scenario multipliers.
 *
 * These are stated assumptions, not fitted coefficients: no data was used to
 * derive them and they describe no measured mine. The endpoint is a
 * deterministic what-if calculator, which is useful for comparing options
 * against each other and useless as a prediction. The validated forecaster is
 * nakshatra-gbt-cqr-v1, served from /api/v1/mines/{id}/forecast with a
 * published backtest.
 */
const SHIFT_BONUS: Record<string, number> = {
  '04-10': 1.18,
  '06-14': 1.06,
  '22-06': 0.92,
}

const BLASTING_PENALTY: Record<number, number> = {
  0: 1.0,
  6: 0.93,
  12: 0.84,
}

const REDEPLOY_BONUS: Record<string, number> = {
  none: 1.0,
  '1-crusher': 1.07,
  '1-shovel-1-dumper': 1.12,
}

const TOLERANCE_PENALTY: Record<number, number> = {
  10: 0.96,
  20: 0.99,
  30: 1.01,
}

// In-memory scenario fallback storage for local zero-config serverless sessions
let IN_MEMORY_SCENARIOS: any[] = [
  {
    id: 'scen-demo-1',
    mine_id: 'balaghat',
    mine_name: 'Balaghat',
    shift_window: '04-10',
    blasting_delay_hours: 0,
    redeploy: '1-shovel-1-dumper',
    dry_blast_tolerance: 20,
    predicted_production_t: 16620,
    baseline_production_t: 14200,
    recovery_t: 2420,
    risk_delta: -0.05,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'scen-demo-2',
    mine_id: 'bharweli',
    mine_name: 'Bharweli',
    shift_window: '06-14',
    blasting_delay_hours: 6,
    redeploy: '1-crusher',
    dry_blast_tolerance: 10,
    predicted_production_t: 13850,
    baseline_production_t: 12200,
    recovery_t: 1650,
    risk_delta: -0.02,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SimInput

    const shiftFactor = SHIFT_BONUS[body.shiftWindow] ?? 1
    const blastFactor = BLASTING_PENALTY[body.blastingDelayHours] ?? 1
    const redeployFactor = REDEPLOY_BONUS[body.redeploy] ?? 1
    const toleranceFactor = TOLERANCE_PENALTY[body.dryBlastTolerance] ?? 1

    const multiplier = shiftFactor * blastFactor * redeployFactor * toleranceFactor

    // `body.baselineProduction || 14200` silently substituted a literal
    // baseline when the caller sent none, so every derived figure below rested
    // on a number nobody supplied. The baseline is now required.
    const baseProd = body.baselineProduction
    if (typeof baseProd !== 'number' || !Number.isFinite(baseProd) || baseProd <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'baselineProduction is required and must be a positive number.',
          note: 'Every figure this endpoint returns is derived from the baseline, so it is not defaulted.',
        },
        { status: 400 }
      )
    }
    const predicted = Math.round(baseProd * multiplier)
    const recovery = predicted - baseProd

    const riskDelta =
      body.shiftWindow === '22-06'
        ? 0.06
        : body.blastingDelayHours === 12
        ? 0.08
        : body.redeploy === '1-shovel-1-dumper'
        ? -0.05
        : -0.03

    // `confidence` used to be reported here as
    //     min(96, max(72, 90 - |blastingDelayHours| * 1.4 + (redeploy ? 2 : 0)))
    // which is not a confidence: no interval, no validation, and the 72/96
    // bounds and 1.4 coefficient were picked to make the number look plausible.
    // A scenario calculator with fixed multipliers has no uncertainty to
    // report, so it reports none.

    const newScenario = {
      id: `scen-${Date.now()}`,
      mine_id: body.mineId || 'balaghat',
      mine_name: body.mineName || 'Balaghat',
      shift_window: body.shiftWindow,
      blasting_delay_hours: body.blastingDelayHours,
      redeploy: body.redeploy,
      dry_blast_tolerance: body.dryBlastTolerance,
      predicted_production_t: predicted,
      baseline_production_t: baseProd,
      recovery_t: recovery,
      risk_delta: riskDelta,
      created_at: new Date().toISOString(),
    }

    IN_MEMORY_SCENARIOS = [newScenario, ...IN_MEMORY_SCENARIOS.slice(0, 19)]

    return NextResponse.json({
      success: true,
      model_note:
        'Deterministic what-if calculator over fixed multipliers that are stated assumptions, ' +
        'not fitted coefficients. Not a forecast, and no uncertainty is reported because none ' +
        'is computed. The validated forecaster is nakshatra-gbt-cqr-v1.',
      predicted,
      recovery,
      riskDelta,
      scenario: newScenario,
      scenarios: IN_MEMORY_SCENARIOS,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Mine Twin Simulation failed' },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ scenarios: IN_MEMORY_SCENARIOS })
}
