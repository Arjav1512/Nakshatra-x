import { backendUrl } from '@/lib/backend'

/**
 * Figures for the landing page, read from the same artifacts the console reads.
 *
 * The landing page used to assert "LIVE SATELLITE TELEMETRY ACTIVE", "10 Active
 * MOIL Mining Sites" and "ISRO MOSDAC / BHUVAN ACTIVE" as hardcoded strings
 * backed by nothing. Stage 1 removed all of it and left the page with no
 * numbers at all, which was honest but said less than the work supports.
 *
 * So the numbers are back, and none of them is a literal: every one is read
 * from the backend at request time, carries its model version and vintage, and
 * is the *same artifact* the console renders — so the two screens cannot
 * disagree. If the backend is warming or an artifact is missing, the band says
 * so and renders no figure.
 *
 * Server-side on purpose: this is a server component, so the figures are in the
 * HTML rather than appearing after hydration.
 */

export interface LandingEvidence {
  backtest:
    | {
        ok: true
        mineName: string
        mineCode: string
        mineId: number
        mapePct: number
        baselineMapePct: number
        coverage80: number
        nominalCoverage: number
        modelVersion: string
        baselineVersion: string
        computedAt: string | null
        dataWindowEnd: string | null
      }
    | { ok: false; reason: string }
  /**
   * Daily interval coverage across all ten mines, from the calibration
   * artifact the console reads. The pilot's coverage alone reads better than
   * the portfolio's, and must not be generalised from (DECISIONS.md D-044).
   */
  dailyCalibration:
    | {
        ok: true
        coverage80: number
        ci95: [number, number]
        nominal: number
        nPredictions: number
        nOriginDates: number
        modelVersion: string
        generatedAt: string | null
      }
    | { ok: false; reason: string }
  trackA:
    | {
        ok: true
        auc: number
        ci: [number, number]
        nOutOfFold: number
        modelVersion: string
        validation: string
      }
    | { ok: false; reason: string }
}

/** The pilot mine: the one with a committed rolling-origin backtest. */
export const PILOT_MINE = { id: 1, name: 'Balaghat', code: 'MOIL-BAL-01' }

async function get(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${backendUrl()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function loadLandingEvidence(): Promise<LandingEvidence> {
  const [bt, metrics, cal] = await Promise.all([
    get(`/api/v1/mines/${PILOT_MINE.id}/backtest`),
    get('/api/v1/prospectivity/metrics'),
    get(`/api/v1/calibration/cumulative?mine_code=${PILOT_MINE.code}`),
  ])
  const daily = cal?.status === 'ok' ? cal.daily?.portfolio : null

  return {
    backtest:
      bt && bt.model
        ? {
            ok: true,
            mineName: PILOT_MINE.name,
            mineCode: PILOT_MINE.code,
            mineId: PILOT_MINE.id,
            mapePct: bt.model.mape_pct,
            baselineMapePct: bt.baseline.mape_pct,
            coverage80: bt.model.coverage_80,
            nominalCoverage: bt.nominal_coverage,
            modelVersion: bt.model_version,
            baselineVersion: bt.baseline_version,
            computedAt: bt.computed_at ?? null,
            dataWindowEnd: bt.data_window_end ?? null,
          }
        : { ok: false, reason: 'The backtest artifact could not be read from the service layer.' },
    dailyCalibration:
      daily && cal.nominal_coverage != null
        ? {
            ok: true,
            coverage80: daily.coverage_80,
            ci95: daily.coverage_80_ci95,
            nominal: cal.nominal_coverage,
            nPredictions: daily.n_predictions,
            nOriginDates: daily.n_origin_dates,
            modelVersion: cal.model_version,
            generatedAt: cal.generated_at ?? null,
          }
        : {
            ok: false,
            reason:
              cal?.status === 'stale'
                ? 'The calibration was measured on a different model, so its figure is not shown.'
                : 'The calibration artifact could not be read from the service layer.',
          },
    trackA:
      metrics && metrics.lomo
        ? {
            ok: true,
            auc: metrics.lomo.auc,
            ci: metrics.lomo.auc_ci95,
            nOutOfFold: metrics.lomo.n_out_of_fold,
            modelVersion: metrics.model_version,
            validation: metrics.validation,
          }
        : { ok: false, reason: 'Track A validation metrics could not be read.' },
  }
}
