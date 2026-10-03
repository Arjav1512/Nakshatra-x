/**
 * Raster tile layers that survive the network, and say so when they have to.
 *
 * LIVE FIRST, CACHE SECOND, NEVER UNLABELLED
 * ------------------------------------------
 * Each tile is fetched from Planetary Computer's tiler. If that fails or times
 * out, the same tile is read from the local cache built by
 * `python -m app.api.batch tiles`. The layer's label tracks what is actually on
 * screen: "live", "cached · fetched <date>", or "partly cached · fetched <date>"
 * when a pan has mixed the two. A cached pixel presented as a live one would be
 * the same class of claim this project has spent several phases removing.
 *
 * WHY fetch() AND NOT <img src>
 * -----------------------------
 * A failed <img> tells the page nothing about why. But the tiler sends
 * `Access-Control-Allow-Origin: *` on its 200s AND its 404s (checked, not
 * assumed), so fetch() can read the status — and the status decides the remedy:
 *
 *   404               the mosaic registration was evicted. Planetary Computer's
 *                     registrations live in a cache that tracks `lastused`, and
 *                     an evicted id answers 404 rather than a blank tile. So:
 *                     re-register (idempotent — the id is a hash of the search)
 *                     and retry once.
 *   anything else     network down, timeout, 5xx. Re-registering cannot help,
 *                     so go to the cache. After three in a row the layer stops
 *                     asking the live tiler for a minute, so an offline map does
 *                     not wait out a timeout on every tile.
 */
import type * as Leaflet from 'leaflet'

export type LegendFact = { label: string; value: string }

export type Attribution = {
  required: string
  licensor: string
  licence_name: string
  licence_url: string
  source_of_wording: string
  tiler: string
  html: string
}

export type CacheInfo = {
  available: boolean
  fetched_at?: string
  n_tiles?: number
  zoom_min?: number
  zoom_max?: number
  bytes?: number
  reason?: string
}

export type TileLayerDef = {
  id: string
  name: string
  status: 'ok' | 'unavailable'
  tile_url: string | null
  tilejson_url?: string
  reason?: string
  legend: string
  legend_facts: LegendFact[]
  scale: { rescale: [number, number]; colormap: string; low_label: string; high_label: string } | null
  caveat: string
  attribution: Attribution
  cache: CacheInfo
  provenance: Record<string, unknown>
}

export type TileLayersResponse = {
  layers: TileLayerDef[]
  n_ok?: number
  n_unavailable?: number
  error?: string
  note?: string
}

/** What is on screen right now, which is what the label has to describe. */
export type TileSourceMode = 'loading' | 'live' | 'cache' | 'mixed' | 'unavailable'

export type TileSourceState = {
  mode: TileSourceMode
  liveTiles: number
  cacheTiles: number
  failedTiles: number
  reregistrations: number
  lastError: string | null
  /** Oldest cached tile's fetch time, from the cache manifest. */
  cacheFetchedAt: string | null
}

const LIVE_TIMEOUT_MS = 8000
const BREAKER_THRESHOLD = 3
const BREAKER_COOLDOWN_MS = 60_000

/**
 * One in-flight re-register for the whole page.
 *
 * When a mosaic is evicted every visible tile 404s at once. Without this, a
 * single eviction would send dozens of re-register requests; the backend
 * throttles too, but the first defence belongs here.
 */
let reregisterInFlight: Promise<TileLayersResponse | null> | null = null

export function reregisterTileLayers(): Promise<TileLayersResponse | null> {
  if (!reregisterInFlight) {
    reregisterInFlight = fetch('/api/v1/map/tile-layers?force=1', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<TileLayersResponse>) : null))
      .catch(() => null)
      .finally(() => {
        // Released after a short delay, so the burst that caused it is covered.
        setTimeout(() => {
          reregisterInFlight = null
        }, 5000)
      })
  }
  return reregisterInFlight
}

export function cachedTileUrl(layerId: string, z: number, x: number, y: number): string {
  return `/api/v1/map/cached-tiles/${encodeURIComponent(layerId)}/${z}/${x}/${y}`
}

/** "2026-10-01" from an ISO timestamp — the date the cached label shows. */
export function fetchDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m ? m[1] : null
}

/**
 * The words the attribution control and the legend show for this state.
 *
 * The licensor's notice is present in every state, live or cached — a local
 * copy does not change what the licence asks for.
 */
export function sourceLabel(state: TileSourceState): string {
  const date = fetchDate(state.cacheFetchedAt)
  switch (state.mode) {
    case 'live':
      return 'live'
    case 'cache':
      return date ? `cached · fetched ${date}` : 'cached'
    case 'mixed':
      return date ? `partly cached · fetched ${date}` : 'partly cached'
    case 'unavailable':
      return 'unavailable'
    default:
      return 'loading'
  }
}

