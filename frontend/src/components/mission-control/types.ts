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
  currentProduction: number | null
}

// `null` means "not supplied by the active source" and must render as an
// explicit absence, never as 0 or a placeholder (PRD N-6). NASA POWER daily
// point data carries no soil moisture, NDVI or forecast rainfall, so those
// fields are null until the Phase 5 raster pipeline supplies them.
export type WeatherSignal = {
  /** True only when fetched live from the upstream weather API this request. */
  is_live?: boolean
  /** True when the value came from the seeded synthetic generator. */
  is_synthetic?: boolean
  /** Null when no reading was obtained — degraded mode does not invent one. */
  rainfall_14d_mm: number | null
  soil_moisture_pct: number | null
  land_surface_temp_c: number | null
  humidity_pct?: number | null
  forecast_rain_next_3d_mm?: number | null
  updated_at?: string
  source?: string
  live_precipitation_rate_mm_hr?: number | null
  note?: string
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
  total_predicted_tonnes: number | null
  projected_shortfall_tonnes: number | null
  shortfall_percentage: number | null
  risk_level: 'CRITICAL' | 'MODERATE' | 'NOMINAL' | null
  current_daily_rate_t: number | null
  drag_factors: {
    weather_drag_pct: number | null
    equipment_downtime_drag_pct: number | null
    blasting_delay_drag_pct: number | null
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
  composite_risk_score: number | null
  risk_status: 'ELEVATED' | 'WATCH' | 'LOW' | null
  rainfall_risk_score: number | null
  equipment_risk_score: number | null
  blasting_risk_score: number | null
  stockpile_risk_score: number | null
  predicted_shortfall_tonnes: number | null
  live_downtime_hours: number | null
}

export type ShapExplanation = {
  explainer: string
  composite_risk_score: number | null
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
  primary_driver: string | null
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

/**
 * The six layers the Track A map (IndiaSatelliteMap) has, each backed by a
 * service that says where it came from.
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
