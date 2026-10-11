'use client'

import { useEffect, useRef, useState } from 'react'
import type { MineInfo } from './types'
import { MOIL_MINES } from './data'
import { cividis } from '@/lib/colormap'
import { type MineRow, fetchMines, predictPoint } from '@/lib/console-api'
import { PointScore } from '@/components/console/PointScore'
import { ESRI_WORLD_IMAGERY_ATTRIBUTION, UPSTREAMS } from '@/lib/upstreams'
import {
  type TileLayerDef,
  type TileLayersResponse,
  type TileSourceState,
  attributionHtml,
  createResilientTileLayer,
} from '@/lib/map-tile-layers'
import MapLayerLegend, { CIVIDIS_STOPS, type LegendModel } from './MapLayerLegend'
import {
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Sparkles,
  Compass,
  Navigation,
  Search,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'

/**
 * The six layers this map has, each backed by a service that says where it
 * came from.
 *
 * It once declared eight, and six of those ('ndvi', 'moisture', 'thermal',
 * 'isro-bhuvan', 'isro-risat', 'isro-cartosat') read no data and drew a
 * sin()/cos() grid captioned as ISRO Resourcesat, EOS-04 and Cartosat
 * measurements. They are gone; see the comment at the removal site. Then it
 * declared two. These six replace them:
 *
 *   probability     the kriged prospectivity score       derived
 *   uncertainty     its kriging standard deviation        derived
 *   measured        the 50 points the model was fitted on measured
 *   s2-true-colour  Sentinel-2 L2A mosaic                 measured, tiles
 *   iron-oxide      Sentinel-2 B04/B02 ratio              measured, tiles
 *   dem             Copernicus DEM GLO-30                 measured, tiles
 *
 * The ESRI basemap sits under all of them and is not a selectable layer.
 */
export type LayerType =
  | 'probability'
  | 'uncertainty'
  | 'measured'
  | 's2-true-colour'
  | 'iron-oxide'
  | 'dem'

export const DEFAULT_LAYER: LayerType = 'probability'

const TILE_LAYER_IDS = new Set<LayerType>(['s2-true-colour', 'iron-oxide', 'dem'])

interface Props {
  selectedMine: MineInfo
  onSelectMine: (mine: MineInfo) => void
  activeLayer: LayerType
  onChangeLayer: (layer: LayerType) => void
}

// 40+ Preset Indian Mining Belt Locations & Major Cities
const INDIAN_MINING_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  nagpur: { lat: 21.1458, lng: 79.0882, name: 'Nagpur District (Western Mn Belt, MH)' },
  bhandara: { lat: 21.17, lng: 79.65, name: 'Bhandara Gondite Horizon (MH)' },
  balaghat: { lat: 21.83, lng: 80.19, name: 'Balaghat Pyrolusite Syncline (MP)' },
  bharweli: { lat: 21.86, lng: 80.26, name: 'Bharweli Orebody (MP)' },
  ukwa: { lat: 21.93, lng: 80.52, name: 'Ukwa Siliceous Reef (MP)' },
  tirodi: { lat: 22.16, lng: 79.68, name: 'Tirodi Gondite Facies (MP)' },
  dongri: { lat: 20.99, lng: 79.34, name: 'Dongri Buzurg Ore Belt (MH)' },
  sausar: { lat: 21.65, lng: 78.78, name: 'Sausar Group Metamorphic Series (MP/MH)' },
  chhindwara: { lat: 22.0574, lng: 78.9382, name: 'Chhindwara Manganese Extension (MP)' },
  jabalpur: { lat: 23.1815, lng: 79.9864, name: 'Jabalpur Iron-Manganese Belt (MP)' },
  gondia: { lat: 21.4598, lng: 80.1961, name: 'Gondia Sub-Surface Sector (MH)' },
  bhopal: { lat: 23.2599, lng: 77.4126, name: 'Bhopal Region (Central MP Plateau)' },
  indore: { lat: 22.7196, lng: 75.8577, name: 'Indore Malwa Sector (MP)' },
  keonjhar: { lat: 21.6289, lng: 85.5817, name: 'Keonjhar Iron-Manganese Belt (Odisha)' },
  sundargarh: { lat: 22.12, lng: 84.03, name: 'Sundargarh Ore Horizon (Odisha)' },
  rourkela: { lat: 22.2604, lng: 84.8536, name: 'Rourkela Mineral Corridor (Odisha)' },
  singhbhum: { lat: 22.56, lng: 85.78, name: 'Singhbhum Copper-Manganese Shear Belt (Jharkhand)' },
  bellary: { lat: 15.1394, lng: 76.9214, name: 'Bellary Iron-Manganese Basin (Karnataka)' },
  sandur: { lat: 15.0833, lng: 76.55, name: 'Sandur Schist Belt (Karnataka)' },
  panchmahal: { lat: 22.77, lng: 73.61, name: 'Panchmahal Manganese Belt (Gujarat)' },
  raipur: { lat: 21.2514, lng: 81.6296, name: 'Raipur Basin (Chhattisgarh)' },
  korba: { lat: 22.3595, lng: 82.7501, name: 'Korba Energy-Mineral Belt (Chhattisgarh)' },
  singrauli: { lat: 24.1994, lng: 82.6657, name: 'Singrauli Basin (MP/UP Border)' },
  vizag: { lat: 17.6868, lng: 83.2185, name: 'Visakhapatnam Coastal Mn Belt (AP)' },
  srikakulam: { lat: 18.2969, lng: 83.8968, name: 'Srikakulam Manganese Belt (AP)' },
  shimoga: { lat: 13.9299, lng: 75.5681, name: 'Shimoga Schist Belt (Karnataka)' },
  goa: { lat: 15.2993, lng: 74.124, name: 'Iron-Manganese Ore Belt (Goa)' },
  panaji: { lat: 15.4989, lng: 73.8278, name: 'North Goa Mineralized Sector' },
  jaipur: { lat: 26.9124, lng: 75.7873, name: 'Jaipur Aravalli Belt (Rajasthan)' },
  udaipur: { lat: 24.5854, lng: 73.7125, name: 'Udaipur Aravalli Mineral Corridor (Rajasthan)' },
  bhilwara: { lat: 25.3407, lng: 74.6313, name: 'Bhilwara Lead-Zinc-Mn Belt (Rajasthan)' },
  kolkata: { lat: 22.5726, lng: 88.3639, name: 'Kolkata HQ Command Sector (WB)' },
  mumbai: { lat: 19.076, lng: 72.8777, name: 'Western Command Operations (MH)' },
  delhi: { lat: 28.6139, lng: 77.209, name: 'Ministry of Steel HQ (New Delhi)' },
}

/**
 * Map marker metadata, derived from the register the backend serves.
 *
 * This was a literal array of ten mines with their plan targets, which made it
 * a **second mine register**. D-028 settled that question after DEF-1: one
 * register, FastAPI's. A committed copy here can only ever drift from it, and
 * the offline run of the provenance guard is what surfaced it — with the
 * backend stopped, all ten plan targets were still on screen, which is only
 * possible if the client is carrying its own.
 *
 * An earlier pass had already removed `grade: '46.2% Mn'` from each entry: an
 * ore grade asserted for a real MOIL mine, which Track A cannot produce (PRD
 * §2.4). The plan targets survived that pass because they were *correct* —
 * correct, duplicated, and unattributable.
 *
 * `priority` is an ordering by plan target, not an operational assessment, and
 * the popup says so.
 */
