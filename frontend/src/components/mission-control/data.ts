import {
  MineInfo,
  WeatherSignal,
  ReservePrediction,
  ProductionForecast,
  RiskAnalysis,
  ShapExplanation,
  ActionOrder,
  AuditRecord,
  STACScene,
} from './types'
import { mineStream, operatingDay, round } from '@/lib/synthetic'

export const FALLBACK_MINES: MineInfo[] = [
  { id: 'balaghat', numericId: 1, name: 'Balaghat', code: 'MOIL-BAL-01', state: 'MP', lat: 21.83, lng: 80.19, zone: 'Central India', targetTonnes: 18000, currentProduction: 16800 },
]

export async function fetchMines(): Promise<MineInfo[]> {
  try {
    const res = await fetch('/api/admin/mines', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      return Object.values(data)
    }
  } catch (err) {
    console.warn('Failed to fetch dynamic mines:', err)
  }
  return FALLBACK_MINES
}

export const MOIL_MINES = FALLBACK_MINES // Kept for synchronous fallback if needed

const API_BASE = '/api/v1'

// `jitter()` (Math.random) was removed: it changed displayed numbers on every
// render, which made synthetic values look like a live feed. Degraded-mode
// values are now deterministic and explicitly flagged.

export async function fetchLiveMineTelemetry(mine: MineInfo): Promise<{
  weather: WeatherSignal
  reserve: ReservePrediction
  forecast: ProductionForecast
  risk: RiskAnalysis
  shap: ShapExplanation
  actions: ActionOrder[]
  audit: AuditRecord
  stacScenes: STACScene[]
}> {
  try {
    const mineId = mine.numericId || 1
    const res = await fetch(`${API_BASE}/mines/${mineId}/telemetry`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      return {
        weather: data.weather,
        reserve: data.reserve,
        forecast: data.forecast,
        risk: data.risk,
        shap: data.shap,
        actions: data.actions,
        audit: data.audit,
        stacScenes: data.stacScenes,
      }
    }
  } catch (err) {
    console.warn('Telemetry API fallback activated:', err)
  }

  return getFallbackTelemetry(mine)
}