export function attributionHtml(def: TileLayerDef, state: TileSourceState): string {
  const label = sourceLabel(state)
  const tag = state.mode === 'loading' ? '' : ` · <span data-tile-source="${state.mode}">${label}</span>`
  return `<span data-attribution-layer="${def.id}">${escapeHtml(def.attribution.required)} | ${escapeHtml(
    def.attribution.tiler
  )}${tag}</span>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type Outcome = { source: 'live' | 'cache' } | { source: 'failed'; error: string }

/** The layer's bbox as Leaflet bounds. [minLng, minLat, maxLng, maxLat] in. */
function studyBounds(L: typeof Leaflet, def: TileLayerDef): Leaflet.LatLngBounds {
  const b = def.provenance?.bbox as number[] | undefined
  const [minLng, minLat, maxLng, maxLat] =
    Array.isArray(b) && b.length === 4 ? b : [78.6, 20.6, 80.8, 22.5]
  return L.latLngBounds([minLat, minLng], [maxLat, maxLng])
}

/**
 * Build a Leaflet layer for one definition.
 *
 * `onState` fires whenever what is on screen changes, so the legend and the
 * attribution control stay true to the pixels.
 */
export function createResilientTileLayer(
  L: typeof Leaflet,
  def: TileLayerDef,
  onState: (state: TileSourceState) => void
): Leaflet.GridLayer {
  // Per-tile source, keyed by z/x/y, for the tiles currently on screen. A
  // running total would keep saying "mixed" long after a pan had left the cached
  // tiles behind.
  const onScreen = new Map<string, 'live' | 'cache' | 'failed'>()
  let liveUrl = def.tile_url
  let consecutiveLiveFailures = 0
  let liveDownUntil = 0
  let reregistrations = 0
  let lastError: string | null = def.status === 'ok' ? null : (def.reason ?? 'unavailable')
  const liveAvailable = def.status === 'ok' && !!def.tile_url
  const cacheAvailable = !!def.cache?.available

  const emit = () => {
    let live = 0
    let cache = 0
    let failed = 0
    for (const v of onScreen.values()) {
      if (v === 'live') live++
      else if (v === 'cache') cache++
      else failed++
    }
    let mode: TileSourceMode = 'loading'
    if (live && cache) mode = 'mixed'
    else if (cache) mode = 'cache'
    else if (live) mode = 'live'
    else if (failed) mode = 'unavailable'
    onState({
      mode,
      liveTiles: live,
      cacheTiles: cache,
      failedTiles: failed,
      reregistrations,
      lastError,
      cacheFetchedAt: def.cache?.fetched_at ?? null,
    })
  }

  const fill = (url: string, z: number, x: number, y: number) =>
    url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))

  const fetchLive = async (url: string): Promise<{ ok: true; blob: Blob } | { ok: false; status: number | null; error: string }> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS)
    try {
      const r = await fetch(url, { signal: ctrl.signal, mode: 'cors' })
      if (r.ok) return { ok: true, blob: await r.blob() }
      return { ok: false, status: r.status, error: `HTTP ${r.status} from the live tiler` }
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError'
      return {
        ok: false,
        status: null,
        error: aborted ? `live tile timed out after ${LIVE_TIMEOUT_MS / 1000} s` : 'live tiler unreachable',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const loadImg = (img: HTMLImageElement, src: string) =>
    new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = src
    })

  const resolveTile = async (img: HTMLImageElement, z: number, x: number, y: number): Promise<Outcome> => {
    const tryCache = async (why: string): Promise<Outcome> => {
      lastError = why
      if (!cacheAvailable) return { source: 'failed', error: `${why}; no local cache for this layer` }
      const ok = await loadImg(img, cachedTileUrl(def.id, z, x, y))
      return ok ? { source: 'cache' } : { source: 'failed', error: `${why}; tile not in the local cache` }
    }

    if (!liveAvailable || !liveUrl) {
      return tryCache(`live layer unavailable: ${def.reason ?? 'no tile URL'}`)
    }
    if (Date.now() < liveDownUntil) {
      return tryCache(lastError ?? 'live tiler failing; using the cache for a minute')
    }

    let res = await fetchLive(fill(liveUrl, z, x, y))

    if (!res.ok && res.status === 404) {
      // Evicted registration. Re-register once, then retry with whatever URL
      // comes back — the same one, usually, because the id is a hash.
      const fresh = await reregisterTileLayers()
      const again = fresh?.layers.find((l) => l.id === def.id)
      if (again?.status === 'ok' && again.tile_url) {
        reregistrations++
        liveUrl = again.tile_url
        res = await fetchLive(fill(liveUrl, z, x, y))
      }
    }

    if (res.ok) {
      consecutiveLiveFailures = 0
      const objectUrl = URL.createObjectURL(res.blob)
      const ok = await loadImg(img, objectUrl)
      // Decoded once loaded, so the blob can go.
      URL.revokeObjectURL(objectUrl)
      if (ok) return { source: 'live' }
      return tryCache('live tile could not be decoded')
    }

    consecutiveLiveFailures++
    if (consecutiveLiveFailures >= BREAKER_THRESHOLD) {
      liveDownUntil = Date.now() + BREAKER_COOLDOWN_MS
    }
    return tryCache(res.error)
  }

  const Resilient = L.GridLayer.extend({
    createTile(coords: Leaflet.Coords, done: Leaflet.DoneCallback) {
      const img = document.createElement('img')
      img.alt = ''
      img.setAttribute('role', 'presentation')
      img.dataset.tileLayer = def.id
      const key = `${coords.z}/${coords.x}/${coords.y}`
      resolveTile(img, coords.z, coords.x, coords.y).then((out) => {
        onScreen.set(key, out.source)
        img.dataset.tileSource = out.source
        emit()
        if (out.source === 'failed') done(new Error(out.error), img)
        else done(undefined, img)
      })
      return img
    },
  })

  // `extend` returns a constructor TypeScript types as taking no options.
  const Ctor = Resilient as unknown as new (o: Leaflet.GridLayerOptions) => Leaflet.GridLayer
  const layer = new Ctor({
    minZoom: 5,
    maxZoom: 18,
    maxNativeZoom: 14,
    tileSize: 256,
    opacity: 0.85,
    // Bounds limit requests to the study area, so a zoomed-out view does not
    // fire hundreds of requests for tiles that are empty by construction.
    bounds: studyBounds(L, def),
  })

  layer.on('tileunload', (e: Leaflet.TileEvent) => {
    onScreen.delete(`${e.coords.z}/${e.coords.x}/${e.coords.y}`)
    emit()
  })

  emit()
  return layer
}
