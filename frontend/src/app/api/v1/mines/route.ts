import { NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Mine register proxy (DEF-1).
 *
 * This route previously returned its own hardcoded register with slug primary
 * keys (`id: 'balaghat'`), shadowing the FastAPI endpoint of the same path,
 * which keys mines by integer. The console read this register and then built
 * `/api/v1/mines/balaghat/forecast`, which the backend cannot resolve — so
 * every forecast, backtest and recommendation request failed, and telemetry
 * silently fell back to mine 1 and returned Balaghat's record for every mine.
 *
 * There is now one register and one ID scheme: FastAPI's. `MineRow` in
 * console-api.ts already declared exactly this shape — the mismatch went
 * unnoticed because the client casts `res.json()` rather than parsing it.
 *
 * Thin by design, matching the other mine routes: no local register, and an
 * unavailable backend is reported as unavailable rather than substituted
 * (PRD N-6).
 */
export async function GET() {
  const r = await fetchFromBackend('/api/v1/mines')

  if (r.ok) {
    return NextResponse.json(r.data, {
      headers: { 'x-served-by': 'fastapi', 'x-proxied-from': backendUrl() },
    })
  }

  return NextResponse.json(
    {
      error: 'Mine register unavailable',
      detail: r.error,
      note: 'The FastAPI service layer could not be reached. No register is shown, because a mine list assembled in the browser would not be the one the models were fitted against.',
      served_by: 'nextjs-degraded',
    },
    { status: 503 }
  )
}
