import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * The training observations behind the prospectivity surface.
 *
 * The surface is kriged model output; these are its inputs. The map draws both
 * and the legend tells them apart, because "the model scores this area high"
 * and "a measurement was taken here" are different claims and the map used to
 * make only the first while looking like the second.
 */
export async function GET() {
  const r = await fetchFromBackend('/api/v1/prospectivity/measured', { timeoutMs: 30000 })
  if (r.ok) {
    return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  }
  return NextResponse.json(
    {
      error: 'Measured points unavailable',
      detail: r.error,
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. No points are drawn; invented points would be indistinguishable from real ones on a map.`
        : 'The FastAPI service layer could not be reached. No points are drawn.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
