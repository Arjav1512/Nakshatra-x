import { type NextRequest, NextResponse } from 'next/server'
import { backendUrl, fetchFromBackend } from '@/lib/backend'

/**
 * Constraint-check proxy for the what-if calculator (PRD C-1..C-5).
 *
 * The engine lives in the service layer and is the only thing entitled to say
 * whether a set of controls can legally be run — constraints are enforced,
 * never learned, and never re-implemented here.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const r = await fetchFromBackend('/api/v1/scenario/constraint-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 15000,
  })
  if (r.ok) return NextResponse.json(r.data)

  return NextResponse.json(
    {
      error: 'Constraint check unavailable',
      detail: r.error,
      note: r.status
        ? `The FastAPI service layer answered ${r.status}. No verdict is shown, because a verdict this route invented would not be the engine's.`
        : 'The FastAPI service layer could not be reached. No verdict is shown.',
      served_by: 'nextjs-degraded',
      proxied_from: backendUrl(),
    },
    { status: 503 }
  )
}
