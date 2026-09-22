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

const StockpileSchema = z.object({
  name: z.string().max(128),
  available_tonnes: z.number().min(0).max(10000000),
  mn_grade_pct: z.number().min(0).max(100),
  p_pct: z.number().min(0).max(10).optional(),
  sio2_pct: z.number().min(0).max(100).optional(),
  cost_per_tonne_inr: z.number().min(0).max(1000000).optional(),
})

const BlendRequestSchema = z.object({
  target_tonnes: z.number().min(1).max(5000000).optional(),
  target_mn_min: z.number().min(5).max(70).optional(),
  target_p_max: z.number().min(0).max(10).optional(),
  target_sio2_max: z.number().min(0).max(100).optional(),
  stockpiles: z.array(StockpileSchema).max(50).optional(),
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

  const payload = {
    required_tonnes: parsed.data.target_tonnes ?? 5000,
    target_mn_min: parsed.data.target_mn_min ?? 41.0,
    target_p_max: parsed.data.target_p_max ?? 0.15,
    target_sio2_max: parsed.data.target_sio2_max ?? 6.5,
    stockpiles: (parsed.data.stockpiles ?? []).map((s) => ({
      name: s.name,
      available_tonnes: s.available_tonnes,
      mn_grade_pct: s.mn_grade_pct,
      p_pct: s.p_pct ?? 0.12,
      sio2_pct: s.sio2_pct ?? 5.0,
      cost_per_tonne_inr: s.cost_per_tonne_inr ?? 6000,
    })),
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
