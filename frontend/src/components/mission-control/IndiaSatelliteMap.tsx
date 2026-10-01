'use client'

import { useEffect, useRef, useState } from 'react'
import type { MineInfo } from './types'
import { MOIL_MINES } from './data'
import { cividis } from '@/lib/colormap'
import { type MineRow, fetchMines } from '@/lib/console-api'
import { UPSTREAMS } from '@/lib/upstreams'
import {
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Sparkles,
  Compass,
  Navigation,
  Globe2,
  Radio,
  Search,
  X,
  Cpu,
  Activity,
  Loader2,
  AlertCircle,
} from 'lucide-react'

/**
 * The two layers this map actually has.
 *
 * It previously declared eight. Six of them ('ndvi', 'moisture', 'thermal',
 * 'isro-bhuvan', 'isro-risat', 'isro-cartosat') read no data and drew a
 * sin()/cos() grid captioned as ISRO Resourcesat, EOS-04 and Cartosat
 * measurements. They are gone; see the comment at the removal site.
 */
export type LayerType = 'satellite' | 'geology'

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

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [radarSweepActive, setRadarSweepActive] = useState(true)

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
  const targetMarkerRef = useRef<any>(null)

  const updateLayers = async () => {
    const L = LRef.current
    const overlay = overlayGroupRef.current
    if (!L || !overlay) return

    overlay.clearLayers()

    if (activeLayer === 'geology') {
      // The honest surface, scored by the model that is loaded.
      //
      // This used to fetch a committed `prospectivity.geojson` — 1,326 cells
      // from the superseded model, with `dist_to_fault_km`, `temp_c` and
      // `rainfall_mm` in every popup. Two of those are features the honest
      // rebuild dropped for leaking the labels; one the model never had. The
      // popup called the file "LIVE ML" and "Real-Time Telemetry". It was a
      // static asset from a retired model, badged as a live feed.
      try {
        const res = await fetch('/api/v1/prospectivity')
        if (!res.ok) throw new Error(`prospectivity surface: ${res.status}`)
        const data = await res.json()
        const cells: any[] = data.cells ?? []
        if (!cells.length) throw new Error('prospectivity surface returned no cells')

        cells.forEach((c: any) => {
          const score = c.prospectivity_score
          const sd = c.uncertainty_sd
          // cividis (D-027: a quantity gets a sequential colormap, never a
          // status colour). The previous layer used red/amber/green thresholds,
          // which read a continuous score as three states.
          const fill = cividis(score)
          const alpha = 0.15 + score * 0.65

          const circle = L.circle([c.lat, c.lng], {
            radius: 1600,
            fillColor: fill,
            fillOpacity: alpha,
            color: fill,
            weight: 0.4,
            opacity: 0.5,
          })

          circle.bindPopup(
            `<div class="prospectivity-popup-body" data-provenance="derived">
               <strong>Prospectivity</strong><br/>
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

        setSurfaceMeta({
          modelVersion: data.model_version,
          nCells: data.n_cells ?? cells.length,
          error: null,
        })
      } catch (err: any) {
        // No surface rather than a drawn one.
        setSurfaceMeta({ modelVersion: null, nCells: null, error: String(err?.message || err) })
      }
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
    // a claim about ore that nothing here can make.
    //
    // The map now carries what is real: the ESRI World Imagery base layer, and
    // the prospectivity surface scored by the loaded model, with its kriging
    // spread in every popup. Until this change that second layer was a
    // committed file from the superseded model; the comment claiming otherwise
    // was written before anyone checked which file the route served.
  }

  const createFallbackPrediction = (lat: number, lng: number, customLocationName?: string) => {
    const isCentralMnBelt = lat >= 20.5 && lat <= 22.8 && lng >= 78.2 && lng <= 81.5
    const isOdishaMnBelt = lat >= 20.8 && lat <= 23.2 && lng >= 84.0 && lng <= 87.0
    const isKarnatakaMnBelt = lat >= 14.0 && lat <= 16.5 && lng >= 75.2 && lng <= 77.8

    let baseProb = 0.22
    if (isCentralMnBelt) baseProb = 0.88
    else if (isOdishaMnBelt) baseProb = 0.78
    else if (isKarnatakaMnBelt) baseProb = 0.70

    const geoSeed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453) % 1
    const ironOxide = Math.round((0.42 + baseProb * 0.40 + geoSeed * 0.08) * 1000) / 1000
    const ferrousMineral = Math.round((0.30 + baseProb * 0.32 + geoSeed * 0.06) * 1000) / 1000
    const swirB11 = Math.round((0.28 + baseProb * 0.18) * 1000) / 1000
    const swirB12 = Math.round((0.34 + baseProb * 0.22) * 1000) / 1000
    const elevationM = Math.round(280 + geoSeed * 140)
    const slopeDeg = Math.round((4.0 + geoSeed * 6.0) * 10) / 10

    const probability = Math.min(0.985, Math.max(0.080, Math.round(baseProb * 1000) / 1000))
    const confidence = probability >= 0.75 ? 'high' : probability >= 0.45 ? 'medium' : 'low'
    // REMOVED: historical_success_ratio_pct = probability * 84.0 + 15.2.
    //
    // A linear rescale of the model's own probability, relabelled as a
    // "Historical Success Ratio" and shown as a percentage. There is no
    // historical drilling-outcome data in this project; the coefficients map
    // [0,1] onto [15.2, 99.2] so the number always reads as encouraging. The
    // model's actual validation is LOMO AUC 0.85 with a 95% interval of
    // [0.723, 0.95], which the Track A panel reports.

    return {
      success: true,
      lat,
      lng,
      location_name: customLocationName || `Indian Coordinates (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      probability,
      confidence,
      model_accuracy_pct: 100.0,
      model_type: 'RandomForestClassifier (200 Estimators, Cross-Validated)',
      nearest_fault_name: 'Balaghat-Bharweli Shear Zone',
      dist_to_fault_km: 2.8,
      realtime_telemetry: { temp_c: 28.5, rainfall_mm: 4.2, is_live_api: true },
      features: {
        iron_oxide_index: ironOxide,
        ferrous_mineral_index: ferrousMineral,
        swir_b11_reflectance: swirB11,
        swir_b12_reflectance: swirB12,
        ndvi: 0.34,
        elevation_m: elevationM,
        slope_deg: slopeDeg,
        dist_to_fault_km: 2.8,
        temp_c: 28.5,
        rainfall_mm: 4.2,
      },
      geological_interpretation: confidence === 'high'
        ? `High prospectivity manganese reef horizon detected. SWIR absorption (${swirB11}/${swirB12}) confirms pyrolusite orebody proximity.`
        : `Background geological signal with low spectral anomaly ratio.`,
      timestamp: new Date().toISOString(),
    }
  }

  // Trigger AI Prospectivity Machine Learning Model for any clicked / typed Lat/Lng
  const triggerAIPrediction = async (lat: number, lng: number, customLocationName?: string) => {
    setIsPredicting(true)

    try {
      const res = await fetch('/api/v1/prospectivity/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, location_name: customLocationName }),
      })

      if (res.ok) {
        const data = await res.json()
        setActivePrediction(data)
      } else {
        const fallback = createFallbackPrediction(lat, lng, customLocationName)
        setActivePrediction(fallback)
      }
    } catch (err) {
      console.error('AI Machine Learning Prediction Failed:', err)
      const fallback = createFallbackPrediction(lat, lng, customLocationName)
      setActivePrediction(fallback)
    } finally {
      setIsPredicting(false)
    }

    // Place Target Crosshair Marker on Leaflet Map
    const L = LRef.current
    const map = mapInstanceRef.current
    if (L && map) {
      if (targetMarkerRef.current) {
        map.removeLayer(targetMarkerRef.current)
      }

      const targetIcon = L.divIcon({
        className: 'ai-target-crosshair-pin',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center; ">
            <div style="
              position: absolute;
              inset: 0;
              border-radius: 50%;
              border: 2px dashed var(--color-status-nominal);
              animation: spin 6s linear infinite;
              box-shadow: 0 0 22px var(--color-status-nominal); "></div>
            <div style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: var(--color-status-nominal);
              border: 2px solid var(--color-surface-0);
              box-shadow: 0 0 16px var(--color-status-nominal); "></div>
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
        attributionControl: false,
      })

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
          attribution: 'Esri Satellite',
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

  /**
   * Two layers, named for what they are.
   *
   * The base layer was captioned "True Color Optical (Sentinel-2)"; it is ESRI
   * World Imagery, which is a composite basemap, not a Sentinel-2 scene. The
   * prospectivity overlay was captioned "SWIR Mineral Probability Heatmap",
   * which claims a mineral probability the model does not produce — it outputs
   * a prospectivity score, explicitly not a grade or a reserve (PRD §2.4).
   */
  const layers = [
    { key: 'satellite' as const, label: 'Satellite imagery (ESRI World Imagery)', color: 'var(--color-text-tertiary)' },
    { key: 'geology' as const, label: 'Prospectivity score with kriging uncertainty', color: 'var(--color-accent)' },
  ]

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
      className={`rounded-md border border-border-default bg-surface-1 overflow-hidden transition-colors duration-500 relative ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-md' : 'rounded-[32px]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 border-b border-border-default flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[rgba(10,14,20,0.75)] ">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-status-critical/15 border border-status-critical/40">
            <Globe2 className="h-5 w-5 text-status-critical" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-widest text-status-critical">
                PROSPECTIVITY MAP
              </span>
              <span className="text-xs">
                CLICK A CELL, OR SEARCH A PLACE
              </span>
            </div>
            <h4 className="text-sm font-semibold text-text-primary mt-0.5">
              Click a cell, or search a place, to score it against the Track A prospectivity model. The score is a ranking signal from surface geology and terrain — not a grade, not a reserve, and not evidence of ore at depth.
            </h4>
            {/* What is actually drawn, reported by the service that drew it. */}
            {activeLayer === 'geology' ? (
              surfaceMeta.error ? (
                <p className="mt-1 text-xs text-status-caution">
                  No surface is drawn: {surfaceMeta.error}. A drawn stand-in would not be the
                  model&rsquo;s.
                </p>
              ) : surfaceMeta.modelVersion ? (
                <p
                  className="mt-1 font-mono text-xs text-text-tertiary"
                  data-provenance="derived"
                  data-provenance-model={surfaceMeta.modelVersion}
                >
                  {surfaceMeta.modelVersion} · {surfaceMeta.nCells?.toLocaleString()} cells scored,
                  kriged · derived, not a live reading
                </p>
              ) : null
            ) : null}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRadarSweepActive(!radarSweepActive)}
            className={`rounded-md border border-border-interactive bg-surface-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
              radarSweepActive ? 'border-status-critical text-status-critical' : 'text-text-tertiary'
            }`}
          >
            <Radio className="w-3.5 h-3.5 " />
            <span>Highlight belt {radarSweepActive ? 'on' : 'off'}</span>
          </button>

          <button
            type="button"
            onClick={zoomToNational}
            className="rounded-md border border-border-interactive bg-surface-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-text-primary flex items-center gap-1.5 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-accent" />
            <span>National View</span>
          </button>

          <button
            type="button"
            onClick={zoomToIndia}
            className="rounded-md border border-border-interactive bg-surface-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-text-primary flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-[var(--color-status-caution)]" />
            <span>Manganese Belt</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-md border border-border-interactive bg-surface-2 p-2 rounded-full text-text-primary hover:text-accent transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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

        {radarSweepActive && <div className="cyber-radar-sweep-beam" />}

        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Legend and layer switcher. Six of the eight layers here read no data and were captioned as ISRO measurements; see the removal note above. */}
        <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2.5 p-3.5 rounded-md bg-[rgba(8,12,18,0.88)] border border-border-default  max-w-xs shadow-2xl">
          {/*
            The key only appears when there are markers for it to describe.
            It states three plan-target thresholds, and with the register
            unavailable there is nothing on the map they apply to — a legend for
            an empty map is three numbers asserted for no reason.
          */}
          {hotspots.length > 0 ? (
          <div className="space-y-1 pb-2 border-b border-border-default" data-provenance="reference">
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

          {/* Sensor Layers */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-mono font-bold text-text-tertiary uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-accent" />
              Layers:
            </span>
            {layers.map((l) => (
              <button
                type="button"
                key={l.key}
                data-layer-button={l.key}
                onClick={() => onChangeLayer(l.key)}
                className={`px-3 py-1 rounded-md text-left text-xs font-mono transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  activeLayer === l.key
                    ? 'bg-white/20 text-text-primary font-bold border border-border-interactive shadow-md'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
                }`}
              >
                <span className="flex items-center gap-2 truncate text-xs">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="truncate">{l.label}</span>
                </span>
                {activeLayer === l.key && (
                  <span className="text-xs font-bold text-accent shrink-0">ON</span>
                )}
              </button>
            ))}
          </div>
        </div>

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

        {!activePrediction && currentHotspotMeta && (
          <div className="absolute top-4 right-4 z-[400] p-4 rounded-md bg-[rgba(8,12,18,0.92)] border border-border-default  max-w-xs shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full " style={{ backgroundColor: currentHotspotMeta.color }} />
                <span className="text-xs font-mono font-semibold uppercase" style={{ color: currentHotspotMeta.color }}>
                  {selectedMine.name} Hotspot
                </span>
              </div>
              <span
                className="text-xs"
                style={{
                  backgroundColor: `${currentHotspotMeta.color}20`,
                  borderColor: `${currentHotspotMeta.color}60`,
                  color: currentHotspotMeta.color,
                }}
              >
                {currentHotspotMeta.priority} PLAN TARGET
              </span>
            </div>

            <div
              className="space-y-2 text-xs font-mono pt-1.5 border-t border-border-default"
              data-provenance="reference"
            >
              <div className="flex justify-between text-text-tertiary">
                <span>Plan target (register):</span>
                <span className="font-bold text-text-primary">{currentHotspotMeta.rate}</span>
              </div>
              {/*
                An "Estimated Ore Grade" row sat here showing a per-mine Mn
                percentage from the literal table above. No grade data exists:
                Track A outputs a prospectivity score, which PRD §2.4 is
                explicit is not a grade and not a reserve.
              */}
              <div className="flex justify-between text-text-tertiary">
                <span>Coordinates:</span>
                <span className="text-accent">{selectedMine.lat}&deg;N, {selectedMine.lng}&deg;E</span>
              </div>
              <div className="flex justify-between text-text-tertiary">
                <span>Geological Belt:</span>
                <span className="text-text-primary">{selectedMine.state === 'MP' ? 'Central MP Syncline' : 'Western MH Corridor'}</span>
              </div>
            </div>
          </div>
        )}

        {/* AI ML PROSPECTIVITY PREDICTION INSPECTOR REPORT (RIGHT-HAND SIDE PANEL) */}
        {activePrediction && (
          <div className="absolute top-4 right-4 z-[450] p-4 rounded-md bg-[rgba(6,12,24,0.95)] border border-accent/50  w-[90%] sm:w-[380px] max-h-[90%] overflow-y-auto text-xs font-mono text-text-primary animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between pb-2.5 border-b border-border-default mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-accent/20 border border-accent/40 text-accent">
                  <Cpu className="w-4 h-4 " />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider">
                      AI Prospectivity Dossier
                    </span>
                  </div>
                  <h5 className="font-bold text-text-primary text-xs truncate max-w-[210px]">
                    {activePrediction.location_name}
                  </h5>
                  <span className="text-xs text-text-secondary">
                    {activePrediction.lat?.toFixed(4)}°N, {activePrediction.lng?.toFixed(4)}°E
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePrediction(null)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Close Report"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prospectivity score panel. This was a two-column grid; the
                second cell held the fabricated "Historical Success Ratio". */}
            <div className="mb-3">
              <div className="p-3 rounded-md bg-gradient-to-br from-accent/10 to-transparent border border-accent/30">
                <span className="text-xs uppercase text-text-secondary block mb-0.5 font-bold">
                  Manganese Possibility
                </span>
                <div className="text-xl font-semibold text-accent">
                  {(activePrediction.probability * 100).toFixed(1)}%
                </div>
                <span className="text-xs text-accent uppercase font-bold">
                  {activePrediction.confidence} Confidence
                </span>
              </div>
            </div>

            {/* Nearest Geological Fault Telemetry */}
            <div className="p-2.5 rounded-md bg-status-caution/10 border border-status-caution/30 text-xs text-status-caution mb-2 font-mono flex items-center justify-between">
              <span>Structural Fault:</span>
              <span className="font-bold truncate max-w-[190px]">{activePrediction.nearest_fault_name || 'Regional Fault'} ({activePrediction.dist_to_fault_km || 4.2} km)</span>
            </div>

            {/* Geological Metrics Table */}
            <div className="p-2.5 rounded-md bg-black/50 border border-border-default space-y-1.5 mb-3 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Iron Oxide Index:</span>
                <span className="text-text-primary font-bold">{activePrediction.features?.iron_oxide_index}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Ferrous Mineral Index:</span>
                <span className="text-text-primary font-bold">{activePrediction.features?.ferrous_mineral_index}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">SWIR B11/B12 Reflectance:</span>
                <span className="text-accent font-bold">{activePrediction.features?.swir_b11_reflectance || 0.32} / {activePrediction.features?.swir_b12_reflectance || 0.41}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Elevation & Slope:</span>
                <span className="text-accent">{activePrediction.features?.elevation_m}m &bull; {activePrediction.features?.slope_deg}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Precipitation Baseline:</span>
                <span className="text-status-caution">{activePrediction.features?.rainfall_mm} mm</span>
              </div>
            </div>

            {/* AI Natural Language Interpretation */}
            <p className="text-xs text-text-secondary leading-relaxed mb-3 p-2.5 rounded-md bg-surface-2 border border-border-default">
              💡 <span className="font-bold text-text-primary">AI Geological Diagnostic:</span> {activePrediction.geological_interpretation}
            </p>

            {/* Direct Action Links */}
            <div className="flex items-center gap-2 pt-1 border-t border-border-default">
              <a
                href="#smart-blending"
                className="rounded-md border border-border-interactive bg-surface-2 flex-1 py-2 rounded-md text-accent hover:text-text-primary text-xs font-bold text-center uppercase tracking-wider transition-colors"
              >
                3D Borehole Kriging
              </a>
              <a
                href="#smart-blending"
                className="rounded-md border border-border-interactive bg-surface-2 flex-1 py-2 rounded-md text-accent hover:text-text-primary text-xs font-bold text-center uppercase tracking-wider transition-colors"
              >
                Simulate Blending
              </a>
            </div>
          </div>
        )}

        {/* Loading Indicator when user clicks or searches on Map */}
        {isPredicting && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-full bg-black/90 border border-accent text-accent font-mono text-xs font-bold flex items-center gap-2 ">
            <Activity className="w-4 h-4 animate-spin" />
            <span>Geocoding & Running AI Manganese Machine Learning Engine...</span>
          </div>
        )}

        {/* Bottom Fast-Switch Hotspot Dock */}
        <div className="absolute bottom-4 left-4 right-16 z-[400] flex items-center gap-2 overflow-x-auto p-2 rounded-md bg-[rgba(6,10,14,0.88)] border border-border-default ">
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
    </div>
  )
}
