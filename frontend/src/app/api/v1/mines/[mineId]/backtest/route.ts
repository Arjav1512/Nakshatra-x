import { type NextRequest, NextResponse } from 'next/server'
import { MineNumericIdParamSchema } from '@/lib/security'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Rolling-origin backtest proxy (PRD B-10, N-8).
 *
 * N-8 requires forecast accuracy from a held-out backtest to be *visible in the
 * UI*. A full run refits the model at every origin and takes minutes, so the
 * service layer caches it per process; this proxy allows a generous timeout.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mineId: string }> }
) {
  const p = MineNumericIdParamSchema.safeParse((await params).mineId)
  if (!p.success) return NextResponse.json({ error: 'Invalid Mine ID' }, { status: 400 })

  const url = new URL(request.url)
  const span = url.searchParams.get('span_days') ?? '150'
  const step = url.searchParams.get('step_days') ?? '14'

  const r = await fetchFromBackend(
    `/api/v1/mines/${p.data}/backtest?span_days=${encodeURIComponent(span)}&step_days=${encodeURIComponent(step)}`,
    { timeoutMs: 600000 }
  )
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  return NextResponse.json(
    {
      error: 'Backtest unavailable',
      detail: r.error,
      note: 'No accuracy figure is shown rather than an unvalidated one.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
