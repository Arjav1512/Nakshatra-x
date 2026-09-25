import { type NextRequest, NextResponse } from 'next/server'
import { MineNumericIdParamSchema } from '@/lib/security'
import { backendUrl, fetchFromBackend, warmingPassthrough } from '@/lib/backend'

/**
 * Track B forecast proxy (PRD B-5, B-6) — per-mine, per-grade, with prediction
 * intervals and P(cumulative production < plan target).
 *
 * Thin by design: all computation lives in the FastAPI service layer
 * (architecture L4). There is no local fallback — an unavailable forecaster is
 * reported as unavailable rather than substituted (PRD N-6).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mineId: string }> }
) {
  const p = MineNumericIdParamSchema.safeParse((await params).mineId)
  if (!p.success) return NextResponse.json({ error: 'Invalid Mine ID' }, { status: 400 })

  const url = new URL(request.url)
  const horizon = url.searchParams.get('horizon_days') ?? '14'
  const grade = url.searchParams.get('grade')
  const qs = `horizon_days=${encodeURIComponent(horizon)}${grade ? `&grade=${encodeURIComponent(grade)}` : ''}`

  const r = await fetchFromBackend(`/api/v1/mines/${p.data}/forecast?${qs}`, {
    timeoutMs: 60000,
  })
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  // A warming backend is answering, not failing. Pass its own answer through
  // so the console can show "computing, about Ns" instead of a red error.
  const warming = r.ok ? null : warmingPassthrough(r)
  if (warming) {
    return NextResponse.json(warming.body, { status: 503, headers: warming.headers })
  }

  return NextResponse.json(
    {
      error: 'Forecast unavailable',
      detail: r.error,
      // Say which of the two it was. "Could not be reached" was printed even
      // when the service answered — a claim about the system that the response
      // in hand contradicted.
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. No forecast is shown, because a number not produced by the model must not be presented as one.`
        : 'The FastAPI service layer could not be reached. No forecast is shown, because a number not produced by the model must not be presented as one.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
