import type {
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

export const FALLBACK_MINES: MineInfo[] = [
  { id: 'balaghat', numericId: 1, name: 'Balaghat', code: 'MOIL-BAL-01', state: 'MP', lat: 21.83, lng: 80.19, zone: 'Central India', targetTonnes: 18000, currentProduction: 16800 },
]

/*
 * `fetchMines()` stood here. It read /api/admin/mines, which served a JSON file
 * that nothing else in the system consumed, and it was imported by nobody — the
 * console and /production both use fetchMines from lib/console-api, which
 * proxies FastAPI's register. Removed with that route.
 */

export const MOIL_MINES = FALLBACK_MINES // Kept for synchronous fallback if needed

const API_BASE = '/api/v1'

// `jitter()` (Math.random) was removed: it changed displayed numbers on every
// render, which made synthetic values look like a live feed. Degraded mode
// now shows no values at all.

/**
 * The mine's telemetry from the service layer, or null when there is none.
 *
 * Null covers every failure: the route unreachable from the browser, the
 * service layer unreachable (the route answers 503), or no such mine (404).
 * Callers render that as unavailable. This used to fall back to a payload
 * built in the browser from a hardcoded mine register, which carried a planned
 * tonnage and, for an id not in that register, Balaghat's record (DEF-1).
 */
export async function fetchLiveMineTelemetry(mine: MineInfo): Promise<{
  weather: WeatherSignal
  reserve: ReservePrediction
  forecast: ProductionForecast
  risk: RiskAnalysis
  shap: ShapExplanation
  actions: ActionOrder[]
  audit: AuditRecord
  stacScenes: STACScene[]
} | null> {
  try {
    // DEF-1: `mine.numericId || 1` silently requested mine 1 whenever a mine
    // arrived without a numeric id, returning Balaghat's telemetry under
    // another mine's name. A mine with no numeric id is a register problem and
    // is reported as one.
    const mineId = mine.numericId
    if (!Number.isInteger(mineId) || (mineId as number) <= 0) {
      throw new Error(`Mine ${mine.name} has no numeric id; cannot request telemetry.`)
    }
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
    console.warn('Telemetry unavailable:', err)
  }

  return null
}
