'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type MineRow, fetchForecast, fetchMines, fetchTelemetry } from '@/lib/console-api'
import { synthetic } from '@/lib/provenance'
import { type ExportRow, buildCsv, downloadCsv, exportPdf } from '@/lib/console-export'
import { IntegrityBanner, Metric, SourceBadge } from './Evidence'
import { Button, Card, EmptyState, Skeleton, StatusDot, type Status } from '@/components/ui/primitives'
import { TrackAPanel } from './TrackAPanel'
import { TrackBPanel } from './TrackBPanel'

/**
 * Decision console — the end-to-end journey (PRD D-1..D-8, N-3, N-6, N-8).
 *
 * Structure follows PRD D-6: portfolio → mine → face/section. PRD §10 says to
 * lead with Track B, so a mine opens on Track B and Track A is one click away.
 *
 * Face/section level: the ingestion contract has no face-level grain (its
 * production key is mine × grade × period), so the face view presents the
 * grades actually being worked rather than inventing a face register. That is
 * the honest reading of D-6 against the data the contract defines.
 */

type Level = 'portfolio' | 'mine'

/**
 * A portfolio cell. Failures keep their status code so the UI can tell a
 * backend that answered badly from one it could not reach at all — the two
 * used to collapse to the same literal 'err' and render the same words.
 * Distinguishing a *warming* backend from a broken one needs a signal the API
 * does not yet send; that is logged in FEATURE_BACKLOG.md B-2, not faked here.
 */
type Cell =
  | { shortfall: number; p: number }
  | { error: string; status: number; warming?: { eta_seconds: number } }
  | null

const isFailure = (c: Cell): c is { error: string; status: number } =>
  c !== null && 'error' in c

/** Risk band. Paired with a shape and a text label, never colour alone. */
function band(p: number): { status: Status; label: string } {
  if (p > 0.8) return { status: 'critical', label: 'high' }
  if (p > 0.5) return { status: 'caution', label: 'elevated' }
  return { status: 'nominal', label: 'low' }
}

/** Balaghat — PRD §13 Q4 names it the Track B pilot. */
const PILOT_CODE = 'MOIL-BAL-01'

/**
 * Provenance for the portfolio risk strip. The strip renders numbers, so N-3
 * applies to it as much as to a Metric tile; the badge states the kind inline
 * and the full evidence is one click away on the mine's own panel.
 */
const PORTFOLIO_ENV = synthetic(
  0,
  'probability',
  'Track B forecaster over synthetic operational data (ingestion contract v1.0.0)',
  {
    model_version: 'nakshatra-gbt-cqr-v1',
    method: 'P(cumulative production < plan target) per mine; open a mine for the full evidence.',
  }
)

