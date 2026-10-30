import { type NextRequest, NextResponse } from 'next/server'
import { MineNumericIdParamSchema, validateReplayNonce } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Mine telemetry — proxy onto the FastAPI service layer.
 *
 * Architecture (SIH26009-Architecture.excalidraw, L4): FastAPI is the API /
 * service layer. This handler previously computed the headline numbers itself,
 * in parallel with an independent FastAPI implementation — which is why the
 * real SciPy blend LP and the NASA POWER client were unreachable from the UI.
 * All computation now lives in `backend/app/api/telemetry.py`; this route only
 * validates the request, forwards it, and reports a failure as one.
 *
 * PRD N-6: degrade gracefully, state staleness, never silently extrapolate.
 *
 * DEF-1, second instance. When the backend did not answer 200 — unreachable,
 * or a 404 for a mine it does not have — this route returned a "degraded"
 * payload built from a mine register hardcoded in Next.js, defaulting any id
 * not in it to Balaghat. So /mines/99/telemetry answered 200 with Balaghat's
 * name, code and coordinates, and every degraded payload carried a planned
 * tonnage the service layer never served. The register lives in FastAPI; this
 * route no longer keeps a copy. A 404 is passed through, and an unreachable
 * backend is reported as unavailable, with no figure and no mine record.
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
  const parsedId = MineNumericIdParamSchema.safeParse(resolvedParams.mineId)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid Mine ID parameter' }, { status: 400 })
  }

  // DEF-1: this was `parseInt(parsedId.data, 10) || 1`. A slug parsed to NaN
  // and `NaN || 1` resolved to mine 1, so a request for any other mine
  // returned Balaghat's record — one mine's measurements under another
  // mine's name, with no degradation flag. The id is now validated as an
  // integer at the edge and never defaulted.
  const idNum = parsedId.data

  const result = await fetchFromBackend(`/api/v1/mines/${idNum}/telemetry`)

  if (result.ok) {
    return NextResponse.json({
      ...result.data,
      proxied_from: backendUrl(),
    })
  }

  // The register answered: there is no such mine. That is the answer, not a
  // failure to degrade from.
  if (result.status === 404) {
    return NextResponse.json(
      {
        error: 'Mine not found',
        detail: result.body?.detail ?? result.error,
        note: `The mine register has no mine with id ${idNum}. No telemetry is shown, and no other mine's is shown in its place.`,
        served_by: 'fastapi',
      },
      { status: 404 }
    )
  }

  // Say which of the two it was, as the forecast proxy does: unreachable, or
  // reached and failing.
  return NextResponse.json(
    {
      error: 'Telemetry unavailable',
      detail: result.error,
      note: result.status
        ? `The FastAPI service layer answered ${result.status}. No reading or figure is shown in place of the ones it would have served.`
        : 'The FastAPI service layer could not be reached. No reading or figure is shown in place of the ones it would have served.',
      is_live: false,
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
