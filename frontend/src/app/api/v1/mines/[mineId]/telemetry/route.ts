import { NextRequest, NextResponse } from 'next/server'
import { MineIdParamSchema, validateReplayNonce } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'
import { degradedTelemetry } from '@/lib/degraded-telemetry'

/**
 * Mine telemetry — proxy onto the FastAPI service layer.
 *
 * Architecture (SIH26009-Architecture.excalidraw, L4): FastAPI is the API /
 * service layer. This handler previously computed the headline numbers itself,
 * in parallel with an independent FastAPI implementation — which is why the
 * real SciPy blend LP and the NASA POWER client were unreachable from the UI.
 * All computation now lives in `backend/app/api/telemetry.py`; this route only
 * validates the request, forwards it, and degrades honestly if the backend is
 * unreachable.
 *
 * PRD N-6: degrade gracefully, state staleness, never silently extrapolate.
 * The degraded payload is explicitly synthetic, issues no recommendation, and
 * is never labelled live.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mineId: string }> }
) {
  const nonceCheck = validateReplayNonce(request.headers.get('x-security-nonce'))
  if (!nonceCheck.valid) {
    return NextResponse.json({ error: nonceCheck.reason }, { status: 400 })
  }

  const resolvedParams = await params
  const parsedId = MineIdParamSchema.safeParse(resolvedParams.mineId)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid Mine ID parameter' }, { status: 400 })
  }

  const idNum = parseInt(parsedId.data, 10) || 1

  const result = await fetchFromBackend(`/api/v1/mines/${idNum}/telemetry`)

  if (result.ok) {
    return NextResponse.json({
      ...result.data,
      proxied_from: backendUrl(),
    })
  }

  // Backend unreachable — honest degradation, not a silent substitute.
  return NextResponse.json(degradedTelemetry(idNum, result.error), { status: 200 })
}