export function DecisionConsole() {
  const [mines, setMines] = useState<MineRow[] | null>(null)
  const [minesErr, setMinesErr] = useState<string | null>(null)
  /**
   * Console position lives in the URL.
   *
   * It used to be React state only, so a specific mine's Track A view — the
   * prospectivity map included — could not be linked, bookmarked, shared or
   * restored on reload, and the back button left the console entirely. That was
   * logged as FEATURE_BACKLOG B-1; it is fixed here because a map nobody can
   * link to is a map nobody sends anyone.
   */
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlMine = searchParams.get('mine')
  const urlTrack = searchParams.get('track') === 'a' ? 'A' : 'B'

  const [selected, setSelected] = useState<MineRow | null>(null)
  const level: Level = urlMine ? 'mine' : 'portfolio'
  const track: 'B' | 'A' = urlTrack

  const setPosition = useCallback(
    (mineId: number | null, nextTrack: 'A' | 'B') => {
      const q = new URLSearchParams()
      if (mineId != null) q.set('mine', String(mineId))
      if (nextTrack === 'A') q.set('track', 'a')
      const qs = q.toString()
      router.push(qs ? `/console?${qs}` : '/console', { scroll: false })
    },
    [router]
  )

  const setTrack = useCallback(
    (t: 'A' | 'B') => setPosition(selected?.id ?? null, t),
    [selected, setPosition]
  )
  const [telemetry, setTelemetry] = useState<any>(null)
  const [portfolio, setPortfolio] = useState<Record<number, Cell>>({})

  useEffect(() => {
    let alive = true
    fetchMines().then((r) => {
      if (!alive) return
      if (!r.ok) { setMinesErr(r.error); return }
      setMines(r.data)
    })
    return () => { alive = false }
  }, [])

  // Deep link: resolve ?mine=<id> against the register once it arrives, so
  // /console?mine=3&track=a restores that mine's Track A view on a cold load.
  useEffect(() => {
    if (!mines) return
    if (!urlMine) {
      setSelected(null)
      return
    }
    const found = mines.find((m) => String(m.id) === urlMine) ?? null
    setSelected(found)
  }, [mines, urlMine])

  // Portfolio risk strip: one forecast per mine. Sequential on purpose — the
  // service layer fits a model per mine and parallel requests would queue anyway.
  useEffect(() => {
    if (!mines) return
    let alive = true
    ;(async () => {
      for (const m of mines) {
        if (!alive) return
        setPortfolio((p) => ({ ...p, [m.id]: null }))
        const r = await fetchForecast(m.id)
        if (!alive) return
        setPortfolio((p) => ({
          ...p,
          [m.id]: r.ok
            ? {
                shortfall: r.data.portfolio.expected_shortfall_tonnes,
                p: Math.max(0, ...r.data.grades.map((g) => g.shortfall.p_shortfall)),
              }
            : { error: r.error, status: r.status, warming: r.warming ? { eta_seconds: r.warming.eta_seconds } : undefined },
        }))
      }
    })()
    return () => { alive = false }
  }, [mines])

  useEffect(() => {
    if (!selected) { setTelemetry(null); return }
    let alive = true
    fetchTelemetry(selected.id).then((r) => { if (alive) setTelemetry(r.ok ? r.data : null) })
    return () => { alive = false }
  }, [selected])

  const openMine = (m: MineRow) => { setSelected(m); setPosition(m.id, 'B') }

  const exportRows = useMemo<ExportRow[]>(() => {
    const rows: ExportRow[] = []
    if (telemetry?.provenance) {
      for (const [k, env] of Object.entries<any>(telemetry.provenance)) {
        rows.push({
          section: 'telemetry',
          metric: k,
          value: env.value ?? '',
          unit: env.unit ?? '',
          source: env.source ?? '',
          source_kind: env.source_kind ?? '',
          vintage: env.vintage ?? '',
          model_version: env.model_version ?? '',
          uncertainty: env.uncertainty ? `±${env.uncertainty.plus_minus} @${env.uncertainty.confidence}` : 'not quantified',
          is_synthetic: env.is_synthetic,
        })
      }
    }
    for (const [id, v] of Object.entries(portfolio)) {
      const mine = mines?.find((m) => m.id === Number(id))
      if (!mine || !v || isFailure(v)) continue
      rows.push({
        section: 'portfolio', metric: `${mine.name} expected shortfall`, value: Math.round(v.shortfall),
        unit: 'tonnes', source: 'Track B forecaster over synthetic operational data',
        source_kind: 'synthetic', vintage: new Date().toISOString(),
        model_version: 'nakshatra-gbt-cqr-v1', uncertainty: 'see forecast intervals', is_synthetic: true,
      })
    }
    return rows
  }, [telemetry, portfolio, mines])

  const doExportCsv = () => {
    const csv = buildCsv(exportRows, {
      generated: new Date().toISOString(),
      scope: selected ? `${selected.name} (${selected.mine_code})` : 'portfolio',
      notice:
        'Operational figures are SYNTHETIC — generated to the published ingestion contract because MOIL operational data is proprietary (PRD 8.2). Weather is measured live. Not a statutory reserve statement (PRD 2.4).',
    })
    downloadCsv(`nakshatra-planning-${selected?.mine_code ?? 'portfolio'}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-4 pt-6 sm:px-6 lg:px-8">

      {/* Breadcrumb: portfolio -> mine -> track (D-6). Not sticky — the app bar
          already is, and two stacked sticky rows eat the viewport on a laptop. */}
      <div className="no-print flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border-subtle pb-3 text-sm">
        <button
          type="button"
          onClick={() => { setSelected(null); setPosition(null, 'B') }}
          className="rounded-md px-1.5 py-0.5 transition-colors duration-[120ms] ease-out hover:bg-surface-2 hover:text-text-primary"
          aria-current={level === 'portfolio' ? 'page' : undefined}
        >
          <span className={level === 'portfolio' ? 'text-text-primary' : 'text-text-secondary'}>
            Portfolio
          </span>
        </button>
        {selected ? (
          <>
            <span aria-hidden="true" className="text-text-tertiary">/</span>
            <span className="text-text-primary">{selected.name}</span>
            <span aria-hidden="true" className="text-text-tertiary">/</span>
            <span className="text-text-secondary">
              {track === 'B' ? 'production risk' : 'prospectivity'}
            </span>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={doExportCsv}>Export CSV</Button>
          <Button onClick={exportPdf}>Export PDF</Button>
        </div>
      </div>

      <main className="space-y-8 pt-6">
        <div className="print-plain">
          <h1 className="text-2xl">Decision support for MOIL</h1>
          <p className="measure mt-2 text-sm text-text-secondary">
            Two tracks, as the problem statement implies but does not say:{' '}
            <strong className="font-medium text-text-primary">Track B</strong> predicts production
            shortfall over days to months,{' '}
            <strong className="font-medium text-text-primary">Track A</strong> ranks where to
            prospect over years. Satellite data is used for what it can measure — weather and
            surface geology. Nothing here claims to see ore underground.
          </p>
        </div>

        {telemetry?.data_integrity ? <IntegrityBanner integrity={telemetry.data_integrity} /> : null}

        {level === 'portfolio' && track === 'B' ? (
          <section>
            <h2 className="label">Portfolio · shortfall risk by mine</h2>

            {minesErr ? (
              <EmptyState
                className="mt-3"
                title="Mine register unavailable"
                detail={minesErr}
              />
            ) : !mines ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* One placeholder per mine in MOIL's register. Six were
                    rendered here while ten cards were about to arrive, so the
                    page grew by four rows the moment the register resolved —
                    which is most of the console's layout shift. If the register
                    ever returns a different count the cost is one small shift,
                    not the four-row jump. */}
                {Array.from({ length: 10 }, (_, i) => i).map((i) => (
                  <Card key={i}>
                    <div className="space-y-2 p-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </Card>
                ))}
                <p className="sr-only">Loading mine register</p>
              </div>
            ) : (
              <ul className="mt-3 grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mines.map((m) => {
                  const v = portfolio[m.id]
                  const isPilot = m.mine_code === PILOT_CODE
                  return (
                    <li key={m.id}>
                      <Card interactive className="h-full">
                        <button
                          type="button"
                          onClick={() => openMine(m)}
                          className="h-full w-full p-4 text-left"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium text-text-primary">{m.name}</span>
                            <span className="font-mono text-xs text-text-tertiary">
                              {m.mine_code}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-tertiary">
                            {m.state} · {m.zone}
                          </p>

                          {/* All three states occupy the same height, so a card
                              does not grow when its forecast lands. Without this
                              the portfolio shifts ten times as results arrive
                              (measured: CLS 0.257). */}
                          {v === undefined || v === null ? (
                            <div className="mt-3 flex min-h-6 items-center">
                              <Skeleton className="h-4 w-24" />
                              <span className="sr-only">Computing forecast</span>
                            </div>
                          ) : isFailure(v) ? (
                            /* Warming, unreachable and broken are three different
                               states. Collapsing them is what made a cold backend
                               report failure (FEATURE_BACKLOG B-2). */
                            <p className="mt-3 flex min-h-6 items-center gap-1.5 text-sm text-text-secondary">
                              {v.warming ? (
                                <>
                                  <Skeleton className="h-3 w-3 rounded-full" />
                                  Computing — about {Math.round(v.warming.eta_seconds)}s
                                </>
                              ) : v.status === 0 ? (
                                <span className="text-status-unknown">
                                  Forecast unreachable — no response from the service.
                                </span>
                              ) : (
                                <span className="text-status-unknown">
                                  Forecast unavailable ({v.status}).
                                </span>
                              )}
                            </p>
                          ) : (
                            <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1.5">
                              <span className="inline-flex items-center gap-1.5">
                                <StatusDot status={band(v.p).status} />
                                <span className="font-mono text-base text-text-primary">
                                  P {Math.round(v.p * 100)}%
                                </span>
                                <span className="text-xs text-text-secondary">
                                  {band(v.p).label}
                                </span>
                              </span>
                              <span className="font-mono text-sm text-text-secondary">
                                −{Math.round(v.shortfall).toLocaleString()} t
                              </span>
                              {/* N-3: the strip shows numbers, so it shows their kind too. */}
                              <SourceBadge env={PORTFOLIO_ENV} />
                            </div>
                          )}

                          {isPilot ? (
                            <p className="mt-2 text-xs text-text-tertiary">
                              Track B pilot (PRD §13 Q4)
                            </p>
                          ) : null}
                        </button>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="measure mt-4 text-xs text-text-tertiary">
              Shortfall probabilities are computed per mine from the Track B forecaster over
              synthetic operational data. Open a mine for drivers, the backtest and
              constraint-checked actions.
            </p>
          </section>
        ) : null}

        {/*
          Track A renders at the portfolio level too.

          It takes no mine prop: the prospectivity surface is a regional grid
          over the whole Sausar belt, not a per-mine view. Gating it behind
          "pick a mine first" was an artefact of the tab layout, and it put the
          map three interactions deep for no reason. /console?track=a is now a
          real destination, which is what the nav entry points at.
        */}
        {level === 'portfolio' && track === 'A' ? (
          <>
            <nav aria-label="Track" className="no-print flex flex-wrap gap-2">
              {(['B', 'A'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTrack(t)}
                  aria-pressed={track === t}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors duration-[120ms] ease-out ${
                    track === t
                      ? 'border-accent bg-accent-muted text-text-primary'
                      : 'border-border-default text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  {t === 'B' ? 'Track B · production risk' : 'Track A · prospectivity'}
                </button>
              ))}
            </nav>
            <TrackAPanel />
          </>
        ) : null}

        {level === 'mine' && selected ? (
          <>
            <nav aria-label="Track" className="no-print flex flex-wrap gap-2">
              {(['B', 'A'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTrack(t)}
                  aria-pressed={track === t}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors duration-[120ms] ease-out ${
                    track === t
                      ? 'border-accent bg-accent-muted text-text-primary'
                      : 'border-border-default text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  }`}
                >
                  {t === 'B' ? 'Track B · production risk' : 'Track A · prospectivity'}
                </button>
              ))}
            </nav>

            {/* face/section level (D-6) */}
            {track === 'B' && telemetry ? (
              <section data-testid="live-conditions" data-panel-live="true">
                <h2 className="label">{selected.name} · conditions</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    'weather.rainfall_14d_mm',
                    'weather.land_surface_temp_c',
                    'risk.live_downtime_hours',
                    'operations.blasts_this_week',
                  ]
                    .filter((k) => telemetry.provenance?.[k])
                    .map((k) => (
                      <Metric
                        key={k}
                        label={k.split('.')[1].replace(/_/g, ' ')}
                        env={telemetry.provenance[k]}
                        unit={telemetry.provenance[k].unit}
                      />
                    ))}
                </div>
              </section>
            ) : null}

            {track === 'B' ? (
              <TrackBPanel mineId={selected.id} mineName={selected.name} />
            ) : (
              <TrackAPanel />
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
