/**
 * Sentinel-2 scene lookup via the Earth Search STAC API (Element 84).
 *
 * This replaces hand-built scene identifier strings such as
 * `S2A_MSIL2A_20260830_${mine.code}_T43QDH`, which looked like real Copernicus
 * product IDs but were fabricated. Every field returned here comes from the
 * STAC response. If the query fails, the scene list is empty and `status`
 * explains why — identifiers are never invented to fill the gap.
 *
 * Guardrail: these are surface reflectance scenes. They carry no subsurface
 * information and must not be presented as evidence of ore at depth.
 */

const EARTH_SEARCH = 'https://earth-search.aws.element84.com/v1/search'

export interface STACScene {
  scene_id: string
  satellite: string
  acquisition_date: string
  cloud_cover_pct: number | null
  data_quality: string
  /** Real STAC asset/collection metadata, not derived band values. */
  collection: string
  stac_url: string | null
}

export interface STACResult {
  scenes: STACScene[]
  status: {
    queried: boolean
    ok: boolean
    source: string
    error: string | null
    /** ISO timestamp of the query itself. */
    queried_at: string
  }
  source: string
}

function emptyResult(error: string | null, queried: boolean): STACResult {
  const source = error
    ? 'Earth Search STAC (query failed — no scenes shown)'
    : 'Earth Search STAC (sentinel-2-l2a)'
  return {
    scenes: [],
    status: { queried, ok: false, source, error, queried_at: new Date().toISOString() },
    source,
  }
}

/**
 * Find recent Sentinel-2 L2A scenes covering a point.
 *
 * @param lat  Latitude of the point of interest.
 * @param lng  Longitude of the point of interest.
 * @param limit Maximum number of scenes to return.
 */
export async function fetchSentinel2Scenes(
  lat: number,
  lng: number,
  limit = 3
): Promise<STACResult> {
  const now = new Date()
  const from = new Date(now.getTime() - 45 * 24 * 3600 * 1000)
  const pad = 0.05 // ~5 km box around the mine

  const body = {
    collections: ['sentinel-2-l2a'],
    bbox: [lng - pad, lat - pad, lng + pad, lat + pad],
    datetime: `${from.toISOString()}/${now.toISOString()}`,
    limit,
    sortby: [{ field: 'properties.datetime', direction: 'desc' }],
  }

  try {
    const res = await fetch(EARTH_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })

    if (!res.ok) return emptyResult(`Earth Search responded ${res.status}`, true)

    const data = await res.json()
    const features: any[] = Array.isArray(data?.features) ? data.features : []

    const scenes: STACScene[] = features.map((f) => {
      const p = f?.properties ?? {}
      const cloud = typeof p['eo:cloud_cover'] === 'number' ? Math.round(p['eo:cloud_cover'] * 10) / 10 : null
      return {
        scene_id: String(f?.id ?? 'unknown'),
        satellite: p?.platform ? String(p.platform).toUpperCase() : 'Sentinel-2',
        acquisition_date: String(p?.datetime ?? ''),
        cloud_cover_pct: cloud,
        data_quality: cloud === null ? 'unknown' : cloud < 10 ? 'high' : cloud < 35 ? 'moderate' : 'low',
        collection: String(f?.collection ?? 'sentinel-2-l2a'),
        stac_url:
          (f?.links ?? []).find((l: any) => l?.rel === 'self')?.href ?? null,
      }
    })

    const source = 'Earth Search STAC (sentinel-2-l2a), live query'
    return {
      scenes,
      status: { queried: true, ok: true, source, error: null, queried_at: new Date().toISOString() },
      source,
    }
  } catch (err: any) {
    return emptyResult(err?.message || 'Earth Search unreachable', true)
  }
}
