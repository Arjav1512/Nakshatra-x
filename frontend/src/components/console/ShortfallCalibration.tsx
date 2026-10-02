'use client'

import { useEffect, useState } from 'react'

/**
 * How far to trust P(shortfall), shown beside it.
 *
 * P(shortfall) comes from the forecast's 14-day cumulative distribution, and
 * that distribution is measurably too narrow: across all ten mines its 80% band
 * held fewer than 80% of real outcomes. A probability read off a band that is
 * too narrow is more confident than the data supports. Saying so next to the
 * number is the point — a calibration finding in a doc nobody opens does not
 * change how anyone reads the figure on screen.
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
type Stat = {
  coverage_80: number
  coverage_80_ci95: [number, number]
  pit_at_extremes: number
  n_windows: number
  n_origin_dates: number
}

type CalibrationResponse = {
  status: 'ok' | 'stale' | 'unavailable'
  reason?: string
  error?: string
  nominal_coverage?: number
  model_version?: string
  portfolio?: Stat
  mine?: Stat | null
  mine_note?: string | null
  doc?: string
  generated_at?: string
}

/** The repo is public, so the write-up resolves for anyone reading the console. */
const DOCS_BASE = 'https://github.com/Arjav1512/Nakshatra-x/blob/main/'

function verdict(s: Stat, nominal: number): { text: string; tone: string } {
  const [lo, hi] = s.coverage_80_ci95
  if (hi < nominal) {
    return {
      text: 'too narrow — outcomes fall outside the band more often than it claims, so P(shortfall) is more confident than the data supports',
      tone: 'text-status-caution',
    }
  }
  if (lo > nominal) {
    return { text: 'too wide — P(shortfall) is more cautious than it needs to be', tone: 'text-text-secondary' }
  }
  return { text: 'consistent with nominal at this sample size', tone: 'text-text-secondary' }
}

function fmt(x: number) {
  return x.toFixed(3)
}

function Line({ label, s, nominal }: { label: string; s: Stat; nominal: number }) {
  const v = verdict(s, nominal)
  return (
    <p className="leading-snug">
      <span className="text-text-secondary">{label}: </span>
      <span className="font-mono tabular-nums text-text-primary">{fmt(s.coverage_80)}</span>{' '}
      <span className="font-mono tabular-nums text-text-tertiary">
        [{fmt(s.coverage_80_ci95[0])}, {fmt(s.coverage_80_ci95[1])}]
      </span>{' '}
      <span className="text-text-tertiary">
        ({s.n_windows} windows at {s.n_origin_dates} dates)
      </span>{' '}
      — <span className={v.tone}>{v.text}</span>
    </p>
  )
}

export function ShortfallCalibration({ mineCode, mineName }: { mineCode: string; mineName: string }) {
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
    return <p className="text-xs text-text-tertiary">Loading how far to trust this…</p>
  }

  if (data.status !== 'ok' || !data.portfolio || data.nominal_coverage == null) {
    return (
      <p role="status" className="text-xs text-text-tertiary" data-provenance="derived">
        Calibration unavailable: {data.reason ?? data.error ?? 'no calibration returned'}. No figure is
        shown in its place.
      </p>
    )
  }

  const nominal = data.nominal_coverage
  return (
    <div
      className="space-y-1 rounded-md border border-border-default bg-surface-1 p-3 text-xs"
      data-provenance="derived"
      data-provenance-model={data.model_version}
      data-provenance-vintage={data.generated_at}
      data-calibration
    >
      <p className="font-medium text-text-primary">
        How far to trust P(shortfall): share of real 14-day totals inside the 80% band (a calibrated
        band holds <span className="font-mono tabular-nums">{nominal.toFixed(2)}</span>)
      </p>
      <Line label="All ten mines" s={data.portfolio} nominal={nominal} />
      {data.mine ? (
        <Line label={mineName} s={data.mine} nominal={nominal} />
      ) : (
        <p className="text-text-tertiary">{data.mine_note ?? `No per-mine figure for ${mineName}.`}</p>
      )}
      <p className="text-text-tertiary">
        Held-out rolling-origin backtest, 95% intervals from a bootstrap over whole origin dates. Synthetic
        data.{' '}
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
