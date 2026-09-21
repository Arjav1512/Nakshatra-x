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
  | { ok: false; error: string }

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
      const body = await res.text().catch(() => '')
      return { ok: false, error: `backend responded ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'backend unreachable' }
  }
}
