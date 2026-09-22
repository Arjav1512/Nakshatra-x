import { NextRequest, NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Ranked drill targets proxy (PRD A-5) — each target carries the evidence that
 * drove its ranking, plus kriging uncertainty (A-4).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const topN = url.searchParams.get('top_n') ?? '10'

  const r = await fetchFromBackend(
    `/api/v1/prospectivity/drill-targets?top_n=${encodeURIComponent(topN)}`,
    { timeoutMs: 60000 }
  )
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  return NextResponse.json(
    {
      error: 'Drill targets unavailable',
      detail: r.error,
      note: 'No targets are shown rather than unranked or invented ones.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