function getFallbackTelemetry(mine: MineInfo) {
  /**
   * Degraded mode: the telemetry API could not be reached.
   *
   * This previously returned invented model names, fabricated Sentinel/Landsat
   * scene identifiers, hardcoded ore grades and randomised "SHAP" values —
   * indistinguishable in the UI from real output. It now returns a small,
   * deterministic, explicitly synthetic payload and says so.
   */
  const day = operatingDay()
  const ops = mineStream(mine.id, 'fallback', day)
  const rainfall = round(ops.boundedNormal(mine.state === 'MP' ? 85 : 60, 25, 0, 320), 1)
  const downtime = round(ops.boundedNormal(9, 4, 0, 40), 1)

  const weatherDrag = rainfall > 60 ? Math.min(0.35, (rainfall / 150) * 0.35) : 0.02
  const downtimeDrag = Math.min(0.3, (downtime / 40) * 0.3)
  const totalDrag = Math.min(0.55, weatherDrag + downtimeDrag)
  const shortfallPct = round(totalDrag * 100, 1)
  const dailyTarget = mine.targetTonnes / 30
  const planned = Math.round(dailyTarget * 14)
  const predicted = Math.round(planned * (1 - totalDrag))

  return {
    weather: {
      rainfall_14d_mm: rainfall,
      soil_moisture_pct: round(ops.boundedNormal(34, 7, 3, 60), 1),
      land_surface_temp_c: round(ops.boundedNormal(31, 3, 12, 48), 1),
      humidity_pct: Math.round(ops.boundedNormal(62, 12, 10, 100)),
      forecast_rain_next_3d_mm: round(ops.boundedNormal(14, 8, 0, 120), 1),
      live_precipitation_rate_mm_hr: 0,
      updated_at: new Date().toISOString(),
      source: 'SYNTHETIC FALLBACK — telemetry API unreachable. Not observed data.',
      is_live: false,
      is_synthetic: true,
    },
    reserve: {
      mine_id: mine.numericId,
      model: 'unavailable',
      confidence_score: null,
      category: 'DECISION_SUPPORT_ONLY' as const,
      recommendation: 'Prospectivity unavailable in degraded mode.',
      estimated_ore_grade: null,
      prospect_depth_m: null,
      feature_contributions: {},
      requires_drilling_validation: true,
      spectral_reflectance_bands: [],
      ndvi_trend_14d: [],
    },
    forecast: {
      model: 'nakshatra-drag-model-v1 (degraded, synthetic inputs)',
      horizon_days: 14,
      total_planned_tonnes: planned,
      total_predicted_tonnes: predicted,
      projected_shortfall_tonnes: Math.max(0, planned - predicted),
      shortfall_percentage: shortfallPct,
      risk_level:
        shortfallPct >= 20 ? ('CRITICAL' as const) : shortfallPct >= 10 ? ('MODERATE' as const) : ('NOMINAL' as const),
      current_daily_rate_t: Math.round(dailyTarget * (1 - totalDrag)),
      drag_factors: {
        weather_drag_pct: round(weatherDrag * 100, 1),
        equipment_downtime_drag_pct: round(downtimeDrag * 100, 1),
        blasting_delay_drag_pct: 0,
      },
      trajectory: Array.from({ length: 14 }, (_, i) => ({
        day_index: i + 1,
        date: `Day ${i + 1}`,
        planned_tonnes: Math.round(dailyTarget),
        predicted_tonnes: Math.round(dailyTarget * (1 - totalDrag)),
        shortfall_tonnes: Math.round(dailyTarget * totalDrag),
        efficiency_pct: round((1 - totalDrag) * 100, 1),
      })),
    },
    risk: {
      composite_risk_score: round(Math.min(98, totalDrag * 160 + 8), 1),
      risk_status: totalDrag > 0.3 ? ('ELEVATED' as const) : ('WATCH' as const),
      rainfall_risk_score: round(Math.min(100, (weatherDrag / 0.35) * 100), 1),
      equipment_risk_score: round(Math.min(100, (downtimeDrag / 0.3) * 100), 1),
      blasting_risk_score: 0,
      stockpile_risk_score: null,
      predicted_shortfall_tonnes: Math.max(0, planned - predicted),
      live_downtime_hours: downtime,
    },
    shap: {
      explainer: 'additive-driver-attribution-v1 (exact linear decomposition, not SHAP)',
      composite_risk_score: round(Math.min(98, totalDrag * 160 + 8), 1),
      base_value: 0,
      waterfall_features: [
        { feature: `14-day rainfall (${rainfall} mm, synthetic)`, shap_value: round(weatherDrag * 100, 1), is_positive: true },
        { feature: `Equipment downtime (${downtime} h/week, synthetic)`, shap_value: round(downtimeDrag * 100, 1), is_positive: true },
      ],
      causal_chains: [],
      primary_driver: weatherDrag >= downtimeDrag ? 'Rainfall (synthetic)' : 'Equipment downtime (synthetic)',
    },
    actions: [
      {
        id: `act-${mine.id}-degraded`,
        title: 'Telemetry unavailable — no recommendation issued',
        type: 'NONE' as const,
        priority: 'INFO' as const,
        reason: 'The telemetry API could not be reached, so no constraint-checked action can be proposed.',
        impact: 'None.',
        status: 'INFO' as const,
        estimated_recovery_tonnes: 0,
      },
    ],
    audit: {
      satellite_source: 'none — no scene query performed in degraded mode',
      model_version: 'nakshatra-drag-model-v1 (degraded)',
      geologist_review_status: 'NOT_REVIEWED',
      last_evaluated: new Date().toISOString(),
    },
    // Scene identifiers are never fabricated. In degraded mode there are none.
    stacScenes: [],
  }
}
