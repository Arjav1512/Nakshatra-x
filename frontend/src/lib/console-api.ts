/**
 * Console data layer.
 *
 * Every call goes to a Next.js proxy, which forwards to the FastAPI service
 * layer. There is no mock path: a failure returns `{ok:false, error}` and the
 * UI renders "unavailable" with the reason, per PRD N-6.
 */

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; warming?: WarmingInfo; noBacktest?: NoBacktestInfo }

/**
 * A 503 that means "computing", not "broken".
 *
 * FEATURE_BACKLOG B-2 recorded that the two were indistinguishable: every
 * failure collapsed to one message, so a cold backend reported the same thing
 * as a broken one. The backend now answers cold forecasts with
 * {status: "warming", eta_seconds} and a Retry-After header.
 */
export interface NoBacktestInfo {
  mine_code: string
  pilots: { mine_code: string; mine_id: number | null; name: string }[]
  detail: string
  note: string
}

export interface WarmingInfo {
  mine_code: string
  eta_seconds: number
  queued_ahead: number
  detail: string
}

async function get<T>(path: string, timeoutMs = 60000): Promise<Result<T>> {
  try {
    const res = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      if (res.status === 503 && body?.status === 'warming') {
        return {
          ok: false,
          status: 503,
          error: String(body.detail || 'warming'),
          warming: {
            mine_code: String(body.mine_code ?? ''),
            eta_seconds: Number(body.eta_seconds ?? 0),
            queued_ahead: Number(body.queued_ahead ?? 0),
            detail: String(body.detail ?? ''),
          },
        }
      }
      if (res.status === 404 && body?.status === 'no_backtest') {
        return { ok: false, status: 404, error: String(body.detail || ''), noBacktest: body as NoBacktestInfo }
      }
      const detail =
        (body && (body.note || body.detail || body.error)) || `request failed (${res.status})`
      return { ok: false, error: String(detail), status: res.status }
    }
    return { ok: true, data: body as T }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'network error', status: 0 }
  }
}

// ---- Mines (portfolio level) ----------------------------------------------

export interface MineRow {
  id: number
  mine_code: string
  name: string
  state: string
  latitude: number
  longitude: number
  zone: string
  target_tonnes: number
}

export const fetchMines = () => get<MineRow[]>('/api/v1/mines')

// ---- Track B ---------------------------------------------------------------

export interface ShortfallBlock {
  p_shortfall: number
  expected_cumulative_tonnes: number
  p10_cumulative_tonnes: number
  p90_cumulative_tonnes: number
  target_tonnes: number
  expected_shortfall_tonnes: number
  method: string
  assumption: string
}

export interface GradeForecast {
  grade: string
  plan_target_tonnes: number
  shortfall: ShortfallBlock
  baseline_cumulative_tonnes: number
  trajectory: Array<{
    horizon_days: number
    date: string
    p10_tonnes: number
    median_tonnes: number
    p90_tonnes: number
    baseline_tonnes: number
  }>
}

export interface ForecastResponse {
  mine_code: string
  model_version: string
  baseline_version: string
  forecast_origin: string
  window: { start: string; end: string }
  horizon_days: number
  interval: { nominal_coverage: number; quantiles: number[] }
  grades: GradeForecast[]
  portfolio: {
    plan_target_tonnes: number
    expected_cumulative_tonnes: number
    expected_shortfall_tonnes: number
  }
  provenance: Record<string, any>
  /** Set when the response came from a persisted artifact rather than memory. */
  served_from?: string
  artifact_age_hours?: number
  artifact_stale?: boolean
  vintage?: string
  artifact_identity?: { model_version: string; generator_seed: number; code_fingerprint: string }
  data_integrity: any
  guardrail: string
}

export interface BacktestResponse {
  model_version: string
  baseline_version: string
  n_origins: number
  n_predictions: number
  horizons: number[]
  model: Record<string, number>
  baseline: Record<string, number>
  by_horizon: Array<Record<string, number>>
  window: Record<string, any>
  verdict: string
  nominal_coverage: number
  note: string
  /** When the batch job produced this artifact. */
  computed_at?: string
  artifact_age_hours?: number | null
}

export interface ActionRow {
  id: string
  action_type: string
  mine_code: string
  description: string
  expected_recovery_tonnes: number
  constraint_check: {
    feasible: boolean
    checks_passed: string[]
    violations: Array<{ rule: string; detail: string }>
    engine_version: string
  }
  expected_effect?: {
    recovery_tonnes: number
    delta_shortfall_probability: number
    assumptions: string[]
  }
}

export interface RecommendationsResponse {
  mine_code: string
  forecast_origin: string
  expected_shortfall_tonnes: number
  max_grade_shortfall_probability: number
  approved_actions: ActionRow[]
  rejected_actions: ActionRow[]
  constraint_engine: {
    version: string
    enforced_not_learned: boolean
    scope: string[]
    excluded: string[]
  }
  guardrail: string
}

export const fetchForecast = (mineId: number, horizon = 14) =>
  get<ForecastResponse>(`/api/v1/mines/${mineId}/forecast?horizon_days=${horizon}`)

export const fetchBacktest = (mineId: number) =>
  get<BacktestResponse>(`/api/v1/mines/${mineId}/backtest`, 600000)

export const fetchRecommendations = (mineId: number, horizon = 14) =>
  get<RecommendationsResponse>(`/api/v1/mines/${mineId}/recommendations?horizon_days=${horizon}`)

export const fetchTelemetry = (mineId: number) =>
  get<any>(`/api/v1/mines/${mineId}/telemetry`)

// ---- Track A ---------------------------------------------------------------

export interface DrillTarget {
  rank: number
  lat: number
  lng: number
  prospectivity_score: number
  uncertainty_sd: number
  information_gain: number
  evidence: string
}

export interface DrillTargetsResponse {
  model_version: string
  ranked_by: string
  targets: DrillTarget[]
  highest_information_gain: DrillTarget[]
  information_gain_note: string
  n_candidates: number
  n_observations: number
  validation: Record<string, any>
  guardrails: Record<string, string>
}

export interface TrackAMetrics {
  model_version: string
  validation: string
  lomo: {
    auc: number
    average_precision: number
    base_rate: number
    auc_ci95: [number, number]
    n_out_of_fold: number
    per_fold: any[]
  }
  n_samples: number
  ablation_lomo_auc: Record<string, number>
  random_split_auc_for_contrast: number
  feature_importance: Record<string, number>
  features: string[]
  honest_note: string
  guardrail: string
  lithology_note: string
  ablation_note: string
}

export const fetchDrillTargets = (topN = 8) =>
  get<DrillTargetsResponse>(`/api/v1/prospectivity/drill-targets?top_n=${topN}`)

export const fetchTrackAMetrics = () => get<TrackAMetrics>('/api/v1/prospectivity/metrics')

export async function predictPoint(lat: number, lng: number, live = false): Promise<Result<any>> {
  try {
    const res = await fetch('/api/v1/prospectivity/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, live }),
      signal: AbortSignal.timeout(live ? 90000 : 20000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: String(body?.note || body?.error || res.status), status: res.status }
    }
    return { ok: true, data: body }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'network error', status: 0 }
  }
}
