import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Raster tile layers from Planetary Computer, with provenance.
 *
 * The upstream answers 200 even when individual layers fail, each carrying its
 * own `status` and `reason`, so this route passes that through rather than
 * collapsing it. Only an unreachable service layer is a 503 here — and in that
 * case the response says no layers, not an empty list that would read as "there
 * are none".
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('force') === '1'
  const r = await fetchFromBackend(`/api/v1/map/tile-layers${force ? '?force=true' : ''}`, {
    timeoutMs: 30000,
  })
  if (r.ok) {
    return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  }
  return NextResponse.json(
    {
      error: 'Tile layers unavailable',
      detail: r.error,
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. The map keeps its base layer and the imagery layers stay off.`
        : 'The FastAPI service layer could not be reached. The map keeps its base layer and the imagery layers stay off.',
      layers: [],
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
