import { type NextRequest, NextResponse } from 'next/server'
import { MineNumericIdParamSchema } from '@/lib/security'
import { backendUrl, fetchFromBackend, warmingPassthrough } from '@/lib/backend'

/**
 * Constraint-gated corrective actions proxy (PRD C-1..C-5).
 *
 * The service layer returns approved actions AND the rejected ones with the
 * rule each violated. Both are surfaced: PRD C-5 requires that the recommender
 * never propose the physically impossible, and showing what was rejected is
 * how a planner sees the constraint engine actually working.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mineId: string }> }
) {
  const p = MineNumericIdParamSchema.safeParse((await params).mineId)
  if (!p.success) return NextResponse.json({ error: 'Invalid Mine ID' }, { status: 400 })

  const url = new URL(request.url)
  const horizon = url.searchParams.get('horizon_days') ?? '14'

  const r = await fetchFromBackend(
    `/api/v1/mines/${p.data}/recommendations?horizon_days=${encodeURIComponent(horizon)}`,
    { timeoutMs: 60000 }
  )
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  // A warming backend is answering, not failing. Pass its own answer through
  // so the console can show "computing, about Ns" instead of a red error.
  const warming = r.ok ? null : warmingPassthrough(r)
  if (warming) {
    return NextResponse.json(warming.body, { status: 503, headers: warming.headers })
  }

  return NextResponse.json(
    {
      error: 'Recommendations unavailable',
      detail: r.error,
      // Say which of the two it was. "Could not be reached" was printed even
      // when the service answered — a claim about the system that the response
      // in hand contradicted.
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. No recommendation is shown, because a number not produced by the model must not be presented as one.`
        : 'The FastAPI service layer could not be reached. No recommendation is shown, because a number not produced by the model must not be presented as one.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
