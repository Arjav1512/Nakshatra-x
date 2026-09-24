'use client'

import { useEffect, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { derived, reference, synthetic } from '@/lib/provenance'
import {
  type BacktestResponse, type ForecastResponse, type RecommendationsResponse,
  fetchBacktest, fetchForecast, fetchRecommendations,
} from '@/lib/console-api'
import { Metric } from './Evidence'

/**
 * Track B — production shortfall (PRD B-5, B-6, B-7, B-10, C-1..C-5, D-2, D-3,
 * D-4, N-8).
 *
 * PRD §10: "Lead with Track B. It is the spine." This panel is therefore the
 * first thing the journey shows.
 */

const SYNTH_SOURCE =
  'Synthetic operational model, generated to the published ingestion contract. MOIL operational data is proprietary (PRD §8.2).'

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-text-secondary">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-tertiary border-t-accent" />
      {label}
    </div>
  )
}

function Unavailable({ what, reason }: { what: string; reason: string }) {
  return (
    <div className="rounded-md border border-status-critical/30 bg-status-critical/5 p-3 text-xs">
      <p className="font-semibold text-status-critical">{what} unavailable</p>
      <p className="mt-1 leading-snug text-text-secondary">{reason}</p>
    </div>
  )
}


/**
 * Describe the window a forecast actually covers.
 *
 * The header said "horizon 14 d", which reads as "the next 14 days" — and the
 * forecast is served from a committed artifact whose window is fixed at
 * generation time. On any day after that, "the next 14 days" is simply false.
 * The origin and the real dates are shown instead, and a window that has
 * already ended says so rather than presenting stale figures as a plan.
 */
function describeWindow(origin: string, start: string, end: string) {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  const today = new Date().toISOString().slice(0, 10)
  const ended = end < today
  const started = start <= today
  return {
    text: `forecast from ${fmt(origin)}, covering ${fmt(start)} – ${fmt(end)}`,
    ended,
    inProgress: started && !ended,
  }
}

