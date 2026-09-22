import { type NextRequest, NextResponse } from 'next/server'
import { sanitizeNoSqlObject, validateReplayNonce } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'
import { z } from 'zod'

/**
 * Track A map-click prediction — proxy onto the real model (PRD A-3, A-4, A-7).
 *
 * This handler previously computed a probability as:
 *
 *     proximityFactor = (15 - min(distToFaultKm, 15)) / 15
 *     baseProb        = 0.72 + proximityFactor * 0.22
 *
 * — a closed-form function of distance to the nearest known mine, presented as
 * a model prediction. It also synthesised elevation and slope from the same
 * proximity term. Clicking near a mine returned a high number because the
 * formula said so, not because anything had been measured.
 *
 * It now calls the fitted model, which scores **real Sentinel-2 surface
 * reflectance and SRTM terrain** for the clicked point and reports per-cell
 * uncertainty from kriging variance. Honest LOMO AUC is 0.85 (95% CI
 * 0.723–0.95), against the ~0.98 the leaked pipeline reported.
 *
 * Guardrails travel with the response: surface indicators only, and the output
 * is a prospectivity score for a qualified person — never a reserve figure
 * (PRD §2.2, §2.4).
 */

const PredictSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** A live satellite read takes a few seconds; the map can request the
   *  kriged surface alone for instant feedback. */
  live: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const nonceCheck = validateReplayNonce(request.headers.get('x-security-nonce'))
  if (!nonceCheck.valid) {
    return NextResponse.json({ error: nonceCheck.reason }, { status: 400 })
  }

  let body: unknown
  try {
    body = sanitizeNoSqlObject(await request.json())
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const parsed = PredictSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid prediction request', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const { lat, lng, live = true } = parsed.data
  const result = await fetchFromBackend(
    `/api/v1/prospectivity/predict?lat=${lat}&lng=${lng}&live=${live}`,
    { timeoutMs: live ? 60000 : 10000 }
  )

  if (result.ok) {
    return NextResponse.json({ ...result.data, served_by: 'fastapi', proxied_from: backendUrl() })
  }

  // No local fallback. A closed-form stand-in for a model is exactly what was
  // removed here; an unavailable model is reported as unavailable (PRD N-6).
  return NextResponse.json(
    {
      error: 'Prospectivity model unavailable',
      detail: result.error,
      note:
        'The FastAPI service layer could not be reached. No score is returned, ' +
        'because a value not produced by the model must not be presented as one.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
