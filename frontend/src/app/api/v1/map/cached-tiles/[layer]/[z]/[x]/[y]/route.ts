import { backendUrl } from '@/lib/backend'

/**
 * One tile from the local tile cache, proxied from the service layer.
 *
 * The map falls back to these when Planetary Computer's tiler fails. Without
 * this route the fallback could not work at all: the browser asks the Next app
 * for `/api/v1/map/cached-tiles/...`, and only FastAPI holds the cache. Every
 * cached tile would have 404'd here and the layer would have gone blank exactly
 * when it was meant to survive.
 *
 * Binary passthrough rather than `fetchFromBackend`, which parses JSON. A tile
 * the cache does not hold is a 404 with the backend's reason, never a
 * placeholder image.
 */
const SAFE = /^[a-z0-9-]{1,40}$/
const INT = /^\d{1,6}$/

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const { layer, z, x, y } = await params
  // The path is interpolated into an upstream URL, so it is validated first.
  if (!SAFE.test(layer) || !INT.test(z) || !INT.test(x) || !INT.test(y)) {
    return Response.json({ error: 'invalid tile path' }, { status: 400 })
  }
  try {
    const r = await fetch(`${backendUrl()}/api/v1/map/cached-tiles/${layer}/${z}/${x}/${y}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return new Response(detail || `no cached tile (${r.status})`, {
        status: r.status,
        headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'text/plain' },
      })
    }
    return new Response(r.body, {
      status: 200,
      headers: {
        'Content-Type': r.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        // Carried through so a test, or a curious reader in devtools, can see
        // that this pixel came from the local cache and not the live tiler.
        'X-Tile-Source': 'local-cache',
      },
    })
  } catch {
    return Response.json(
      {
        error: 'tile cache unavailable',
        note: 'The service layer that holds the cache could not be reached. No tile is substituted.',
      },
      { status: 503 }
    )
  }
}
