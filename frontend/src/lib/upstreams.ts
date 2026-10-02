/**
 * Every external base URL this app talks to, in one place, overridable by env.
 *
 * WHY
 * ---
 * The provenance guard's offline mode proves that nothing is invented in the
 * browser when there is no data. Puppeteer can abort the browser's own
 * requests, but it cannot touch a fetch that a Next route handler makes from
 * Node — so `/blending` still resolved real weather with the service layer
 * stopped, and the run could not answer the question it was asked.
 *
 * Pointing these at an unreachable address makes "no data reachable" true for
 * the server as well as the browser:
 *
 *   NAKSHATRA_OFFLINE=1 npm run dev     # every upstream -> http://127.0.0.1:9
 *
 * Port 9 is discard: it refuses immediately rather than hanging, so a degraded
 * path is exercised at speed instead of timing out.
 */

const OFFLINE_SINK = 'http://127.0.0.1:9'

function upstream(envVar: string, fallback: string): string {
  if (process.env.NAKSHATRA_OFFLINE === '1') return OFFLINE_SINK
  return (process.env[envVar] || fallback).replace(/\/+$/, '')
}

export const UPSTREAMS = {
  /** Open-Meteo forecast API — measured weather for a coordinate. */
  get openMeteo() {
    return upstream('NAKSHATRA_OPEN_METEO_URL', 'https://api.open-meteo.com')
  },
  /** Element 84 Earth Search — Sentinel-2 L2A scene metadata. */
  get stac() {
    return upstream('NAKSHATRA_STAC_URL', 'https://earth-search.aws.element84.com')
  },
  /** Photon geocoder. */
  get photon() {
    return upstream('NAKSHATRA_PHOTON_URL', 'https://photon.komoot.io')
  },
  /** Nominatim geocoder. */
  get nominatim() {
    return upstream('NAKSHATRA_NOMINATIM_URL', 'https://nominatim.openstreetmap.org')
  },
  /** ESRI World Imagery basemap tiles. */
  get esriTiles() {
    return upstream('NAKSHATRA_ESRI_TILES_URL', 'https://server.arcgisonline.com')
  },
}

/** True when the app has been started with every upstream pointed at the sink. */
export const IS_OFFLINE = process.env.NAKSHATRA_OFFLINE === '1'

/**
 * The ESRI World Imagery basemap's required attribution.
 *
 * Quoted from the service's own `copyrightText`, not written from memory:
 *   https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=json
 * retrieved 2026-10-02. It names Vantor where older copies of this notice say
 * Maxar, which is exactly why it is read from the service and not recalled.
 *
 * The map previously set `attribution: 'Esri Satellite'` and then disabled the
 * attribution control, so the basemap carried an invented credit that was never
 * shown. It is now shown, and it is the licensor's.
 */
export const ESRI_WORLD_IMAGERY_ATTRIBUTION =
  'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community'
