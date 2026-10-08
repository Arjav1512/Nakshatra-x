import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Calibration figures for the console: the daily intervals' coverage, which
 * the console shows beside the forecast, and the 14-day total's, which it no
 * longer shows (P(shortfall) is withdrawn, DECISIONS.md D-044).
 *
 * Read from the service's committed calibration artifact, which carries the
 * identity of the model it measured. Nothing here is a default: with the
 * service down the console says the calibration is unavailable rather than
 * printing a remembered figure.
 */
export async function GET(request: Request) {
  const mine = new URL(request.url).searchParams.get('mine_code')
  const qs = mine && /^[A-Z0-9-]{1,20}$/.test(mine) ? `?mine_code=${mine}` : ''
  const r = await fetchFromBackend(`/api/v1/calibration/cumulative${qs}`)
  if (r.ok) return NextResponse.json({ ...r.data, served_by: 'fastapi', proxied_from: backendUrl() })
  return NextResponse.json(
    {
      status: 'unavailable',
      error: 'Calibration unavailable',
      detail: r.error,
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
