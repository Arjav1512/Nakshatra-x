import { dataIntegrity, synthetic } from '@/lib/provenance'
import { SYNTHETIC_CALIBRATION, mineStream, operatingDay, round } from '@/lib/synthetic'

/**
 * Degraded telemetry payload, used when the FastAPI service layer is
 * unreachable.
 *
 * PRD N-6: "Degrades gracefully when a data source is stale or missing —
 * states staleness, does not silently extrapolate."
 *
 * Everything here is deterministic and explicitly synthetic. No recommendation
 * is issued, because a recommendation that has not been constraint-checked
 * against real inputs is worse than none (PRD C-5). Scene identifiers are
 * never fabricated, so the list is empty.
 */

const MINE_REGISTER: Record<number, { id: string; name: string; code: string; state: string; lat: number; lng: number; zone: string; targetTonnes: number }> = {
  1: { id: 'balaghat', name: 'Balaghat', code: 'MOIL-BAL-01', state: 'MP', lat: 21.83, lng: 80.19, zone: 'Central India', targetTonnes: 18000 },
  2: { id: 'bharweli', name: 'Bharweli', code: 'MOIL-BHR-02', state: 'MP', lat: 21.86, lng: 80.26, zone: 'Central India', targetTonnes: 14500 },
  3: { id: 'ukwa', name: 'Ukwa', code: 'MOIL-UKW-03', state: 'MP', lat: 21.93, lng: 80.52, zone: 'Central India', targetTonnes: 9800 },
  4: { id: 'tirodi', name: 'Tirodi', code: 'MOIL-TIR-04', state: 'MP', lat: 22.16, lng: 79.68, zone: 'Central India', targetTonnes: 11200 },
  5: { id: 'dongri-buzurg', name: 'Dongri Buzurg', code: 'MOIL-DON-05', state: 'MH', lat: 20.99, lng: 79.34, zone: 'Western Belt', targetTonnes: 12000 },
  6: { id: 'chikla', name: 'Chikla', code: 'MOIL-CHK-06', state: 'MH', lat: 21.30, lng: 79.66, zone: 'Western Belt', targetTonnes: 10800 },
  7: { id: 'mansar', name: 'Mansar', code: 'MOIL-MAN-07', state: 'MH', lat: 21.44, lng: 79.25, zone: 'Western Belt', targetTonnes: 12500 },
  8: { id: 'kandri', name: 'Kandri', code: 'MOIL-KAN-08', state: 'MH', lat: 21.38, lng: 79.32, zone: 'Western Belt', targetTonnes: 9300 },
  9: { id: 'gumgaon', name: 'Gumgaon', code: 'MOIL-GUM-09', state: 'MH', lat: 21.33, lng: 79.03, zone: 'Western Belt', targetTonnes: 10200 },
  10: { id: 'beldongri', name: 'Beldongri', code: 'MOIL-BEL-10', state: 'MH', lat: 21.16, lng: 79.18, zone: 'Western Belt', targetTonnes: 8600 },
}

export function degradedTelemetry(mineId: number, backendError: string) {
  const mine = MINE_REGISTER[mineId] || MINE_REGISTER[1]
  const day = operatingDay()
  const s = mineStream(mine.id, 'degraded', day)

  const rainfall = round(s.boundedNormal(mine.state === 'MP' ? 85 : 60, 25, 0, 320), 1)
  const downtime = round(s.boundedNormal(9, 4, 0, 40), 1)

  const weatherDrag = rainfall > 60 ? Math.min(0.35, (rainfall / 150) * 0.35) : 0.02
  const downtimeDrag = Math.min(0.3, (downtime / 40) * 0.3)
  const totalDrag = Math.min(0.55, weatherDrag + downtimeDrag)
  const shortfallPct = round(totalDrag * 100, 1)
  const dailyTarget = mine.targetTonnes / 30
  const planned = Math.round(dailyTarget * 14)
  const predicted = Math.round(planned * (1 - totalDrag))

  return {
    mine: { ...mine, numericId: mineId, currentProduction: null },
    weather: {
      rainfall_14d_mm: rainfall,
      soil_moisture_pct: null,
      land_surface_temp_c: round(s.boundedNormal(31, 3, 12, 48), 1),
      humidity_pct: Math.round(s.boundedNormal(62, 12, 10, 100)),
      forecast_rain_next_3d_mm: null,
      live_precipitation_rate_mm_hr: null,
      updated_at: new Date().toISOString(),
      source: 'SYNTHETIC FALLBACK — service layer unreachable. Not observed data.',
      is_live: false,
      is_synthetic: true,
    },
    reserve: {
      mine_id: mineId,
      model: 'unavailable',
      requires_drilling_validation: true,
      category: 'DECISION_SUPPORT_ONLY' as const,
      confidence_score: null,
      estimated_ore_grade: null,
      prospect_depth_m: null,
      recommendation: 'Prospectivity unavailable in degraded mode.',
      feature_contributions: {},
      spectral_reflectance_bands: [],
      ndvi_trend_14d: [],
      note: 'Not a UNFC or statutory reserve statement (PRD 2.4).',
    },
    forecast: {
      model: 'nakshatra-drag-model-v1 (degraded, synthetic inputs)',
      horizon_days: 14,
      total_planned_tonnes: planned,
      total_predicted_tonnes: predicted,
      projected_shortfall_tonnes: Math.max(0, planned - predicted),
      shortfall_percentage: shortfallPct,
      risk_level: shortfallPct >= 20 ? ('CRITICAL' as const) : shortfallPct >= 10 ? ('MODERATE' as const) : ('NOMINAL' as const),
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
        title: 'Service layer unavailable — no recommendation issued',
        type: 'NONE' as const,
        priority: 'INFO' as const,
        reason: 'The FastAPI service layer could not be reached, so no constraint-checked action can be proposed.',
        impact: 'None.',
        status: 'INFO' as const,
        basis: 'Degraded mode.',
      },
    ],
    audit: {
      satellite_source: 'none — no scene query performed in degraded mode',
      model_version: 'nakshatra-drag-model-v1 (degraded)',
      geologist_review_status: 'NOT_REVIEWED',
      last_evaluated: new Date().toISOString(),
    },
    // Scene identifiers are never fabricated.
    stacScenes: [],
    stac_status: { queried: false, ok: false, source: null, error: 'degraded mode', queried_at: new Date().toISOString() },
    provenance: {
      'weather.rainfall_14d_mm': synthetic(rainfall, 'mm', 'Synthetic fallback (service layer unreachable)', {
        model_version: 'synthetic-ops-v1',
        method: `Seeded draw, stream "${mine.id}|degraded|${day}".`,
      }),
      'risk.live_downtime_hours': synthetic(downtime, 'hours/week', SYNTHETIC_CALIBRATION.note, {
        model_version: 'synthetic-ops-v1',
      }),
    },
    data_integrity: dataIntegrity({
      containsSynthetic: true,
      liveOk: false,
      degradedReason: `FastAPI service layer unreachable: ${backendError}`,
      stalenessSeconds: null,
    }),
    served_by: 'nextjs-degraded-fallback',
    server_time: new Date().toISOString(),
  }
}
