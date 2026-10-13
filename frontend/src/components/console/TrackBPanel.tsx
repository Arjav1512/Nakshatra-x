'use client'

import { useEffect, useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PLAN_TARGET_NOTE, derived, measuredValue, reference, synthetic } from '@/lib/provenance'
import {
  type BacktestResponse, type ForecastResponse, type NoBacktestInfo,
  type RecommendationsResponse, type WarmingInfo,
  fetchBacktest, fetchForecast, fetchRecommendations,
} from '@/lib/console-api'
import { Metric } from './Evidence'
import { IntervalCalibration } from './IntervalCalibration'
import { ProbabilityWithdrawn } from './ProbabilityWithdrawn'

/**
 * Track B — production shortfall (PRD B-5, B-6, B-7, B-10, C-1..C-5, D-2, D-3,
 * D-4, N-8).
 *
 * PRD §10: "Lead with Track B. It is the spine." This panel is therefore the
 * first thing the journey shows.
 */

const SYNTH_SOURCE =
  'Synthetic operational model, generated to the published ingestion contract. MOIL operational data is proprietary (PRD §8.2).'

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
 * A backend that is still computing is not a broken one.
 *
 * A 503 used to land here as `Unavailable` — red border, "Forecast
 * unavailable" — which is the wrong thing to tell someone whose backend is
 * working exactly as designed. The portfolio cards already distinguished the
 * two; this panel did not, so drilling into a warming mine looked like a
 * failure. The wait is bounded and stated, and the panel retries on its own.
 */
function WarmingState({ what, warming, attempt }: { what: string; warming: WarmingInfo; attempt: number }) {
  const eta = Math.max(1, Math.round(warming.eta_seconds))
  return (
    <div
      className="rounded-md border border-accent/30 bg-accent-muted p-3 text-xs"
      data-testid="forecast-warming"
      role="status"
    >
      <p className="flex items-center gap-2 font-semibold text-accent">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Computing {what.toLowerCase()} — about {eta}s
      </p>
      <p className="measure mt-1 leading-snug text-text-secondary">
        This mine has no stored forecast yet, so one is being computed in the
        background. Nothing is wrong; the figures appear here when it finishes.
        {warming.queued_ahead > 0
          ? ` ${warming.queued_ahead} other mine${warming.queued_ahead === 1 ? '' : 's'} queued ahead.`
          : ''}
        {attempt > 1 ? ` Checked ${attempt} times.` : ''}
      </p>
    </div>
  )
}


/**
 * Describe the window a forecast actually covers.
 *
 * The header said "horizon 14 d", which a reader takes as a fortnight starting
 * today. It is not: the forecast comes from a committed artifact whose window
 * was fixed when it was generated, so on any later day that reading is false.
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
    span: `${fmt(start)} – ${fmt(end)}`,
    from: fmt(origin),
    ended,
    inProgress: started && !ended,
  }
}

/**
 * The calendar day of a horizon. Day 1 is the window's first day; the chart
 * labels days by date because the window is fixed, not "the next N days"
 * (D-030).
 */