export interface HotspotMeta {
  id: string
  name: string
  rate: string
  priority: string
  color: string
  ringColor: string
  lat: number
  lng: number
  state: string
}

const STATE_ABBREV: Record<string, string> = {
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
}

function hotspotsFromRegister(mines: MineRow[]): HotspotMeta[] {
  return mines.map((m) => {
    const critical = m.target_tonnes >= 14000
    const high = m.target_tonnes >= 10000
    return {
      id: m.name.toLowerCase().replace(/\s+/g, '-'),
      name: m.name,
      rate: `${m.target_tonnes.toLocaleString()} T/m`,
      priority: critical ? 'CRITICAL' : high ? 'HIGH' : 'MEDIUM',
      color: critical ? 'var(--color-status-critical)' : 'var(--color-status-caution)',
      ringColor: 'var(--color-border-interactive)',
      lat: m.latitude,
      lng: m.longitude,
      state: STATE_ABBREV[m.state] ?? m.state,
    }
  })
}

// REMOVED: three hand-drawn "priority hotspot areas".
//
// Each carried four fields, none of which was ever rendered:
//
//   name:          'CRITICAL HOTSPOT AREA (BALAGHAT-BHARWELI SYNCLINE)'
//   priorityLabel: 'CRITICAL PRIORITY'
//   rateSummary:   '32,500 T/m Combined High-Grade Output'
//   probability:   '92.4% Reserve Probability'
//
// A **reserve probability** is the one output PRD §2.4 forbids by name: Track A
// produces a surface prospectivity score, explicitly not a reserve. Nothing in
// this system computes 92.4%, 86.8% or 78.2%, and nothing computes a combined
// output figure either.
//
// They were dead fields, which is why no sweep of the rendered page ever found
// them — there was nothing on screen to find. The JSX-literal lint rule reads
// the source instead, and that is what surfaced them.
//
// The polygons themselves are gone too. They were hand-drawn outlines filled
// with the status-critical and status-caution colours, so the map asserted a
// three-tier priority ranking over the belt with no model behind it. The honest
// version of that claim is already on the same map: the prospectivity surface,
// scored per cell by the loaded model, with its kriging spread in every popup.

// Real Thin State Boundaries
const THIN_STATE_BOUNDARIES = [
  [
    [26.8, 77.9], [25.4, 79.5], [24.8, 81.8], [23.9, 82.8], [21.8, 80.5],
    [21.3, 76.5], [21.6, 74.8], [22.8, 74.0], [24.5, 75.2], [26.8, 77.9]
  ],
  [
    [21.8, 74.8], [21.3, 76.5], [21.8, 80.5], [19.0, 80.3], [18.2, 77.5],
    [15.8, 73.8], [18.9, 72.8], [20.2, 72.7], [21.5, 73.5], [21.8, 74.8]
  ],
  [
    [23.9, 82.8], [23.0, 84.2], [21.5, 83.5], [19.0, 81.5], [17.8, 81.2],
    [19.0, 80.3], [21.8, 80.5], [23.9, 82.8]
  ],
  [
    [22.5, 86.5], [21.5, 87.2], [19.2, 85.0], [18.2, 83.8], [19.0, 81.5],
    [21.5, 83.5], [23.0, 84.2], [22.5, 86.5]
  ],
  [
    [24.5, 71.0], [24.5, 74.0], [21.8, 74.8], [20.2, 72.7], [20.8, 70.0],
    [22.5, 69.0], [24.0, 68.8], [24.5, 71.0]
  ],
  [
    [29.8, 77.5], [28.2, 80.0], [27.0, 84.2], [25.0, 83.0], [24.8, 81.8],
    [25.4, 79.5], [26.8, 77.9], [28.5, 77.3], [29.8, 77.5]
  ],
]

/**
 * Resolve a design token to a concrete colour before handing it to Leaflet.
 *
 * `stroke="var(--color-accent)"` happens to work today because Leaflet is using
 * its SVG renderer, and SVG presentation attributes resolve custom properties.
 * Its canvas renderer never does — `ctx.strokeStyle = 'var(--color-accent)'` is
 * silently ignored and the shape draws black on black. Anyone enabling
 * `preferCanvas` (a normal thing to do for a few thousand cells) would make
 * every overlay vanish with no error.
 *
 * So the value is resolved here rather than relied upon downstream. Falls back
 * to the raw string during SSR, where there is no computed style to read.
 */
function resolveToken(value: string): string {
  if (typeof window === 'undefined') return value
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim())
  if (!m) return value
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
  return resolved || value
}

