export type MineInfo = {
  id: string
  numericId?: number
  name: string
  code: string
  state: 'MP' | 'MH'
  lat: number
  lng: number
  zone: string
  targetTonnes: number
  currentProduction: number
}

export type WeatherSignal = {
  /** True only when fetched live from the upstream weather API this request. */
  is_live?: boolean
  /** True when the value came from the seeded synthetic generator. */
  is_synthetic?: boolean
  rainfall_14d_mm: number
  soil_moisture_pct: number
  land_surface_temp_c: number
  humidity_pct?: number
  forecast_rain_next_3d_mm?: number
  updated_at?: string
  source?: string
  live_precipitation_rate_mm_hr?: number
}

// `null` means "not available" — the UI must render an explicit absence
// rather than a placeholder number. Several fields became nullable when
// hardcoded grades, depths and confidence figures were removed.
export type ReservePrediction = {
  model: string
  confidence_score: number | null
  category: 'PRIORITY_VALIDATION' | 'INVESTIGATE' | 'MONITOR' | 'DECISION_SUPPORT_ONLY'
  recommendation: string
  estimated_ore_grade: string | null
  prospect_depth_m: string | null
  feature_contributions: Record<string, number>
  requires_drilling_validation: boolean
  spectral_reflectance_bands?: Array<{
    band: string
    wavelength_um: string
    reflectance: number
    anomaly_threshold: number
  }>
  ndvi_trend_14d?: Array<{
    day: string
    ndvi: number
    swir_ratio: number
  }>
}

export type ProductionForecast = {
  model: string
  horizon_days: number
  total_planned_tonnes: number
  total_predicted_tonnes: number
  projected_shortfall_tonnes: number
  shortfall_percentage: number
  risk_level: 'CRITICAL' | 'MODERATE' | 'NOMINAL'
  current_daily_rate_t: number
  drag_factors: {
    weather_drag_pct: number
    equipment_downtime_drag_pct: number
    blasting_delay_drag_pct: number
  }
  trajectory: Array<{
    day_index: number
    date: string
    planned_tonnes: number
    predicted_tonnes: number
    shortfall_tonnes: number
    efficiency_pct: number
  }>
}

export type RiskAnalysis = {
  composite_risk_score: number
  risk_status: 'ELEVATED' | 'WATCH' | 'LOW'
  rainfall_risk_score: number
  equipment_risk_score: number
  blasting_risk_score: number
  stockpile_risk_score: number | null
  predicted_shortfall_tonnes: number
  live_downtime_hours: number
}

export type ShapExplanation = {
  explainer: string
  composite_risk_score: number
  base_value: number
  waterfall_features: Array<{
    feature: string
    shap_value: number
    is_base?: boolean
    is_positive?: boolean
  }>
  causal_chains: Array<{
    cause: string
    intermediate: string
    impact: string
    remedy: string
  }>
  primary_driver: string
}

export type ActionOrder = {
  id: string
  title: string
  type: 'DRAINAGE' | 'EQUIPMENT' | 'BLASTING' | 'DISPATCH' | 'MONITORING' | 'NONE'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'STANDARD' | 'INFO'
  reason: string
  impact: string
  status: 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'DISPATCHED' | 'PROPOSED' | 'INFO'
  /** Why this action was proposed — rule, model term, or constraint check. */
  basis?: string
  estimated_recovery_tonnes?: number
}

export type STACScene = {
  scene_id: string
  satellite: string
  acquisition_date: string
  cloud_cover_pct: number
  data_quality: 'high' | 'medium' | 'low'
  band_proxies: {
    ndvi: number
    swir_anomaly: number
    thermal_lst: number
  }
}

export type AuditRecord = {
  satellite_source: string
  model_version: string
  geologist_review_status: string
  last_evaluated: string
}
