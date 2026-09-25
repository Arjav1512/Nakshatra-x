/**
 * FastAPI service-layer client.
 *
 * One place that knows where the backend lives, so route handlers stay thin.
 * The URL comes from the environment; there is no hardcoded production host.
 */

const DEFAULT_BACKEND = 'http://127.0.0.1:8000'

export function backendUrl(): string {
  return (process.env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, '')
}

export type BackendResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; body?: any }

/**
 * Call the FastAPI service layer.
 *
 * Never throws — a failure is returned as `{ok: false, error}` so callers are
 * forced to decide how to degrade (PRD N-6) rather than surfacing a 500.
 */
export async function fetchFromBackend<T = any>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<BackendResult<T>> {
  const { timeoutMs = 10000, ...rest } = init
  const url = `${backendUrl()}${path}`
  try {
    const res = await fetch(url, {
      ...rest,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      // Keep the status and the parsed body.
      //
      // This used to flatten every non-2xx into one string, which threw away
      // the one payload that matters: the backend's 503 {status:"warming",
      // eta_seconds}. Callers could then only say "unavailable", so a backend
      // that was answering correctly — "this mine is computing, come back in
      // 26 s" — was shown to the user as a service that could not be reached.
      const text = await res.text().catch(() => '')
      let body: any = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = null
      }
      return {
        ok: false,
        status: res.status,
        body,
        error: `backend responded ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'backend unreachable' }
  }
}


/**
 * A backend "still computing" answer, if that is what this failure was.
 *
 * The forecast warmer answers 503 with {status:"warming", mine_code,
 * eta_seconds, queued_ahead}. That is not an error and must not be relabelled
 * as one on the way through the proxy: a client that is told "unavailable"
 * stops, and a client that is told "warming, 26 s" waits. Returns null for any
 * other failure.
 */
export function warmingPassthrough(r: { ok: false; error: string; status?: number; body?: any }) {
  if (r.status !== 503 || r.body?.status !== 'warming') return null
  return {
    body: { ...r.body, served_by: 'fastapi' },
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(Number(r.body.eta_seconds) || 30))) },
  }
}
