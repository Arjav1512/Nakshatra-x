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
import { degradedTelemetry } from '@/lib/degraded-telemetry'

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
    console.warn('Telemetry API fallback activated:', err)
  }

  return getFallbackTelemetry(mine)
}

/**
 * Client-side last resort: the Next.js route itself was unreachable (offline,
 * network error). The route's own degraded payload covers the backend being
 * down, so this only fires when the browser cannot reach the app at all.
 *
 * This previously held a third copy of the drag model, alongside the FastAPI
 * implementation and the route's degraded path. It now delegates to the single
 * shared degraded builder.
 */
function getFallbackTelemetry(mine: MineInfo) {
  // Degraded mode keeps the mine's own id so the payload is not attributed to
  // a different mine; -1 marks "unidentified" rather than defaulting to 1.
  const id = mine.numericId
  return degradedTelemetry(
    typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : -1,
    'Next.js route unreachable from the browser'
  )
}
