'use client'

import { useEffect, useState } from 'react'
import { DOCS_BASE, coverageVerdict } from '@/lib/calibration'

/**
 * How far to trust the daily bands, shown beside them.
 *
 * This panel used to say how far to trust P(shortfall), from the 14-day total's
 * calibration. P(shortfall) is withdrawn from the screen (docs/DECISIONS.md
 * D-044), and with it the figure describing its distribution. What the console
 * presents now is expected shortfall with the daily 80% intervals in the chart,
 * so this measures those intervals: the share of real daily production that
 * fell inside them, across all ten mines and for the mine on screen.
 *
 * Every number here is read from the calibration artifact through the API,
 * which carries the identity of the model it measured. Nothing is typed into
 * this component: a coverage figure in copy would outlive the model it
 * described. If the service is down, or the artifact was measured on a
 * different model, this says so and shows no figure.
 *
 * The verdict is computed, not written: it depends on whether the interval
 * excludes nominal, so a mine whose point estimate is low but whose interval
 * still contains 0.80 is described as consistent at that sample size rather
 * than as miscalibrated.
 */
type DailyStat = {
  coverage_80: number
  coverage_80_ci95: [number, number]
  mape_pct: number
  n_predictions: number
  n_origin_dates: number
}

type CalibrationResponse = {
  status: 'ok' | 'stale' | 'unavailable'
  reason?: string
  error?: string
  nominal_coverage?: number
  /** Confidence level of the intervals, from the artifact. */
  ci_level?: number | null
  model_version?: string
  /** Absent from artifacts measured before the harness recorded daily figures. */
  daily?: {
    quantity: string
    horizons_days: number[]
    portfolio: DailyStat
    mine: DailyStat | null
  } | null
  doc?: string
  generated_at?: string
}

function fmt(x: number) {
  return x.toFixed(3)
}

function Line({ label, s, nominal }: { label: string; s: DailyStat; nominal: number }) {
  const v = coverageVerdict(s.coverage_80_ci95, nominal)
  return (
    <p className="leading-snug">
      <span className="text-text-secondary">{label}: </span>
      <span className="font-mono tabular-nums text-text-primary">{fmt(s.coverage_80)}</span>{' '}
      <span className="font-mono tabular-nums text-text-tertiary">
        [{fmt(s.coverage_80_ci95[0])}, {fmt(s.coverage_80_ci95[1])}]
      </span>{' '}
      <span className="text-text-tertiary">
        ({s.n_predictions.toLocaleString()} predictions at {s.n_origin_dates} dates)
      </span>{' '}
      — <span className={v.tone === 'caution' ? 'text-status-caution' : 'text-text-secondary'}>{v.text}</span>
    </p>
  )
}

export function IntervalCalibration({ mineCode, mineName }: { mineCode: string; mineName: string }) {
  const [data, setData] = useState<CalibrationResponse | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/v1/calibration/cumulative?mine_code=${encodeURIComponent(mineCode)}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as CalibrationResponse | null
        if (alive) setData(body ?? { status: 'unavailable', error: `calibration: ${r.status}` })
      })
      .catch((e) => {
        if (alive) setData({ status: 'unavailable', error: String(e?.message || e) })
      })
    return () => {
      alive = false
    }
  }, [mineCode])

  if (!data) {
    return <p className="text-xs text-text-tertiary">Loading how far to trust the daily bands…</p>
  }

  if (data.status !== 'ok' || !data.daily?.portfolio || data.nominal_coverage == null) {
    return (
      <p role="status" className="text-xs text-text-tertiary" data-provenance="derived">
        Calibration unavailable:{' '}
        {data.status === 'ok' && !data.daily
          ? 'the calibration artifact predates the daily figures; re-measure it with batch all'
          : (data.reason ?? data.error ?? 'no calibration returned')}
        . No figure is shown in its place.
      </p>
    )
  }

  const nominal = data.nominal_coverage
  const { daily } = data
  return (
    <div
      className="space-y-1 rounded-md border border-border-default bg-surface-1 p-3 text-xs"
      data-provenance="derived"
      data-provenance-model={data.model_version}
      data-provenance-vintage={data.generated_at}
      data-calibration="daily"
    >
      <p className="font-medium text-text-primary">
        How far to trust the daily bands: share of real days inside the 80% band (a calibrated band
        holds <span className="font-mono tabular-nums">{nominal.toFixed(2)}</span>)
      </p>
      <Line label="All ten mines" s={daily.portfolio} nominal={nominal} />
      {daily.mine ? (
        <Line label={mineName} s={daily.mine} nominal={nominal} />
      ) : (
        <p className="text-text-tertiary">No daily figure for {mineName}.</p>
      )}
      <p className="text-text-tertiary">
        Held-out rolling-origin backtest at horizons of {daily.horizons_days.join(', ')} days;{' '}
        {data.ci_level != null ? `${Math.round(data.ci_level * 100)}% intervals` : 'intervals'} from a
        bootstrap over whole origin dates. Synthetic data.{' '}
        {data.doc ? (
          <a
            href={`${DOCS_BASE}${data.doc}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-text-secondary"
          >
            How this was measured
          </a>
        ) : null}
      </p>
    </div>
  )
}