export default function IndiaSatelliteMap({
  selectedMine,
  onSelectMine,
  activeLayer,
  onChangeLayer,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  /**
   * What the drawn surface actually is.
   *
   * The legend used to describe the layer in fixed copy while the layer itself
   * came from a file nobody checked. It now reports the model version and cell
   * count the service returned, or the reason nothing is drawn.
   */
  /**
   * The register, fetched. Empty until it arrives, and empty if it cannot be
   * fetched — the map draws no mine it cannot name from the service layer.
   */
  const [hotspots, setHotspots] = useState<HotspotMeta[]>([])
  const [registerError, setRegisterError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchMines().then((r) => {
      if (!alive) return
      if (r.ok) { setHotspots(hotspotsFromRegister(r.data)); setRegisterError(null) }
      else { setHotspots([]); setRegisterError(r.error) }
    })
    return () => { alive = false }
  }, [])

  const [surfaceMeta, setSurfaceMeta] = useState<{
    modelVersion: string | null
    nCells: number | null
    error: string | null
  }>({ modelVersion: null, nCells: null, error: null })

  // Raster tile layer definitions, fetched once. Each carries its own status,
  // reason, legend facts, attribution and what the local cache holds.
  const [tileDefs, setTileDefs] = useState<TileLayerDef[] | null>(null)
  const [tileDefsError, setTileDefsError] = useState<string | null>(null)
  const [tileState, setTileState] = useState<Record<string, TileSourceState>>({})
  // The grid and the measured points, kept once fetched so switching between
  // the three vector layers does not refetch 1,710 cells each time.
  const [gridData, setGridData] = useState<any | null>(null)
  const [gridError, setGridError] = useState<string | null>(null)
  const [measuredData, setMeasuredData] = useState<any | null>(null)
  const [measuredError, setMeasuredError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/v1/map/tile-layers', { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as TileLayersResponse | null
        if (!alive) return
        if (body && Array.isArray(body.layers) && body.layers.length) {
          setTileDefs(body.layers)
          setTileDefsError(null)
        } else {
          setTileDefs([])
          setTileDefsError(body?.note || body?.error || `tile layers: ${r.status}`)
        }
      })
      .catch((e) => {
        if (!alive) return
        setTileDefs([])
        setTileDefsError(String(e?.message || e))
      })
    return () => {
      alive = false
    }
  }, [])

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Interactive AI Map Selection & Prediction States
  const [searchQuery, setSearchQuery] = useState('')
  const [activePrediction, setActivePrediction] = useState<any | null>(null)
  const [isPredicting, setIsPredicting] = useState(false)

  // Interactive Geocoding Autocomplete & Search States
  const [suggestions, setSuggestions] = useState<Array<{ lat: number; lng: number; name: string; displayName: string; state?: string; district?: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const autocompleteTimerRef = useRef<NodeJS.Timeout | null>(null)

  const LRef = useRef<any>(null)
  const overlayGroupRef = useRef<any>(null)
  // The raster layer currently on the map, if any, and the attribution string
  // it contributed — kept so the next switch can remove exactly that.
  const activeTileLayerRef = useRef<any>(null)
  const attributionCtrlRef = useRef<any>(null)
  const tileAttributionRef = useRef<string | null>(null)
  // Incremented on every layer change. An async draw that finishes after the
  // user has already switched again checks this and draws nothing, so a slow
  // fetch for the old layer cannot paint over the new one.
  const layerGenRef = useRef(0)
  const targetMarkerRef = useRef<any>(null)

  const setTileAttribution = (next: string | null) => {
    const ctrl = attributionCtrlRef.current
    if (!ctrl) return
    if (tileAttributionRef.current) ctrl.removeAttribution(tileAttributionRef.current)
    if (next) ctrl.addAttribution(next)
    tileAttributionRef.current = next
  }

  const updateLayers = async () => {
    const L = LRef.current
    const overlay = overlayGroupRef.current
    const map = mapInstanceRef.current
    if (!L || !overlay || !map) return

    const gen = ++layerGenRef.current
    overlay.clearLayers()
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current)
      activeTileLayerRef.current = null
    }
    setTileAttribution(null)

    // ---- raster tiles from Planetary Computer, live first, cache second ----
    if (TILE_LAYER_IDS.has(activeLayer)) {
      const def = tileDefs?.find((d) => d.id === activeLayer)
      // Definitions not in yet, or the service layer is down: draw nothing and
      // let the legend say why. No stand-in imagery.
      if (!def) return
      const live = def.status === 'ok'
      const cached = !!def.cache?.available
      if (!live && !cached) return

      const layer = createResilientTileLayer(L, def, (state) => {
        if (gen !== layerGenRef.current) return
        setTileState((prev) => ({ ...prev, [def.id]: state }))
        // The attribution names the licensor in every state and says whether
        // these pixels are live or cached, so the control is rewritten whenever
        // what is on screen changes.
        setTileAttribution(attributionHtml(def, state))
      })
      if (gen !== layerGenRef.current) return
      layer.addTo(map)
      activeTileLayerRef.current = layer
      return
    }

    // ---- the kriged surface: score or its uncertainty ----------------------
    if (activeLayer === 'probability' || activeLayer === 'uncertainty') {
      // The honest surface, scored by the model that is loaded.
      //
      // This once fetched a committed `prospectivity.geojson` — 1,326 cells
      // from the superseded model, with `dist_to_fault_km`, `temp_c` and
      // `rainfall_mm` in every popup. Two of those are features the honest
      // rebuild dropped for leaking the labels; one the model never had. The
      // popup called the file "LIVE ML" and "Real-Time Telemetry". It was a
      // static asset from a retired model, badged as a live feed.
      let data = gridData
      if (!data) {
        try {
          const res = await fetch('/api/v1/prospectivity')
          if (!res.ok) throw new Error(`prospectivity surface: ${res.status}`)
          data = await res.json()
          if (!data?.cells?.length) throw new Error('prospectivity surface returned no cells')
          setGridData(data)
          setGridError(null)
        } catch (err: any) {
          // No surface rather than a drawn one.
          const msg = String(err?.message || err)
          setGridError(msg)
          setSurfaceMeta({ modelVersion: null, nCells: null, error: msg })
          return
        }
      }
      if (gen !== layerGenRef.current) return

      const legend = data.legends?.[activeLayer]
      const domain: [number, number] | null = legend?.scale?.domain ?? null
      const norm = (v: number) =>
        domain && domain[1] > domain[0] ? (v - domain[0]) / (domain[1] - domain[0]) : v

      data.cells.forEach((c: any) => {
        const score = c.prospectivity_score
        const sd = c.uncertainty_sd
        const value = activeLayer === 'probability' ? score : sd
        // cividis (D-027: a quantity gets a sequential colormap, never a
        // status colour). The domain is the one the service reported for this
        // response, so the colours span the data that is actually there.
        const t = Math.min(1, Math.max(0, norm(value)))
        const fill = cividis(t)
        const circle = L.circle([c.lat, c.lng], {
          radius: 1600,
          fillColor: fill,
          fillOpacity: 0.2 + t * 0.6,
          color: fill,
          weight: 0.4,
          opacity: 0.5,
        })
        circle.bindPopup(
          `<div class="prospectivity-popup-body" data-provenance="derived" data-provenance-model="${data.model_version}">
             <strong>${activeLayer === 'probability' ? 'Prospectivity score' : 'Kriging uncertainty'}</strong><br/>
             ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}<br/>
             score <strong>${score.toFixed(3)}</strong> &plusmn; ${sd.toFixed(3)} (kriging sd)<br/>
             <span class="prospectivity-popup-note">
               ${data.model_version} &middot; derived, not a live reading.
               A surface score, not a grade and not a reserve (PRD 2.4).
             </span>
           </div>`,
          { className: 'prospectivity-popup' }
        )
        circle.on('click', () => {
          triggerAIPrediction(c.lat, c.lng, `Grid cell (${c.lat.toFixed(3)}, ${c.lng.toFixed(3)})`)
        })
        overlay.addLayer(circle)
      })

      setSurfaceMeta({ modelVersion: data.model_version, nCells: data.n_cells ?? data.cells.length, error: null })
      return
    }

    // ---- the points the model was fitted on --------------------------------
    if (activeLayer === 'measured') {
      let data = measuredData
      if (!data) {
        try {
          const res = await fetch('/api/v1/prospectivity/measured')
          if (!res.ok) throw new Error(`measured points: ${res.status}`)
          data = await res.json()
          if (!data?.points?.length) throw new Error('measured points returned none')
          setMeasuredData(data)
          setMeasuredError(null)
        } catch (err: any) {
          setMeasuredError(String(err?.message || err))
          return
        }
      }
      if (gen !== layerGenRef.current) return

      data.points.forEach((p: any) => {
        const known = p.label === 1
        // A category, not a quantity, so not cividis: a known mine is filled,
        // a background site is a ring.
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: known ? 7 : 5,
          color: known ? 'var(--color-accent)' : 'var(--color-text-primary)',
          weight: known ? 1.5 : 1.25,
          fillColor: 'var(--color-accent)',
          fillOpacity: known ? 0.85 : 0,
        })
        marker.bindPopup(
          `<div class="prospectivity-popup-body">
             <strong>${known ? 'Known mine (label 1)' : 'Background site (label 0)'}</strong><br/>
             ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}
             <div data-provenance="measured">
               iron-oxide ratio ${p.iron_oxide_ratio.toFixed(3)} &middot; NDVI ${p.ndvi.toFixed(3)}
               &middot; slope ${p.slope_deg.toFixed(1)}&deg;
               <span class="prospectivity-popup-note">Sentinel-2 L2A and SRTM, sampled at this site.</span>
             </div>
             <div data-provenance="derived" data-provenance-model="${data.model_version}">
               fitted score ${p.fitted_score.toFixed(3)}
               <span class="prospectivity-popup-note">${data.model_version} &middot; model output, not a measurement.</span>
             </div>
           </div>`,
          { className: 'prospectivity-popup' }
        )
        overlay.addLayer(marker)
      })
    }

    // REMOVED: six fabricated overlay layers.
    //
    // `ndvi`, `moisture`, `thermal`, `isro-bhuvan`, `isro-risat` and
    // `isro-cartosat` did not read any data. They generated a 9x9 grid of
    // circles around the selected mine from sin()/cos() of the loop indices,
    // then labelled each cell with a popup asserting a source and a
    // measurement:
    //
    //   "ISRO RESOURCESAT-2A LISS-IV / Portal: NRSC Bhuvan Open Data /
    //    Resolution: 5.8m Multispectral / SWIR Mineral Ratio: 2.19 /
    //    Ore Horizon Boundary Verified"
    //
    // None of it existed. Bhuvan and MOSDAC are not sources of this project —
    // docs/READINESS.md records GSI Bhukosh as unreachable and lithology as
    // omitted rather than substituted — and "Ore Horizon Boundary Verified" is
    // a claim about ore that nothing here can make. Every layer above is read
    // from a service that names its source.
  }

  // Trigger AI Prospectivity Machine Learning Model for any clicked / typed Lat/Lng
  const triggerAIPrediction = async (lat: number, lng: number, customLocationName?: string) => {
    setIsPredicting(true)
    setActivePrediction(null)

    // The real model, or its reason for not answering — never a stand-in.
    //
    // A failed request used to be answered here by createFallbackPrediction:
    // a probability from a lat/lng box, features from a sine-hash seed,
    // `model_accuracy_pct: 100` and `is_live_api: true`, shown as a model
    // result. The Next route had already been rewritten to return 503 so that
    // could not happen; this re-created it in the browser (PRD N-6;
    // docs/design/POLISH_AUDIT.md issue 1). Live is what this click asked for
    // before; the route's own default.
    const r = await predictPoint(lat, lng, true)
    setActivePrediction(
      r.ok
        ? { ok: true, lat, lng, location_name: customLocationName, probe: r.data }
        : { ok: false, lat, lng, location_name: customLocationName, error: r.error }
    )
    setIsPredicting(false)

    // Place Target Crosshair Marker on Leaflet Map
    const L = LRef.current
    const map = mapInstanceRef.current
    if (L && map) {
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current)
      }

      // A static ring and dot. It span on a 6 s infinite loop with a 22 px
      // glow: perpetual motion and a glow on the console, which says "live"
      // about a point that was scored once (DESIGN_SYSTEM §7.2).
      const targetIcon = L.divIcon({
        className: 'ai-target-crosshair-pin',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `
          <div style="
            position: relative;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center; ">
            <div style="
              position: absolute;
              inset: 0;
              border-radius: 50%;
              border: 2px solid var(--color-accent); "></div>
            <div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: var(--color-accent);
              border: 1px solid var(--color-surface-0); "></div>
          </div> `,
      })

      targetMarkerRef.current = L.marker([lat, lng], { icon: targetIcon }).addTo(map)
      map.flyTo([lat, lng], Math.max(map.getZoom(), 10.5), { duration: 1.2 })
    }
  }

  // Handle live autocomplete search input with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    setSearchError(null)

    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current)
    }

    if (val.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    autocompleteTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(val.trim())}`)
        if (res.ok) {
          const data = await res.json()
          if (data?.results?.length > 0) {
            setSuggestions(data.results)
            setShowSuggestions(true)
          } else {
            setSuggestions([])
          }
        }
      } catch (err) {
        console.warn('Autocomplete fetch error:', err)
      }
    }, 220)
  }

  // Handle selecting a location from autocomplete dropdown
  const handleSelectSuggestion = (loc: { lat: number; lng: number; name: string; displayName: string }) => {
    setSearchQuery(loc.name)
    setSuggestions([])
    setShowSuggestions(false)
    setSearchError(null)
    triggerAIPrediction(loc.lat, loc.lng, loc.displayName || loc.name)
  }

  // Handle Search Input Submission (Supports ANY area, city, district, pin code, or coordinates in India)
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const rawQuery = searchQuery.trim()
    if (!rawQuery) return

    setSearchError(null)
    setShowSuggestions(false)
    setIsSearching(true)

    const query = rawQuery.toLowerCase()

    // 1. Check if user entered numeric coordinates e.g. "21.83, 80.19" or "21.83 80.19"
    const coordMatches = rawQuery.match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/)
    if (coordMatches) {
      const lat = parseFloat(coordMatches[1])
      const lng = parseFloat(coordMatches[2])
      if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5) {
          setIsSearching(false)
          triggerAIPrediction(lat, lng, `Coordinates (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`)
          return
        } else {
          setSearchError('Coordinates must be within India geographic region (Lat 6.0°-37.5°N, Lng 68.0°-97.5°E).')
          setIsSearching(false)
          return
        }
      }
    }

    // 2. Search existing MOIL mines list
    const foundMine = MOIL_MINES.find(
      (m) => m.name.toLowerCase().includes(query) || m.code.toLowerCase().includes(query)
    )
    if (foundMine) {
      onSelectMine(foundMine)
      setIsSearching(false)
      triggerAIPrediction(foundMine.lat, foundMine.lng, `${foundMine.name} Mine Complex (${foundMine.state})`)
      return
    }

    // 3. Call server-side geocoding API route `/api/v1/geocode` (OpenStreetMap Nominatim server proxy)
    try {
      const res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(rawQuery)}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.results?.length > 0) {
          const target = data.results[0]
          setIsSearching(false)
          triggerAIPrediction(target.lat, target.lng, target.displayName || target.name)
          return
        }
      }
    } catch (err) {
      console.warn('Geocoding route failed, using client backup:', err)
    }

    // 4. Client-side Photon API backup if server route returned no match
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        rawQuery + ' India'
      )}&bbox=68.1,6.5,97.4,35.5&limit=3`
      const pRes = await fetch(photonUrl)
      if (pRes.ok) {
        const pData = await pRes.json()
        if (pData?.features?.length > 0) {
          const feat = pData.features[0]
          const coords = feat.geometry?.coordinates
          if (coords && coords.length >= 2) {
            const lng = coords[0]
            const lat = coords[1]
            if (lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5) {
              const props = feat.properties || {}
              const placeName = [props.name, props.city || props.district, props.state, 'India'].filter(Boolean).join(', ')
              setIsSearching(false)
              triggerAIPrediction(lat, lng, placeName)
              return
            }
          }
        }
      }
    } catch (err) {
      console.warn('Photon backup geocode failed:', err)
    }

    // 5. Check 40+ preset Indian mining locations
    for (const [key, loc] of Object.entries(INDIAN_MINING_LOCATIONS)) {
      if (query.includes(key)) {
        setIsSearching(false)
        triggerAIPrediction(loc.lat, loc.lng, loc.name)
        return
      }
    }

    // 6. Handle unfound locations gracefully without placing fake pins on random coordinates
    setIsSearching(false)
    setSearchError(`Unable to locate "${rawQuery}" in India. Please verify spelling or try searching a major city, district, area, or coordinates.`)
  }

  useEffect(() => {
    if (!mapContainerRef.current) return

    let isMounted = true

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapContainerRef.current, {
        center: [selectedMine.lat, selectedMine.lng],
        zoom: 8.5,
        zoomControl: false,
        // Leaflet's default control is replaced, not kept: it prefixes every
        // credit with "Leaflet", which is not a licensor of any pixel here.
        attributionControl: false,
      })
      // Attribution, which this map did not have at all before: the control was
      // disabled, so no layer — basemap included — ever credited its licensor.
      // Each layer's required notice is shown while that layer is visible.
      const attribution = L.control.attribution({ prefix: false, position: 'bottomleft' })
      attribution.addTo(map)
      attributionCtrlRef.current = attribution

      mapInstanceRef.current = map
      LRef.current = L

      // Leaflet measures its container once at construction. This panel is
      // inside a tab that mounts hidden, and the page reflows as fonts and the
      // drill-target table load, so the first measurement is usually wrong and
      // the map renders into a stale box. A ResizeObserver plus a post-paint
      // call covers both.
      requestAnimationFrame(() => map.invalidateSize())
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        const ro = new ResizeObserver(() => map.invalidateSize())
        ro.observe(mapContainerRef.current)
        resizeObserverRef.current = ro
      }

      overlayGroupRef.current = L.layerGroup().addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // 1. High-Resolution Real Satellite Base Layer (ESRI World Imagery)
      L.tileLayer( `${UPSTREAMS.esriTiles}/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
        {
          maxZoom: 18,
          attribution: `<span data-attribution-layer="esri-basemap">${ESRI_WORLD_IMAGERY_ATTRIBUTION}</span>`,
        }
      ).addTo(map)

      // 2. Ultra-Thin Vector State Boundaries
      THIN_STATE_BOUNDARIES.forEach((boundary) => {
        L.polygon(boundary as any, {
          color: 'var(--color-accent)',
          weight: 0.9,
          opacity: 0.5,
          fillColor: 'transparent',
          fillOpacity: 0.0,
          dashArray: '3, 6',
        }).addTo(map)
      })

      // 4. All 10 MOIL Hotspots with Priority Colors & Rates
      hotspots.forEach((mine) => {
        const isSelected = mine.id === selectedMine.id
        const pinColor = resolveToken(mine.color)

        const hotspotIcon = L.divIcon({
          className: 'priority-hotspot-beacon',
          iconSize: [120, 42],
          iconAnchor: [60, 14],
          html: `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              position: relative; ">
              ${
                isSelected
                  ? `<div class="hotspot-radar-ring" style="border-color: ${pinColor}; width: 34px; height: 34px; top: -10px; left: 43px;"></div>`
                  : ''
              }
              <div style="
                width: ${isSelected ? '14px' : '10px'};
                height: ${isSelected ? '14px' : '10px'};
                border-radius: 50%;
                background: ${pinColor};
                border: 2px solid var(--color-text-primary);
                box-shadow: 0 0 16px ${pinColor}, 0 2px 8px rgba(0,0,0,0.95);
                margin-bottom: 2px;
                transition: all 0.3s ease; "></div>
              <div style="
                text-align: center;
                white-space: nowrap;
                pointer-events: none; ">
                <div style="
                  font-family: monospace;
                  font-size: 10.5px;
                  font-weight: 900;
                  color: ${isSelected ? 'var(--color-text-primary)' : pinColor};
                  text-shadow: 0 0 8px ${pinColor}, 0 2px 4px var(--color-surface-0), 0 0 3px var(--color-surface-0);
                  letter-spacing: 0.05em; ">
                  ${mine.name}
                </div>
                <div style="
                  font-family: monospace;
                  font-size: 8px;
                  font-weight: 700;
                  color: var(--color-text-primary);
                  text-shadow: 0 1px 3px var(--color-surface-0), 0 0 4px var(--color-surface-0);
                  letter-spacing: 0.02em;
                  opacity: 0.9; " data-provenance="reference">
                  ${mine.rate} plan
                </div>
              </div>
            </div> `,
        })

        const orig = MOIL_MINES.find((item) => item.id === mine.id) || selectedMine
        const marker = L.marker([mine.lat, mine.lng], { icon: hotspotIcon }).addTo(map)

        marker.on('click', () => {
          onSelectMine(orig)
          map.flyTo([mine.lat, mine.lng], 12, { duration: 1.2 })
          triggerAIPrediction(mine.lat, mine.lng, `${mine.name} Mine Complex (${mine.state})`)
        })
      })

      // 5. MAP CLICK & DOUBLE TAP AI ML PREDICTION LISTENER
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        triggerAIPrediction(lat, lng)
      })

      map.on('dblclick', (e: any) => {
        const { lat, lng } = e.latlng
        triggerAIPrediction(lat, lng)
      })

      updateLayers()
    })

    return () => {
      isMounted = false
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
    // `hotspots` is a dependency now: the markers used to come from a literal
    // array available at mount, and they now arrive from /api/v1/mines. Without
    // this the effect drew an empty register once and never redrew — the map
    // rendered its tiles and its prospectivity overlay with no mines on it, and
    // the route suite caught it ("mine markers plotted — 0 markers").
  }, [hotspots])

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedMine.lat, selectedMine.lng], 11, {
        duration: 1.0,
      })
    }
    updateLayers()
  }, [selectedMine, activeLayer])

  // A raster layer chosen before its definition arrived draws nothing; redraw
  // once the definitions are in. Separate from the effect above so that the
  // arrival of data does not also fly the map somewhere.
  // Latest values through refs, so this effect runs when — and only when — the
  // definitions arrive. Depending on `activeLayer` directly would redraw on
  // every layer switch, duplicating the effect above, and `updateLayers` is a
  // new function every render.
  const activeLayerRef = useRef(activeLayer)
  activeLayerRef.current = activeLayer
  const updateLayersRef = useRef(updateLayers)
  updateLayersRef.current = updateLayers
  useEffect(() => {
    if (tileDefs && TILE_LAYER_IDS.has(activeLayerRef.current)) updateLayersRef.current()
  }, [tileDefs])

  /**
   * Two layers, named for what they are.
   *
   * The base layer was captioned "True Color Optical (Sentinel-2)"; it is ESRI
   * World Imagery, which is a composite basemap, not a Sentinel-2 scene. The
   * prospectivity overlay was captioned "SWIR Mineral Probability Heatmap",
   * which claims a mineral probability the model does not produce — it outputs
   * a prospectivity score, explicitly not a grade or a reserve (PRD §2.4).
   */
  const layers: { key: LayerType; label: string; group: 'model' | 'imagery' }[] = [
    { key: 'probability', label: 'Prospectivity score', group: 'model' },
    { key: 'uncertainty', label: 'Kriging uncertainty', group: 'model' },
    { key: 'measured', label: 'Measured points', group: 'model' },
    { key: 's2-true-colour', label: 'Sentinel-2 true colour', group: 'imagery' },
    { key: 'iron-oxide', label: 'Iron-oxide ratio', group: 'imagery' },
    { key: 'dem', label: 'Copernicus DEM', group: 'imagery' },
  ]

  /**
   * The legend for the active layer, assembled from what its service returned.
   * Nothing in here is authored: facts, scales, caveats and attribution are all
   * read from the response.
   */
  const legendModel: LegendModel = (() => {
    if (TILE_LAYER_IDS.has(activeLayer)) {
      const def = tileDefs?.find((d) => d.id === activeLayer)
      if (!def) {
        return {
          layerId: activeLayer,
          name: layers.find((l) => l.key === activeLayer)?.label ?? activeLayer,
          kind: 'measured',
          status: tileDefs === null ? 'loading' : 'unavailable',
          reason: tileDefs === null ? null : tileDefsError ?? 'no definition returned for this layer',
          facts: [],
        }
      }
      const st = tileState[def.id]
      const cachedOnScreen = st?.mode === 'cache' || st?.mode === 'mixed'
      return {
        layerId: def.id,
        name: def.name,
        kind: 'measured',
        status: def.status === 'ok' || cachedOnScreen || def.cache?.available ? 'ok' : 'unavailable',
        reason: def.status === 'ok' ? null : def.reason ?? null,
        tile: {
          mode: st?.mode ?? (def.status === 'ok' || def.cache?.available ? 'loading' : 'unavailable'),
          fetchedAt: def.cache?.fetched_at ?? null,
          liveReason: def.status === 'ok' ? (st?.lastError ?? null) : def.reason ?? null,
          tilejsonUrl: def.tilejson_url ?? null,
        },
        facts: def.legend_facts,
        scale: def.scale
          ? {
              stops: (def.scale as any).stops ?? [],
              low: def.scale.low_label,
              high: def.scale.high_label,
              colormap: def.scale.colormap,
              stopsSource: (def.scale as any).stops_source ?? null,
            }
          : null,
        caveat: def.caveat,
        attribution: {
          required: def.attribution.required,
          tiler: def.attribution.tiler,
          licenceName: def.attribution.licence_name,
          licenceUrl: def.attribution.licence_url,
        },
      }
    }
    if (activeLayer === 'probability' || activeLayer === 'uncertainty') {
      const lg = gridData?.legends?.[activeLayer]
      if (!lg) {
        return {
          layerId: activeLayer,
          name: activeLayer === 'probability' ? 'Prospectivity score' : 'Kriging uncertainty',
          kind: 'derived',
          status: gridError ? 'unavailable' : 'loading',
          reason: gridError,
          facts: [],
        }
      }
      return {
        layerId: activeLayer,
        name: lg.name,
        kind: 'derived',
        status: 'ok',
        facts: lg.legend_facts,
        scale: {
          stops: CIVIDIS_STOPS,
          low: lg.scale.low_label,
          high: lg.scale.high_label,
          domain: lg.scale.domain,
          colormap: lg.scale.colormap,
        },
        caveat: lg.caveat,
        modelVersion: gridData.model_version,
      }
    }
    const lg = measuredData?.legend
    if (!lg) {
      return {
        layerId: 'measured',
        name: 'Measured points',
        kind: 'measured',
        status: measuredError ? 'unavailable' : 'loading',
        reason: measuredError,
        facts: [],
      }
    }
    return {
      layerId: 'measured',
      name: lg.name,
      kind: 'measured',
      status: 'ok',
      facts: lg.legend_facts,
      caveat: lg.caveat,
      modelVersion: measuredData.model_version,
    }
  })()

  const zoomToIndia = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([21.6, 79.8], 8, { duration: 1.2 })
    }
  }

  const zoomToNational = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([22.5, 80.0], 5.5, { duration: 1.4 })
    }
  }

  /**
   * `HotspotMeta | undefined`, written so the compiler agrees.
   *
   * This read `... || hotspots[0] || null`, which TypeScript typed as
   * non-nullable: without `noUncheckedIndexedAccess`, `hotspots[0]` is
   * `HotspotMeta`, an object type TS considers always truthy, so the `|| null`
   * branch was dead and every `currentHotspotMeta.color` below type-checked.
   * At runtime the array is empty until the register arrives — and stays empty
   * if it never does — so those reads throw. `strict: true` did not catch it.
   */
  const currentHotspotMeta: HotspotMeta | undefined =
    hotspots.find((h) => h.id === selectedMine.id) ?? hotspots.at(0)

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-border-default bg-surface-1 ${
        isFullscreen ? 'fixed inset-4 z-50' : ''
      }`}
    >
      {/*
        Header: one sentence and the map's controls (POLISH_AUDIT.md issue 5).
        It was a red "PROSPECTIVITY MAP" eyebrow, an uppercase "CLICK A CELL,
        OR SEARCH A PLACE", and a bold sentence saying the same — three
        statements of one instruction, in status red, which means "threshold
        breached". The panel above the map already labels it. The "Highlight
        belt on/off" toggle is gone: it switched a class (cyber-radar-sweep-beam)
        that no stylesheet defines, so it changed nothing on the map.
      */}
      <div className="flex flex-col justify-between gap-3 border-b border-border-default bg-surface-1 p-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <p className="measure text-sm text-text-secondary">
            Click a cell, or search a place, to score it against the Track A model. The score ranks
            places by surface geology and terrain — not a grade, not a reserve, and not evidence of
            ore at depth.
          </p>
          {/* What is actually drawn, reported by the service that drew it. */}
          {activeLayer === 'probability' || activeLayer === 'uncertainty' ? (
            surfaceMeta.error ? (
              <p className="mt-1 text-xs text-status-caution">
                No surface is drawn: {surfaceMeta.error}. A drawn stand-in would not be the
                model&rsquo;s.
              </p>
            ) : surfaceMeta.modelVersion ? (
              <p
                className="mt-1 font-mono text-xs text-text-secondary"
                data-provenance="derived"
                data-provenance-model={surfaceMeta.modelVersion}
              >
                {surfaceMeta.modelVersion} · {surfaceMeta.nCells?.toLocaleString()} cells scored,
                kriged · derived, not a live reading
              </p>
            ) : null
          ) : null}
        </div>

        {/* Map controls: neutral, sentence case (DESIGN_SYSTEM §4.4, §5.2). */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={zoomToNational}
            className="flex items-center gap-1.5 rounded-md border border-border-interactive bg-surface-2 px-3 py-1.5 text-sm text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            <Compass className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <span>National view</span>
          </button>

          <button
            type="button"
            onClick={zoomToIndia}
            className="flex items-center gap-1.5 rounded-md border border-border-interactive bg-surface-2 px-3 py-1.5 text-sm text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            <Navigation className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <span>Manganese belt</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            // Icon-only, so it had no accessible name: axe "button-name",
            // critical. Pre-existing; found when the audit first covered this
            // route (it had never visited /console?track=a).
            aria-label={isFullscreen ? 'Exit full-screen map' : 'Full-screen map'}
            aria-pressed={isFullscreen}
            className="rounded-md border border-border-interactive bg-surface-2 p-2 text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* SEARCH LOCATION & COORDINATES BAR */}
      <div className="p-3 bg-black/70 border-b border-border-default  flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 relative z-[500]">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:max-w-xl relative">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-accent absolute left-3 top-2.5 z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Type any city, area, district, or coordinates in India (e.g. Lucknow, Noida, Pune, Balaghat, 21.83, 80.19)..."
              className="w-full pl-9 pr-8 py-2 rounded-md bg-surface-3 border border-border-interactive text-xs font-mono text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSuggestions([])
                  setShowSuggestions(false)
                  setSearchError(null)
                }}
                className="absolute right-2.5 top-2.5 text-text-secondary hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* LIVE AUTOCOMPLETE SUGGESTIONS DROPDOWN */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--color-surface-1)]/95 border border-accent/40 rounded-md  max-h-64 overflow-y-auto z-[600] divide-y divide-white/5">
                <div className="px-3 py-1.5 text-xs font-mono font-bold text-accent uppercase tracking-wider bg-surface-2 flex items-center justify-between">
                  <span>Matched Indian Locations ({suggestions.length})</span>
                  <span className="text-xs text-text-secondary">Click to Select</span>
                </div>
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-accent/15 transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5 group- transition-transform" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold text-text-primary group-hover:text-accent truncate flex items-center justify-between">
                        <span>{item.name}</span>
                        <span className="text-xs text-accent ml-2 shrink-0 font-normal">
                          {item.lat.toFixed(3)}°N, {item.lng.toFixed(3)}°E
                        </span>
                      </div>
                      <div className="text-xs font-mono text-text-secondary truncate">
                        {item.displayName || `${item.state || 'India'}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LIQUID GLASS EFFECT SEARCH BUTTON MATCHING MENU BAR */}
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-md border border-border-interactive bg-surface-2 px-5 py-2 rounded-md text-xs font-mono font-bold text-accent hover:text-text-primary border border-accent/40 hover:border-accent flex items-center gap-2 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-accent " />
            )}
            <span>{isSearching ? 'Locating...' : 'Locate AI'}</span>
          </button>
        </form>

        {/* Preset Location Quick Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <span className="text-xs font-mono text-text-tertiary uppercase shrink-0 font-bold">
            Presets:
          </span>
          {['bhopal', 'keonjhar', 'sandur', 'jaipur', 'nagpur', 'lucknow', 'delhi', 'mumbai'].map((key) => {
            const loc = INDIAN_MINING_LOCATIONS[key] || { lat: 21.1458, lng: 79.0882, name: key.toUpperCase() }
            return (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setSearchQuery(loc.name)
                  setSearchError(null)
                  triggerAIPrediction(loc.lat, loc.lng, loc.name)
                }}
                className="rounded-md border border-border-interactive bg-surface-2 px-3 py-1 rounded-full text-xs font-mono text-text-secondary hover:text-accent whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {key.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* SEARCH ERROR BANNER */}
      {searchError && (
        <div className="bg-status-critical/15 border-b border-status-critical/40 px-4 py-2 text-xs font-mono text-status-critical flex items-center justify-between gap-2 z-[400]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
          <button type="button" onClick={() => setSearchError(null)} className="hover:text-text-primary">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/*
        Map and its legend, side by side from lg; stacked below it. The map
        keeps only what belongs on it: imagery, markers, the selected mine's
        card, zoom and the attribution line.
      */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0">
          {/* Cyber Digital Map Viewport */}
          <div
            className={`relative w-full ${
              // Shorter at phone width. 560px of map on an 812px screen left
              // nothing of the panel around it visible, so the legend, the layer
              // switcher and the ranked targets all sat below the fold with no
              // indication that they existed.
              isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[380px] sm:h-[560px] lg:h-[620px]'
            } bg-surface-0 overflow-hidden`}
          >

            <div ref={mapContainerRef} className="w-full h-full" />

            {/* DEFAULT TELEMETRY CARD (Top Right - visible when search prediction report is not active) */}
            {!activePrediction && !currentHotspotMeta && registerError ? (
              <div className="absolute top-4 right-4 z-[400] max-w-xs rounded-md border border-border-default bg-[rgba(8,12,18,0.92)] p-4 text-xs shadow-2xl">
                <p className="font-semibold text-status-caution">Mine register unavailable</p>
                <p className="mt-1 leading-snug text-text-secondary">
                  {registerError}. No mines are drawn: this map reads the register from the service
                  layer and does not keep a copy of its own.
                </p>
              </div>
            ) : null}

            {/*
              The selected mine's card. Not on a phone: there it covered the top
              of a 380 px map (POLISH_AUDIT.md issues 5 and 8), and the dock
              under the map already names the mine and its plan target. And not
              "CRITICAL PLAN TARGET" in status red — a large plan is not a
              breached threshold; the red is the marker colour (backlogged).
            */}
            {!activePrediction && currentHotspotMeta && (
              <div className="absolute top-3 right-3 z-[400] hidden max-w-xs rounded-md border border-border-default bg-surface-1 p-4 shadow-[var(--shadow-overlay)] sm:block">
                <div className="mb-2 flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentHotspotMeta.color }} />
                  <span className="text-sm font-medium text-text-primary">{selectedMine.name}</span>
                </div>

                <div
                  className="space-y-1.5 border-t border-border-default pt-2 text-sm"
                  data-provenance="reference"
                >
                  <div className="flex justify-between gap-4 text-text-secondary">
                    <span>Plan target (register)</span>
                    <span className="font-mono text-text-primary">{currentHotspotMeta.rate}</span>
                  </div>
                  {/*
                    An "Estimated Ore Grade" row sat here showing a per-mine Mn
                    percentage from the literal table above. No grade data exists:
                    Track A outputs a prospectivity score, which PRD §2.4 is
                    explicit is not a grade and not a reserve.
                  */}
                  <div className="flex justify-between gap-4 text-text-secondary">
                    <span>Coordinates</span>
                    <span className="font-mono text-text-primary">{selectedMine.lat}&deg;N, {selectedMine.lng}&deg;E</span>
                  </div>
                  <div className="flex justify-between gap-4 text-text-secondary">
                    <span>Geological belt</span>
                    <span className="text-text-primary">{selectedMine.state === 'MP' ? 'Central MP Syncline' : 'Western MH Corridor'}</span>
                  </div>
                </div>
              </div>
            )}

            {/*
              What a click on the map scored. It was an "AI prospectivity
              dossier" reading fields the service does not send: "NaN%" as a
              manganese possibility, literal fallbacks for a fault distance and
              two reflectances, an empty "AI diagnostic" and two buttons to an
              anchor that is not on the page (POLISH_AUDIT.md issue 1). It now
              shows the response itself, through the same Metrics as the
              "Score a location" form below the map — or, if the model did not
              answer, that it did not, with no number.
            */}
            {activePrediction && (
              <div
                className="absolute top-3 right-3 z-[450] max-h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] overflow-y-auto rounded-md border border-border-default bg-surface-1 p-4 shadow-[var(--shadow-overlay)] sm:w-[400px]"
                data-testid="map-point-score"
                role="dialog"
                aria-label="Score at this point"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  {/* The point that was clicked, by name and coordinates: an
                      input, not a claim. */}
                  <div className="min-w-0" data-point-coords>
                    <p className="label">Score at this point</p>
                    <p className="mt-1 truncate text-sm font-medium text-text-primary">
                      {activePrediction.location_name ?? 'Selected point'}
                    </p>
                    <p className="font-mono text-xs text-text-secondary">
                      {activePrediction.lat.toFixed(3)}°N, {activePrediction.lng.toFixed(3)}°E
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePrediction(null)}
                    className="shrink-0 rounded-md p-1 text-text-secondary transition-colors duration-[120ms] ease-out hover:bg-surface-3 hover:text-text-primary"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {activePrediction.ok ? (
                  <PointScore probe={activePrediction.probe} />
                ) : (
                  <div className="rounded-md border border-status-critical/30 bg-status-critical/5 p-3 text-xs" role="status">
                    <p className="font-semibold text-status-critical">Prospectivity model unavailable</p>
                    {/* The service's own reason, which already says why no
                        number follows; a bare network error gets that said. */}
                    <p className="mt-1 leading-snug text-text-secondary">
                      {String(activePrediction.error).replace(/\.+$/, '')}.
                    </p>
                    {/no score/i.test(String(activePrediction.error)) ? null : (
                      <p className="mt-1 leading-snug text-text-secondary">No score is shown.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* While the click is being scored. Stated, not animated. */}
            {isPredicting && (
              <div
                role="status"
                className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-md border border-border-default bg-surface-1 px-3 py-1.5 text-xs text-text-secondary shadow-[var(--shadow-overlay)]"
              >
                Scoring this point with the Track A model…
              </div>
            )}

          </div>
            {/*
              Hotspot dock — under the map, not over it. Overlaid, it collided with
              the attribution line, which the licences require to stay readable,
              and at 375 the two were stacked on the same 50px of a 380px map.
            */}
            <div className="flex items-center gap-2 overflow-x-auto border-t border-border-default bg-surface-1 p-2">
              <span className="text-xs font-mono font-bold text-text-tertiary uppercase px-2 shrink-0 hidden sm:inline">
                HOTSPOTS:
              </span>
              {hotspots.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    const orig = MOIL_MINES.find((item) => item.id === m.id) || selectedMine
                    onSelectMine(orig)
                    triggerAIPrediction(m.lat, m.lng, `${m.name} Hotspot (${m.state})`)
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    selectedMine.id === m.id
                      ? 'text-black font-semibold shadow-lg'
                      : 'bg-surface-2 border border-border-default text-text-tertiary hover:text-text-primary hover:bg-surface-3'
                  }`}
                  style={{
                    backgroundColor: selectedMine.id === m.id ? m.color : undefined,
                  }}
                  data-provenance="reference"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name} ({m.rate})
                </button>
              ))}
            </div>
        </div>

        {/*
          Legend and layer switcher — beside the map from lg, below it under lg.
          Not overlaid on the map any more. As an overlay it covered the imagery
          it described; at 1280 its lower part, including iron-oxide's scale and
          its "not a manganese detector" caveat, sat hidden behind the hotspot
          dock; at 375 the hotspot card was drawn over it. Six of the eight
          layers this panel once listed read no data and were captioned as ISRO
          measurements; see the removal note above.
        */}
        <aside
          aria-label="Map layers and legend"
          className="flex flex-col gap-3 border-t border-border-default bg-surface-1 p-4 lg:border-l lg:border-t-0"
        >

          {/* Sensor Layers */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-mono font-bold text-text-tertiary uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-accent" />
              Layers:
            </span>
            {(['model', 'imagery'] as const).map((group) => (
              <fieldset key={group} className="m-0 flex min-w-0 flex-col gap-0.5 border-0 p-0">
                <legend className="mt-1 p-0 text-xs font-mono text-text-tertiary">
                  {group === 'model' ? 'Model and inputs' : 'Imagery · Planetary Computer'}
                </legend>
                {layers
                  .filter((l) => l.group === group)
                  .map((l) => {
                    const def = TILE_LAYER_IDS.has(l.key) ? tileDefs?.find((d) => d.id === l.key) : undefined
                    // A raster layer that cannot be drawn live or from cache is
                    // still listed, so its absence is visible rather than silent.
                    const dead =
                      !!def && def.status !== 'ok' && !def.cache?.available
                    return (
                      <button
                        type="button"
                        // Pressed, not role="radio": native buttons with a pressed
                        // state are the semantic element for a one-of-N switch built
                        // from buttons, and they need no ARIA role to be read right.
                        aria-pressed={activeLayer === l.key}
                        key={l.key}
                        data-layer-button={l.key}
                        onClick={() => onChangeLayer(l.key)}
                        // Selected is the selected-row token, not a white
                        // overlay: on bg-white/20 the "ON" measured 3.85:1 and
                        // "unavailable" 4.43:1 (4.5:1 required). tokens.css
                        // lists what may sit on accent-muted.
                        className={`px-3 py-1 rounded-md text-left text-xs font-mono transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          activeLayer === l.key
                            ? 'bg-accent-muted text-text-primary font-bold border border-border-interactive shadow-md'
                            : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
                        }`}
                      >
                        <span className="truncate">{l.label}</span>
                        {dead ? (
                          <span className="text-xs text-status-caution shrink-0">unavailable</span>
                        ) : activeLayer === l.key ? (
                          <span className="text-xs font-bold text-accent shrink-0">ON</span>
                        ) : null}
                      </button>
                    )
                  })}
              </fieldset>
            ))}
          </div>

          <div className="border-t border-border-default pt-2.5">
            <MapLayerLegend model={legendModel} />
          </div>

          {/* Marker key last: the least of what this panel says. */}
          {/*
            The key only appears when there are markers for it to describe.
            It states three plan-target thresholds, and with the register
            unavailable there is nothing on the map they apply to — a legend for
            an empty map is three numbers asserted for no reason.
          */}
          {hotspots.length > 0 ? (
          <div className="space-y-1 border-t border-border-default pt-2.5" data-provenance="reference">
            <span className="text-xs font-mono font-semibold text-text-primary uppercase tracking-wider block mb-1">
              Marker size = plan target (register)
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-status-critical">
              <span className="w-2.5 h-2.5 rounded-full bg-status-critical" />
              <span className="font-bold">Largest plan target:</span> &gt;14,000 T/m (register)
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-status-caution)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-caution)]" />
              <span className="font-bold">Mid plan target:</span> 10,000&ndash;13,000 T/m
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-status-caution">
              <span className="w-2.5 h-2.5 rounded-full bg-status-caution" />
              <span className="font-bold">Smallest plan target:</span> &lt;10,000 T/m
            </div>
          </div>
          ) : null}
        </aside>

      </div>
    </div>
  )
}
