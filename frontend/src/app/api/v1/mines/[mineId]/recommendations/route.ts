import { type NextRequest, NextResponse } from 'next/server'
import { MineIdParamSchema } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

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
  const p = MineIdParamSchema.safeParse((await params).mineId)
  if (!p.success) return NextResponse.json({ error: 'Invalid Mine ID' }, { status: 400 })

  const url = new URL(request.url)
  const horizon = url.searchParams.get('horizon_days') ?? '14'

  const r = await fetchFromBackend(
    `/api/v1/mines/${parseInt(p.data, 10)}/recommendations?horizon_days=${encodeURIComponent(horizon)}`,
    { timeoutMs: 60000 }
  )
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  return NextResponse.json(
    {
      error: 'Recommendations unavailable',
      detail: r.error,
      note: 'No action is proposed, because an action that has not been constraint-checked is worse than none (PRD C-5).',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