export function TrackBPanel({ mineId, mineName }: { mineId: number; mineName: string }) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [fErr, setFErr] = useState<string | null>(null)
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null)
  const [rErr, setRErr] = useState<string | null>(null)
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null)
  const [bErr, setBErr] = useState<string | null>(null)
  const [btLoading, setBtLoading] = useState(false)
  const [grade, setGrade] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setForecast(null); setFErr(null); setRecs(null); setRErr(null)
    setBacktest(null); setBErr(null); setGrade(null)

    fetchForecast(mineId).then((r) => {
      if (!live) return
      r.ok ? setForecast(r.data) : setFErr(r.error)
    })
    fetchRecommendations(mineId).then((r) => {
      if (!live) return
      r.ok ? setRecs(r.data) : setRErr(r.error)
    })
    return () => { live = false }
  }, [mineId])

  const runBacktest = async () => {
    setBtLoading(true); setBErr(null)
    const r = await fetchBacktest(mineId)
    r.ok ? setBacktest(r.data) : setBErr(r.error)
    setBtLoading(false)
  }

  const grades = forecast?.grades ?? []
  const selected = grades.find((g) => g.grade === grade) ?? grades[0] ?? null

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
          Track B · Production shortfall
        </h2>
        {forecast ? (
          <p className="font-mono text-xs text-text-tertiary">
            {forecast.model_version} ·{' '}
            {describeWindow(
              forecast.forecast_origin,
              forecast.window.start,
              forecast.window.end
            ).text}
          </p>
        ) : null}
      </header>

      {forecast
        ? (() => {
            const w = describeWindow(
              forecast.forecast_origin,
              forecast.window.start,
              forecast.window.end
            )
            return (
              <div className="rounded-md border border-border-default bg-surface-1 p-3">
                <p className="measure text-xs text-text-secondary">
                  {w.ended ? (
                    <>
                      <strong className="font-medium text-status-caution">
                        This forecast&rsquo;s window has already ended.
                      </strong>{' '}
                      It covers {w.text.replace('forecast from ', 'the period from ')}, which is in
                      the past. The figures below are what the model predicted for that window, not
                      a plan for today.
                    </>
                  ) : (
                    <>
                      Figures below cover a fixed window — {w.text} — not a rolling &ldquo;next 14
                      days&rdquo;. It is served from a stored artifact
                      {forecast.artifact_age_hours != null
                        ? `, generated ${forecast.artifact_age_hours.toFixed(1)} h ago`
                        : ''}
                      , so it is a computed prediction rather than a live reading. The weather panel
                      beside it is measured live and carries its own vintage.
                    </>
                  )}
                </p>
              </div>
            )
          })()
        : null}

      {/* --- D-3 shortfall risk, D-2 trends --- */}
      {fErr ? (
        <Unavailable what="Forecast" reason={fErr} />
      ) : !forecast ? (
        <Spinner label={`Forecasting ${mineName}…`} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Plan target (horizon)"
              emphasis
              unit="t"
              env={reference(
                Math.round(forecast.portfolio.plan_target_tonnes),
                'tonnes',
                'plan_target, ingestion contract v1.0.0',
                { model_version: 'nakshatra-synthetic-v1', method: 'Monthly plan pro-rated across the forecast window.' }
              )}
            />
            <Metric
              label="Expected production"
              emphasis
              unit="t"
              env={synthetic(
                Math.round(forecast.portfolio.expected_cumulative_tonnes),
                'tonnes',
                SYNTH_SOURCE,
                {
                  model_version: forecast.model_version,
                  method: 'Quantile gradient boosting with conformalised intervals; grade is a model feature.',
                }
              )}
            />
            <Metric
              label="Expected shortfall"
              emphasis
              unit="t"
              env={derived(
                Math.round(forecast.portfolio.expected_shortfall_tonnes),
                'tonnes',
                'max(0, plan target − expected production)',
                { model_version: forecast.model_version }
              )}
            />
            <Metric
              label="Worst-grade P(shortfall)"
              emphasis
              display={
                grades.length
                  ? pct(Math.max(...grades.map((g) => g.shortfall.p_shortfall)))
                  : null
              }
              env={derived(
                grades.length ? Math.max(...grades.map((g) => g.shortfall.p_shortfall)) : 0,
                'probability',
                'Monte Carlo over per-day predictive distributions',
                {
                  model_version: forecast.model_version,
                  method: 'P(cumulative production < plan target) — PRD B-6.',
                  uncertainty: {
                    plus_minus: 0,
                    confidence: forecast.interval.nominal_coverage,
                    basis: 'Daily intervals are conformalised; days treated as independent given covariates.',
                  },
                }
              )}
            />
          </div>

          {/* --- grade-aware breakdown: PRD B-5 is per-grade at P0 --- */}
          <div className="rounded-md border border-border-default bg-surface-2 p-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-text-secondary">
              By grade — a shortfall in one grade is not fungible with a surplus in another (PRD §3)
            </p>
            <div className="flex flex-wrap gap-2">
              {grades.map((g) => {
                const on = (grade ?? grades[0]?.grade) === g.grade
                const risk = g.shortfall.p_shortfall
                return (
                  <button type="button"
                    key={g.grade}
                    onClick={() => setGrade(g.grade)}
                    aria-pressed={on}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      on ? 'border-accent/60 bg-accent/10' : 'border-border-default bg-surface-2 hover:border-border-interactive'
                    }`}
                  >
                    <span className="block font-medium text-text-primary">
                      {g.grade.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`mt-0.5 block font-mono ${
                        risk > 0.8 ? 'text-status-critical' : risk > 0.5 ? 'text-status-caution' : 'text-status-nominal'
                      }`}
                    >
                      P(short) {pct(risk)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* --- trajectory with prediction interval + baseline --- */}
          {selected ? (
            <div className="rounded-md border border-border-default bg-surface-2 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-text-secondary">
                  {selected.grade.replace(/_/g, ' ')} · daily trajectory
                </p>
                <p className="font-mono text-xs text-text-tertiary">
                  band = {Math.round(forecast.interval.nominal_coverage * 100)}% prediction interval ·
                  dashed = {forecast.baseline_version}
                </p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selected.trajectory} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    {/* Recharts theme — docs/design/DESIGN_SYSTEM.md section 8.
                        Colours reference the design tokens through var(); no hex
                        literal appears outside tokens.css. Entrance animation is
                        off: an animating chart is a count-up by another name. */}
                    <defs>
                      <linearGradient id="pi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.16} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-border-subtle)"
                    />
                    <XAxis
                      dataKey="horizon_days"
                      tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 4,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--color-text-primary)',
                      }}
                      labelFormatter={(v) => `Day +${v}`}
                    />
                    <Area
                      type="monotone" dataKey="p90_tonnes" stroke="none" fill="url(#pi)"
                      name="p90" isAnimationActive={false}
                    />
                    <Area
                      type="monotone" dataKey="p10_tonnes" stroke="none"
                      fill="var(--color-surface-2)" name="p10" isAnimationActive={false}
                    />
                    <Line
                      type="monotone" dataKey="median_tonnes" stroke="var(--color-accent)"
                      strokeWidth={2} dot={false} name="median" isAnimationActive={false}
                    />
                    <Line
                      type="monotone" dataKey="baseline_tonnes"
                      stroke="var(--color-text-tertiary)"
                      strokeWidth={1} strokeDasharray="4 3" dot={false}
                      name="seasonal-naive" isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* --- N-8: backtest visible in the UI --- */}
      <div className="rounded-md border border-border-default bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-text-secondary">
            Backtest — held-out accuracy (PRD B-10, N-8)
          </p>
          {!backtest && !btLoading ? (
            <button type="button"
              onClick={runBacktest}
              className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
            >
              Run rolling-origin backtest
            </button>
          ) : null}
        </div>

        {btLoading ? (
          <Spinner label="Refitting the model at every origin — this takes a minute or two…" />
        ) : bErr ? (
          <div className="mt-2"><Unavailable what="Backtest" reason={bErr} /></div>
        ) : backtest ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-text-secondary">{backtest.verdict}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Model MAPE"
                display={`${backtest.model.mape_pct}%`}
                env={derived(backtest.model.mape_pct, '%', 'Rolling-origin backtest, held-out', {
                  model_version: backtest.model_version,
                  method: `${backtest.n_predictions} predictions from ${backtest.n_origins} origins; model refitted at each origin.`,
                })}
              />
              <Metric
                label="Baseline MAPE"
                display={`${backtest.baseline.mape_pct}%`}
                env={derived(backtest.baseline.mape_pct, '%', 'Seasonal-naive baseline, same origins', {
                  model_version: backtest.baseline_version,
                  method: 'y_hat[t] = y[t − 365]. The architecture requires a baseline that must be beaten.',
                })}
              />
              <Metric
                label={`Interval coverage (nominal ${backtest.nominal_coverage})`}
                display={String(backtest.model.coverage_80)}
                env={derived(backtest.model.coverage_80, 'share', 'Empirical coverage of the 80% interval', {
                  model_version: backtest.model_version,
                  method: 'PRD §11 calibration: do 80%-confidence predictions come true 80% of the time?',
                })}
              />
            </div>
            <table className="w-full text-xs">
              <thead className="text-text-tertiary">
                <tr className="border-b border-border-default text-left">
                  <th className="py-1 font-normal">Horizon</th>
                  <th className="py-1 font-normal">Model MAPE</th>
                  <th className="py-1 font-normal">Baseline MAPE</th>
                  <th className="py-1 font-normal">Coverage</th>
                </tr>
              </thead>
              <tbody className="font-mono text-text-secondary">
                {backtest.by_horizon.map((h: any) => (
                  <tr key={h.horizon_days} className="border-b border-border-subtle">
                    <td className="py-1">{h.horizon_days} d</td>
                    <td className="py-1 text-accent">{h.model_mape_pct}%</td>
                    <td className="py-1 text-status-caution">{h.baseline_mape_pct}%</td>
                    <td className="py-1">{h.coverage_80}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs leading-snug text-text-tertiary">{backtest.note}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-tertiary">
            Not yet run in this session. The figure is computed on demand rather than cached from a
            previous build, so what you see was produced now.
          </p>
        )}
      </div>

      {/* --- D-4 + C-5: recommendations, and what the engine rejected --- */}
      <div className="rounded-md border border-border-default bg-surface-2 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-text-secondary">
          Corrective actions (PRD C-1..C-5) — every action constraint-checked
        </p>
        {rErr ? (
          <Unavailable what="Recommendations" reason={rErr} />
        ) : !recs ? (
          <Spinner label="Generating and constraint-checking actions…" />
        ) : (
          <div className="space-y-2">
            {recs.approved_actions.map((a) => (
              <div key={a.id} className="rounded-md border border-status-nominal/30 bg-status-nominal/[0.06] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-status-nominal">{a.description}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-status-nominal">
                    approved
                  </span>
                </div>
                {a.expected_effect ? (
                  <p className="mt-1 font-mono text-xs text-text-secondary">
                    +{Math.round(a.expected_effect.recovery_tonnes)} t · ΔP(shortfall){' '}
                    {a.expected_effect.delta_shortfall_probability}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-text-tertiary">
                  checks passed: {a.constraint_check.checks_passed.join(' · ')}
                </p>
                {a.expected_effect?.assumptions?.length ? (
                  <ul className="mt-1 list-disc pl-4 text-xs leading-snug text-text-tertiary">
                    {a.expected_effect.assumptions.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                ) : null}
              </div>
            ))}

            {recs.rejected_actions.length ? (
              <div className="rounded-md border border-status-critical/30 bg-status-critical/[0.06] p-3">
                <p className="text-xs font-medium text-status-critical">
                  Rejected by the constraint engine — never shown as options
                </p>
                <ul className="mt-1 space-y-1">
                  {recs.rejected_actions.map((a) => (
                    <li key={a.id} className="text-xs text-text-secondary">
                      <span className="font-mono text-status-critical">{a.action_type}</span> —{' '}
                      {a.constraint_check.violations[0]?.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                No candidate violated a constraint this run. The engine still ran — see its scope below.
              </p>
            )}

            <p className="text-xs leading-snug text-text-tertiary">
              {recs.constraint_engine.version} · enforced, not learned · scope:{' '}
              {recs.constraint_engine.scope.join(', ')} · excluded:{' '}
              {recs.constraint_engine.excluded.join(', ')}
            </p>
            <p className="text-xs leading-snug text-text-tertiary">{recs.guardrail}</p>
          </div>
        )}
      </div>
    </section>
  )
}
