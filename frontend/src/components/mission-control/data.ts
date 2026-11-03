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

/*
 * `FALLBACK_MINES` stood here: a register of one mine, Balaghat, with a plan
 * target and a current production figure, which /blending, /method and
 * /mine-twin chose from, and `MOIL_MINES`, an alias the Track A map searched.
 * The selectors read FastAPI's register now (./mine-register), and
 * `npm run lint:mine-register` fails if any file in src/ defines a mine.
 *
 * `fetchMines()` stood here before that. It read /api/admin/mines, which
 * served a JSON file nothing else consumed; it was removed with that route.
 */

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
