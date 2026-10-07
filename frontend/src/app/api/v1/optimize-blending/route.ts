import { type NextRequest, NextResponse } from 'next/server'
import { sanitizeNoSqlObject, validateReplayNonce } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'
import { z } from 'zod'

/**
 * Ore blending optimisation — proxy onto the FastAPI service layer.
 *
 * This handler previously contained a hand-rolled three-bucket ratio heuristic
 * that:
 *   - reported `solver_status: 'Simplex Optimal Solution Converged'` although
 *     no solver ran;
 *   - always returned `success: true`; and
 *   - reported the achieved grade as `Math.max(targetMn, avgMn)`, clamping the
 *     number up to the target so an out-of-spec blend still displayed as
 *     meeting it.
 *
 * The real optimiser is a SciPy HiGHS linear program
 * (`backend/app/ml/blending_optimizer.py`). It minimises cost subject to the
 * grade and contaminant constraints and returns `success: false` with a
 * diagnosis when a specification is unsatisfiable — PRD C-5, never propose the
 * physically impossible. That solver was unreachable from the UI until now.
 */

/*
 * Every field is required, here and in the backend. Missing assays used to be
 * filled in — P 0.12%, SiO2 5.0%, Rs 6,000/t for a stockpile, 5,000 t and
 * 41% Mn for the request — and a missing stockpile list became an empty one, so
 * a plan could be built on figures nobody supplied. A value the caller did not
 * state is now a 400, not an invented assay.
 */
const StockpileSchema = z.object({
  name: z.string().max(128),
  available_tonnes: z.number().min(0).max(10000000),
  mn_grade_pct: z.number().min(0).max(100),
  p_pct: z.number().min(0).max(10),
  sio2_pct: z.number().min(0).max(100),
  cost_per_tonne_inr: z.number().min(0).max(1000000),
})

const BlendRequestSchema = z.object({
  target_tonnes: z.number().min(1).max(5000000),
  target_mn_min: z.number().min(5).max(70),
  target_p_max: z.number().min(0).max(10),
  target_sio2_max: z.number().min(0).max(100),
  stockpiles: z.array(StockpileSchema).min(1).max(50),
})

export async function POST(request: NextRequest) {
  const nonceCheck = validateReplayNonce(request.headers.get('x-security-nonce'))
  if (!nonceCheck.valid) {
    return NextResponse.json({ error: nonceCheck.reason }, { status: 400 })
  }

  let cleanBody: unknown
  try {
    cleanBody = sanitizeNoSqlObject(await request.json())
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const parsed = BlendRequestSchema.safeParse(cleanBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid ore blending schema', details: parsed.error.format() },
      { status: 400 }
    )
  }

  // `target_tonnes`, the backend's name. This sent `required_tonnes`, which
  // the backend ignored and replaced with its own default of 5,000 t, so the
  // tonnage a planner typed never reached the solver.
  const payload = {
    target_tonnes: parsed.data.target_tonnes,
    target_mn_min: parsed.data.target_mn_min,
    target_p_max: parsed.data.target_p_max,
    target_sio2_max: parsed.data.target_sio2_max,
    stockpiles: parsed.data.stockpiles,
  }

  const result = await fetchFromBackend('/api/v1/optimize-blending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 15000,
  })

  if (result.ok) {
    return NextResponse.json({ ...result.data, served_by: 'fastapi', proxied_from: backendUrl() })
  }

  // No local fallback. Substituting a heuristic for a solver is what produced
  // the fabricated "Simplex Optimal Solution Converged" above; an unavailable
  // optimiser is reported as unavailable (PRD N-6).
  return NextResponse.json(
    {
      success: false,
      solver_status: 'Unavailable',
      message:
        'The blending optimiser is unavailable: the FastAPI service layer could not be reached. No blend plan is produced, because an unsolved blend must not be presented as an optimised one.',
      error: result.error,
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
