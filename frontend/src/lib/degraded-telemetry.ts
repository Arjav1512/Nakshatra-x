import { dataIntegrity } from '@/lib/provenance'
import { operatingDay } from '@/lib/synthetic'

/**
 * Degraded telemetry payload, used when the FastAPI service layer is
 * unreachable.
 *
 * PRD N-6: "Degrades gracefully when a data source is stale or missing —
 * states staleness, does not silently extrapolate."
 *
 * No recommendation is issued, because a recommendation that has not been
 * constraint-checked against real inputs is worse than none (PRD C-5). Scene
 * identifiers are never fabricated, so the list is empty.
 *
 * WHAT CHANGED, AND WHY
 * ---------------------
 * The weather block used to be *generated*: `boundedNormal(85, 25, 0, 320)`
 * produced a per-mine rainfall figure, and the risk scores were computed from
 * it. The payload labelled itself honestly (`is_synthetic: true`), but a number
 * invented in the browser is not a degraded reading of anything — nobody can
 * act on it, and it sits exactly where "we could not reach the service layer"
 * belongs. It also made the offline provenance run unanswerable: values kept
 * appearing with no data source anywhere.
 *
 * The readings are `null` now. The shape, the labels and the explanation stay,
 * so every card says what it would have shown and why it cannot. That is what
 * PRD N-6 asks for: state staleness, do not silently extrapolate.
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

  // No generated readings. See the note above.
  const dailyTarget = mine.targetTonnes / 30
  const planned = Math.round(dailyTarget * 14)

  return {
    mine: { ...mine, numericId: mineId, currentProduction: null },
    weather: {
      rainfall_14d_mm: null,
      soil_moisture_pct: null,
      land_surface_temp_c: null,
      humidity_pct: null,
      forecast_rain_next_3d_mm: null,
      live_precipitation_rate_mm_hr: null,
      updated_at: new Date().toISOString(),
      source: 'Service layer unreachable — no reading was obtained.',
      is_live: false,
      is_synthetic: false,
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
      model: 'unavailable',
      horizon_days: 14,
      // `total_planned_tonnes` is the register's own plan target pro-rated over
      // the horizon — a stated intention, not a reading, so it survives. Every
      // prediction below it came from the generated drag model and is gone.
      total_planned_tonnes: planned,
      total_predicted_tonnes: null,
      projected_shortfall_tonnes: null,
      shortfall_percentage: null,
      risk_level: null,
      current_daily_rate_t: null,
      drag_factors: {
        weather_drag_pct: null,
        equipment_downtime_drag_pct: null,
        blasting_delay_drag_pct: null,
      },
      trajectory: [],
    },
    risk: {
      composite_risk_score: null,
      risk_status: null,
      rainfall_risk_score: null,
      equipment_risk_score: null,
      blasting_risk_score: null,
      stockpile_risk_score: null,
      predicted_shortfall_tonnes: null,
      live_downtime_hours: null,
    },
    shap: {
      explainer: 'unavailable',
      composite_risk_score: null,
      base_value: 0,
      // An attribution of a score that was not computed explains nothing.
      waterfall_features: [],
      causal_chains: [],
      primary_driver: null,
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
    // No envelopes: there are no values to carry provenance for. Two used to
    // sit here describing seeded draws as though a draw were an observation.
    provenance: {},
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