function dayOf(windowStart: string, horizonDays: number) {
  const d = new Date(`${windowStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + horizonDays - 1)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function TrackBPanel({ mineId, mineName }: { mineId: number; mineName: string }) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [fErr, setFErr] = useState<string | null>(null)
  const [fWarm, setFWarm] = useState<WarmingInfo | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null)
  const [rErr, setRErr] = useState<string | null>(null)
  const [rWarm, setRWarm] = useState<WarmingInfo | null>(null)
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null)
  const [bErr, setBErr] = useState<string | null>(null)
  /**
   * Which mines have a committed backtest, when this one does not.
   *
   * A full rolling-origin run refits the model at every origin — 216 s — so it
   * is a batch job and only the pilot's artifact is committed. For the other
   * nine that is a scope decision, not a failure, and the screen says so and
   * offers the pilot. It never computes on click: the endpoint defaults to
   * compute=false and nothing here overrides it.
   */
  const [noBacktest, setNoBacktest] = useState<NoBacktestInfo | null>(null)

  /**
   * Mobile sectioning (B-5, tranche 2).
   *
   * At 375px this panel was a 4,513px single column: every desktop section in
   * sequence, nothing deferred, eleven screens of scrolling to reach the
   * constraint-checked actions. B-1 confusion 9.
   *
   * Sections are tabbed below `md` and stacked above it. Every section stays in
   * the DOM — hidden with `hidden`, not unmounted — so the content is in the
   * HTML, the provenance guard still sees it, and Cmd-F still finds it. The
   * tabs change which one is visible, not which one exists.
   */
  const [mobileSection, setMobileSection] = useState<
    'answer' | 'drivers' | 'evidence' | 'actions'
  >('answer')

  const SECTIONS = [
    { id: 'answer' as const, label: 'Answer' },
    { id: 'drivers' as const, label: 'Drivers' },
    { id: 'evidence' as const, label: 'Evidence' },
    { id: 'actions' as const, label: 'Actions' },
  ]

  /**
   * Hidden below md unless this is the open section; untouched at md+.
   *
   * This returned `hidden md:block`. `md:block` forced display:block on every
   * section at desktop widths — including the metric row, which is a grid — so
   * the four answer cards sat one per row at full width, 456px of them, and
   * pushed P(shortfall) to 1,054px on a 1280x800 screen. `max-md:hidden` hides
   * only where the tabs apply and leaves each element its own display above.
   */
  const sectionCls = (id: typeof mobileSection) => (mobileSection === id ? '' : 'max-md:hidden')
  const [btLoading, setBtLoading] = useState(false)
  const [grade, setGrade] = useState<string | null>(null)

  /**
   * Fetch, and if the backend says "warming", come back for it.
   *
   * Fixed 8 s, and only while the backend is still reporting warming — it stops
   * on success and on any other error. The point of the warmer is that one fit
   * runs per mine; a page that hammered the endpoint would not start a second
   * one, but it would fill the log and hide a real failure behind noise.
   */
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setForecast(null); setFErr(null); setFWarm(null); setAttempt(0)
    setRecs(null); setRErr(null); setRWarm(null)
    setBacktest(null); setBErr(null); setNoBacktest(null); setGrade(null)
    // Cheap probe: this reads an artifact or answers 503 immediately.
    fetchBacktest(mineId).then((r) => {
      if (!live) return
      if (r.ok) setBacktest(r.data)
      else if (r.noBacktest) setNoBacktest(r.noBacktest)
    })

    const poll = (n: number) => {
      fetchForecast(mineId).then((r) => {
        if (!live) return
        setAttempt(n)
        if (r.ok) { setForecast(r.data); setFWarm(null); setFErr(null); return }
        if (r.warming) {
          setFWarm(r.warming); setFErr(null)
          timer = setTimeout(() => poll(n + 1), 8000)
          return
        }
        setFErr(r.error); setFWarm(null)
      })
      fetchRecommendations(mineId).then((r) => {
        if (!live) return
        if (r.ok) { setRecs(r.data); setRWarm(null); setRErr(null); return }
        if (r.warming) { setRWarm(r.warming); setRErr(null); return }
        setRErr(r.error); setRWarm(null)
      })
    }
    poll(1)
    return () => { live = false; if (timer) clearTimeout(timer) }
  }, [mineId])

  const runBacktest = async () => {
    setBtLoading(true); setBErr(null)
    const r = await fetchBacktest(mineId)
    if (r.ok) setBacktest(r.data)
    else if (r.noBacktest) setNoBacktest(r.noBacktest)
    else setBErr(r.error)
    setBtLoading(false)
  }

  /**
   * The forecast has loaded, failed, or is warming — anything but the first
   * unresolved fetch.
   *
   * The evidence and actions row is held back until then. It was drawn
   * straight away, under a one-line spinner, at about y=432 on a 1280x800
   * screen; ~300 ms later the answer and drivers arrived above it and pushed it
   * off the screen. That single move scored 0.193 of layout shift and took the
   * page from main's 0.264 to as much as 0.379. Both sections describe the
   * forecast — why to believe it, what to do about it — so they belong after
   * it. While it warms they still render, so the backtest stays reachable on a
   * cold start.
   */
  const forecastSettled = !!forecast || !!fErr || !!fWarm
  const grades = forecast?.grades ?? []
  const selected = grades.find((g) => g.grade === grade) ?? grades[0] ?? null

  return (
    // Calm arrival for the whole panel when a different mine is opened. Keyed
    // on the mine so it plays on change, not on every re-render.
    <section key={mineId} className="panel-enter space-y-4">
      {/*
        No kicker row. "TRACK B · PRODUCTION SHORTFALL" in accent blue sat here
        and said what the breadcrumb ("production risk") and the subtitle
        ("Production shortfall, days to months") already say, 40 px above the
        answer; the model version it carried is in the window line below
        (POLISH_AUDIT.md issues 2 and 4).
      */}
      {forecast
        ? (() => {
            const w = describeWindow(
              forecast.forecast_origin,
              forecast.window.start,
              forecast.window.end
            )
            return (
              /*
                One line, not a boxed paragraph (POLISH_AUDIT.md issue 2). It
                was 105 px of prose between the mine's name and its answer.
                The facts are the same — origin, the fixed window, a stored
                artifact and its age, not a live reading — and so are the hooks
                tools/e2e-forecast-dates.js reads. An ended window keeps its
                full warning: that one has to stop the presenter.
              */
              <div
                data-testid="forecast-provenance"
                data-provenance="synthetic"
                data-provenance-model={forecast.model_version}
                data-forecast-live="false"
                data-forecast-origin={forecast.forecast_origin}
                data-window-start={forecast.window.start}
                data-window-end={forecast.window.end}
                data-window-ended={String(w.ended)}
              >
                {w.ended ? (
                  <p className="measure rounded-md border border-status-caution/40 bg-status-caution/10 p-3 text-sm text-text-primary">
                    <strong className="font-medium text-status-caution">
                      This forecast&rsquo;s window has already ended.
                    </strong>{' '}
                    It covers {w.span}, forecast from {w.from}, which is in the past. The figures
                    below are what the model predicted for that window, not a plan for today.
                    Regenerate the artifacts to forecast from today (docs/DEMO.md).
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-primary">{w.span}</span>, forecast from {w.from} by{' '}
                    <span className="font-mono text-xs">{forecast.model_version}</span> · a fixed
                    fortnight from a stored artifact
                    {forecast.artifact_age_hours != null
                      ? ` (generated ${forecast.artifact_age_hours.toFixed(1)} h ago)`
                      : ''}
                    , not a live reading and not a window that rolls with today&rsquo;s date
                  </p>
                )}
              </div>
            )
          })()
        : null}

      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">
          What the forecaster expects
        </h2>
      </div>

      {/* Section navigation. One tap to any section (B-5). */}
      <nav
        aria-label="Mine sections"
        className="sticky top-[6.5rem] z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border-default bg-surface-0/95 px-4 py-2 md:hidden"
      >
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => setMobileSection(sec.id)}
            aria-current={mobileSection === sec.id ? 'true' : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors duration-[120ms] ease-out ${
              mobileSection === sec.id
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-secondary hover:bg-surface-2'
            }`}
          >
            {sec.label}
          </button>
        ))}
      </nav>

      {/* --- D-3 shortfall risk, D-2 trends --- */}
      {fWarm ? (
        <WarmingState what="Forecast" warming={fWarm} attempt={attempt} />
      ) : fErr ? (
        <Unavailable what="Forecast" reason={fErr} />
      ) : !forecast ? (
        <Spinner label={`Loading ${mineName}…`} />
      ) : (
        <>
          {/*
            One focal figure, two that frame it, and the chart beside them
            (POLISH_AUDIT.md issues 2 and 3).

            These were four equal tiles. The largest numbers on the screen
            were the plan (13,030) and expected production (13,012) — five
            digits each — and the answer, the expected shortfall, was the
            third tile at the same size and read as the smallest thing there.
            The shortfall is now the focal tile, in display size, with the
            withdrawal of P(shortfall) stated under it as an annotation of the
            number it would have qualified, instead of a fourth tile shaped
            like one that failed to load. Plan and expected production sit
            under it as the pair the shortfall is measured against.

            The grades and their daily band sit beside the answer rather than
            under it: stacked, the chart started at y = 901-956 on a 1280x800
            screen and the presenter had to scroll mid-sentence. How far to
            trust the band follows the chart, in the same column.
          */}
          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
          <div className="space-y-3 lg:col-span-5">
            <div className={sectionCls('answer')}>
              {/*
                The focal number (D-044): the API's mine-level figure, which
                sums each grade's own shortfall — a surplus in one grade does
                not cancel a deficit in another (PRD §3).
              */}
              <Metric
                label="Expected shortfall"
                focal
                unit="t"
                data={measuredValue(derived(
                  Math.round(forecast.portfolio.expected_shortfall_tonnes),
                  'tonnes',
                  'Sum over grades of max(0, plan target − expected production)',
                  {
                    model_version: forecast.model_version,
                    method:
                      'Each grade is short or not on its own: a surplus in one grade does not cover a deficit in another (PRD §3). A mean, so it does not depend on how the days are correlated.',
                  }
                ))}
                footer={
                  <>
                    <p className="mb-3 text-sm text-text-secondary">
                      Summed over grades, for {describeWindow(
                        forecast.forecast_origin,
                        forecast.window.start,
                        forecast.window.end
                      ).span}
                    </p>
                    {/* Where the worst-grade P(shortfall) was: withdrawn, no number (D-044). */}
                    <ProbabilityWithdrawn variant="note" />
                  </>
                }
              />
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 ${sectionCls('answer')}`}>
              <Metric
                label="Plan target (horizon)"
                emphasis
                unit="t"
                data={measuredValue(reference(
                  Math.round(forecast.portfolio.plan_target_tonnes),
                  'tonnes',
                  'plan_target, ingestion contract v1.0.0',
                  { model_version: 'nakshatra-synthetic-v1', method: 'Monthly plan pro-rated across the forecast window.' }
                ))}
              />
              <Metric
                label="Expected production"
                emphasis
                unit="t"
                data={measuredValue(synthetic(
                  Math.round(forecast.portfolio.expected_cumulative_tonnes),
                  'tonnes',
                  SYNTH_SOURCE,
                  {
                    model_version: forecast.model_version,
                    method: 'Quantile gradient boosting with conformalised intervals; grade is a model feature.',
                  }
                ))}
              />
            </div>
            <div className={sectionCls('answer')}>
              {/* Someone will subtract these two and get a different number
                  from the focal one. That is the point of PRD §3; say so here. */}
              <p className="text-sm text-text-secondary ">
                The shortfall is not plan minus production: each grade is short or not on its own,
                and a surplus in one grade does not cover a deficit in another (PRD §3). Each
                grade&rsquo;s own shortfall and daily band are under &ldquo;By grade&rdquo;.
              </p>
            </div>
          </div>

          <div className="space-y-3 lg:col-span-7">
          {/*
            The grades and the chart are one card now (POLISH_AUDIT.md issue 3).
            The chips are the chart's grade selector, and as a card of their
            own they cost a border, padding and a gap — part of what put the
            chart's top at y = 901 on a 1280x800 screen.
          */}
          <div className={`rounded-md border border-border-default bg-surface-2 p-3 md:p-4 ${sectionCls('drivers')}`}>
            {/* --- grade-aware breakdown: PRD B-5 is per-grade at P0 --- */}
            <p className="label">By grade</p>
            <p className="mt-1 text-sm text-text-secondary">
              A shortfall in one grade is not fungible with a surplus in another (PRD §3). Choose a
              grade to see its daily band.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grades.map((g) => {
                const on = (grade ?? grades[0]?.grade) === g.grade
                // The grade's own expected shortfall. This chip showed its
                // P(shortfall), coloured by band; both are withdrawn (D-044).
                const short = Math.round(g.shortfall.expected_shortfall_tonnes)
                return (
                  <button type="button"
                    key={g.grade}
                    data-grade={g.grade}
                    onClick={() => setGrade(g.grade)}
                    aria-pressed={on}
                    data-provenance="derived"
                    data-provenance-model={forecast.model_version}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors duration-[120ms] ease-out ${
                      on ? 'border-accent bg-accent-muted' : 'border-border-interactive bg-surface-2 hover:bg-surface-3'
                    }`}
                  >
                    <span className="block font-medium text-text-primary">
                      {g.grade.replace(/_/g, ' ')}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-text-secondary">
                      {short > 0 ? `−${short.toLocaleString()} t expected` : 'no shortfall expected'}
                    </span>
                  </button>
                )
              })}
            </div>

          {/* --- trajectory with prediction interval + baseline --- */}
          {selected ? (
            // The chart, its key and its hover tooltip all show forecast output
            // over synthetic data; the envelope is on the block so the tooltip,
            // which Recharts draws inside it, is covered too.
            <div
              className="mt-4 border-t border-border-default pt-3"
              data-provenance="synthetic"
              data-provenance-model={forecast.model_version}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-medium text-text-primary">
                  {selected.grade.replace(/_/g, ' ')} · daily production, tonnes
                </p>
                {/*
                  A key with the marks themselves, in 13 px secondary. It was
                  one 12 px tertiary mono line ("band = 80% prediction interval ·
                  dashed = seasonal-naive-365-v1"): 5.1:1, 3.3:1 on a washed-out
                  projector, and a sentence to decode instead of a mark to match.
                */}
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary" aria-label="Chart key">
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-3 w-4 rounded-sm border border-accent/70 bg-accent/30" />
                    {Math.round(forecast.interval.nominal_coverage * 100)}% prediction interval
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-accent" />
                    median
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-text-secondary" />
                    seasonal-naive baseline
                  </li>
                </ul>
              </div>
              <div className="h-56 w-full md:h-60" data-forecast-chart={selected.grade}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selected.trajectory} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    {/* Recharts theme — docs/design/DESIGN_SYSTEM.md section 8.
                        Colours reference the design tokens through var(); no hex
                        literal appears outside tokens.css. Entrance animation is
                        off: an animating chart is a count-up by another name. */}
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-border-default)"
                    />
                    <XAxis
                      dataKey="horizon_days"
                      tick={{ fontSize: 13, fill: 'var(--color-text-secondary)' }}
                      tickFormatter={(h) => dayOf(forecast.window.start, h)}
                      tickLine={false}
                      axisLine={false}
                      // Evenly spaced dates that fit at 13 px: every other
                      // day on a desktop, fewer on a phone.
                      interval="equidistantPreserveStart"
                      minTickGap={16}
                    />
                    {/*
                      Fitted to the data, not from zero. From zero, values of
                      about 150-210 t used the top fifth of the plot and the
                      band was a sliver (POLISH_AUDIT.md issue 3). The ticks
                      state the range, so nothing implies a zero that is not
                      drawn.
                    */}
                    <YAxis
                      tick={{ fontSize: 13, fill: 'var(--color-text-secondary)' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={[
                        (lo: number) => Math.max(0, Math.floor((lo * 0.9) / 10) * 10),
                        (hi: number) => Math.ceil((hi * 1.05) / 10) * 10,
                      ]}
                      allowDecimals={false}
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
                      labelFormatter={(v) => dayOf(forecast.window.start, Number(v))}
                    />
                    {/*
                      The band is one ranged area between p10 and p90, with its
                      edges drawn as lines. It was a p90 area with a p10 area
                      painted in the card's own colour over its lower half: a
                      16% tint against near-black, with a slab of mask under
                      it, and nothing left of it on a washed-out projector. The
                      edges carry the interval now; the fill only groups it.
                      The p10 / p90 / median class names are what
                      tools/forecast-band.js reads (DECISIONS.md D-043, A1).
                    */}
                    <Area
                      type="monotone"
                      dataKey={(d: any) => [d.p10_tonnes, d.p90_tonnes]}
                      stroke="none" fill="var(--color-accent)" fillOpacity={0.28}
                      name="80% interval" isAnimationActive={false} className="forecast-band"
                      activeDot={false}
                    />
                    <Line
                      type="monotone" dataKey="p90_tonnes" stroke="var(--color-accent)"
                      strokeOpacity={0.7} strokeWidth={1} dot={false} activeDot={false}
                      name="p90" isAnimationActive={false} className="forecast-p90"
                    />
                    <Line
                      type="monotone" dataKey="p10_tonnes" stroke="var(--color-accent)"
                      strokeOpacity={0.7} strokeWidth={1} dot={false} activeDot={false}
                      name="p10" isAnimationActive={false} className="forecast-p10"
                    />
                    <Line
                      type="monotone" dataKey="median_tonnes" stroke="var(--color-accent)"
                      strokeWidth={2.5} dot={false} name="median" isAnimationActive={false}
                      className="forecast-median"
                    />
                    <Line
                      type="monotone" dataKey="baseline_tonnes"
                      stroke="var(--color-text-secondary)"
                      strokeWidth={1.5} strokeDasharray="5 4" dot={false}
                      name="seasonal-naive" isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 font-mono text-xs text-text-secondary">
                baseline: {forecast.baseline_version}
              </p>
            </div>
          ) : null}
          </div>

          <div className={sectionCls('answer')}>
            <IntervalCalibration mineCode={forecast.mine_code} mineName={mineName} />
          </div>

          <p className={`measure text-xs text-text-tertiary ${sectionCls('answer')}`}>
            {PLAN_TARGET_NOTE}
          </p>
          </div>
          </div>
        </>
      )}

      {/*
        B-1 confusion 6 and 7. Everything below arrived as one sequence of
        same-weight panels, so nothing said which to read first and the
        strongest thing this product can say — a rolling-origin backtest
        against a seasonal-naive baseline — sat two thirds down the page in the
        same box as everything else.
        The page is two parts now: what we think, and why you should believe
        it. This heading is the seam.
      */}
      {/*
        Confusion 6, the lower half. Evidence and actions were two more panels
        in the same column; they are now two columns from lg up, each under its
        own heading, so "why believe it" and "what to do about it" read as the
        two separate questions they are. The old subtitle said "the constraint
        checks behind every action above" — the actions were below it.
      */}
      {forecastSettled ? (
      <div className="grid gap-x-6 gap-y-4 border-t border-border-strong pt-6 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-7">
      <div className={sectionCls('evidence')}>
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Why you should believe it
        </h2>
        <p className="measure mt-2 text-sm text-text-secondary">
          Held-out accuracy: a rolling-origin backtest against a seasonal-naive baseline.
        </p>
      </div>

      {/* --- N-8: backtest visible in the UI --- */}
      <div className={`rounded-md border border-border-default bg-surface-2 p-3 ${sectionCls('evidence')}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label">Backtest — held-out accuracy (PRD B-10, N-8)</p>
          {!backtest && !btLoading && !noBacktest ? (
            <button type="button"
              onClick={runBacktest}
              className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
            >
              Show rolling-origin backtest
            </button>
          ) : null}
        </div>

        {btLoading ? (
          <Spinner label="Reading the precomputed backtest…" />
        ) : noBacktest ? (
          /*
           * Designed state, not a failure.
           *
           * Nine of the ten mines have no committed backtest because a full run
           * is 216 s and belongs in the batch job. Showing "Backtest
           * unavailable" in red would say something is broken; it is not. The
           * panel names the pilot it *was* validated on and links to it, and
           * there is no control here that could start a computation.
           */
          <div
            className="mt-2 rounded-md border border-border-default bg-surface-1 p-3"
            data-testid="backtest-pilot"
            data-provenance="derived"
          >
            <p className="measure text-xs text-text-secondary">
              <strong className="font-medium text-text-primary">
                Validated on the pilot mine
                {noBacktest.pilots.length === 1 ? ` (${noBacktest.pilots[0].name})` : ''}.
              </strong>{' '}
              The rolling-origin backtest refits the model at every origin, so it is precomputed by
              the batch job rather than run from this page. {mineName} does not have one; the model
              and its settings are the same across mines.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {noBacktest.pilots.map((pilot) =>
                pilot.mine_id ? (
                  <a
                    key={pilot.mine_code}
                    href={`/console?mine=${pilot.mine_id}&track=b`}
                    className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
                  >
                    View {pilot.name}&rsquo;s backtest &rarr;
                  </a>
                ) : null
              )}
            </div>
          </div>
        ) : bErr ? (
          <div className="mt-2"><Unavailable what="Backtest" reason={bErr} /></div>
        ) : backtest ? (
          <div
            className="mt-3 space-y-3"
            data-provenance="derived"
            data-provenance-model={backtest.model_version}
            data-provenance-vintage={backtest.computed_at}
          >
            <p className="text-sm text-text-primary">{backtest.verdict}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Model MAPE"
              data={measuredValue(derived(backtest.model.mape_pct, '%', 'Rolling-origin backtest, held-out', {
                  model_version: backtest.model_version,
                  method: `${backtest.n_predictions} predictions from ${backtest.n_origins} origins; model refitted at each origin.`,
                }), () => `${backtest.model.mape_pct.toFixed(2)}%`)}
          />
              <Metric
                label="Baseline MAPE"
              data={measuredValue(derived(backtest.baseline.mape_pct, '%', 'Seasonal-naive baseline, same origins', {
                  model_version: backtest.baseline_version,
                  method: 'y_hat[t] = y[t − 365]. The architecture requires a baseline that must be beaten.',
                }), () => `${backtest.baseline.mape_pct.toFixed(2)}%`)}
          />
              <Metric
                label={`Interval coverage (nominal ${backtest.nominal_coverage})`}
              data={measuredValue(derived(backtest.model.coverage_80, 'share', 'Empirical coverage of the 80% interval', {
                  model_version: backtest.model_version,
                  method: 'PRD §11 calibration: do 80%-confidence predictions come true 80% of the time?',
                }), () => String(String(backtest.model.coverage_80)))}
          />
            </div>
            {/* Model and baseline columns in text colours, not accent blue and
                status amber: neither is a state (POLISH_AUDIT.md issue 4). */}
            <table className="w-full text-sm">
              <thead className="text-text-secondary">
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
                    <td className="py-1 text-text-primary">{h.model_mape_pct}%</td>
                    <td className="py-1">{h.baseline_mape_pct}%</td>
                    <td className="py-1">{h.coverage_80}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs leading-snug text-text-tertiary">{backtest.note}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-tertiary">
            {/*
              This said "computed on demand rather than cached from a previous
              build, so what you see was produced now". The opposite is true:
              the console requests no `compute`, the proxy forwards none, and the
              service defaults to serving the stored artifact — "nothing computes
              a backtest on request" (routes.py). A full run refits the model at
              every origin and takes minutes, which is why it is a batch job.
            */}
            Not loaded yet. The backtest is served from a stored artifact built by the batch job, not
            recomputed when you press the button — a full run refits the model at every origin and
            takes minutes.
          </p>
        )}
      </div>

      </div>

      <div className="space-y-4 lg:col-span-5">
      <div className={sectionCls('actions')}>
        <h2 className="font-display text-2xl font-medium tracking-tight">
          What to do about it
        </h2>
        <p className="measure mt-2 text-sm text-text-secondary">
          Corrective actions, each checked against the mine&rsquo;s constraints before it is shown.
        </p>
      </div>

      {/* --- D-4 + C-5: recommendations, and what the engine rejected --- */}
      <div className={`rounded-md border border-border-default bg-surface-2 p-3 ${sectionCls('actions')}`}>
        <p className="label mb-2">Corrective actions (PRD C-1..C-5)</p>
        {rWarm ? (
          <WarmingState what="Recommendations" warming={rWarm} attempt={attempt} />
        ) : rErr ? (
          <Unavailable what="Recommendations" reason={rErr} />
        ) : !recs ? (
          <Spinner label="Generating and constraint-checking actions…" />
        ) : (
          <div className="space-y-2">
            {recs.approved_actions.map((a) => (
              <div
                key={a.id}
                data-provenance="derived"
                data-provenance-model={recs.constraint_engine.version}
                className="rounded-md border border-status-nominal/30 bg-status-nominal/[0.06] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-status-nominal">{a.description}</span>
                  <span className="font-mono text-xs uppercase tracking-wider text-status-nominal">
                    approved
                  </span>
                </div>
                {/* The served ΔP(shortfall) is not shown: it is derived from
                    P(shortfall), which is withdrawn (D-044). */}
                {a.expected_effect ? (
                  <p className="mt-1 font-mono text-xs text-text-secondary">
                    +{Math.round(a.expected_effect.recovery_tonnes)} t expected recovery
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
              <div
                className="rounded-md border border-status-critical/30 bg-status-critical/[0.06] p-3"
                data-provenance="derived"
                data-provenance-model={recs.constraint_engine.version}
              >
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
      </div>
      </div>
      ) : null}
    </section>
  )
}
