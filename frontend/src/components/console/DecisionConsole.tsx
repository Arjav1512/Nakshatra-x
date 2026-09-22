'use client'

import { useEffect, useMemo, useState } from 'react'
import { type MineRow, fetchForecast, fetchMines, fetchTelemetry } from '@/lib/console-api'
import { synthetic } from '@/lib/provenance'
import { type ExportRow, buildCsv, downloadCsv, exportPdf } from '@/lib/console-export'
import { IntegrityBanner, Metric, SourceBadge } from './Evidence'
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
  const [selected, setSelected] = useState<MineRow | null>(null)
  const [level, setLevel] = useState<Level>('portfolio')
  const [track, setTrack] = useState<'B' | 'A'>('B')
  const [telemetry, setTelemetry] = useState<any>(null)
  const [portfolio, setPortfolio] = useState<Record<number, { shortfall: number; p: number } | 'err' | null>>({})

  useEffect(() => {
    let alive = true
    fetchMines().then((r) => {
      if (!alive) return
      if (!r.ok) { setMinesErr(r.error); return }
      setMines(r.data)
    })
    return () => { alive = false }
  }, [])

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
            : 'err',
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

  const openMine = (m: MineRow) => { setSelected(m); setLevel('mine'); setTrack('B') }

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
      if (!mine || !v || v === 'err') continue
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
    <div className="min-h-screen bg-[#060b13] text-slate-200">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-plain { background: #fff !important; color: #000 !important; border-color: #ccc !important; }
          details { display: block !important; }
          details > summary { display: none; }
        }
      `}</style>

      {/* --- breadcrumb: portfolio -> mine -> face (D-6) --- */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060b13]/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-xs">
          <button
            onClick={() => { setLevel('portfolio'); setSelected(null) }}
            className={`transition-colors ${level === 'portfolio' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Portfolio
          </button>
          {selected ? (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-white">{selected.name}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{track === 'B' ? 'production risk' : 'prospectivity'}</span>
            </>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={doExportCsv} className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-white/30">
              Export CSV
            </button>
            <button onClick={exportPdf} className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-white/30">
              Export PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="print-plain">
          <h1 className="text-lg font-semibold text-white">
            Nakshatra-X · decision support for MOIL
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Two tracks, as the problem statement implies but does not say: <strong className="text-sky-300">Track B</strong> predicts
            production shortfall over days to months, <strong className="text-emerald-300">Track A</strong> ranks where to
            prospect over years. Satellite data is used for what it can measure — weather and surface
            geology. Nothing here claims to see ore underground.
          </p>
        </div>

        {telemetry?.data_integrity ? <IntegrityBanner integrity={telemetry.data_integrity} /> : null}

        {level === 'portfolio' ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Portfolio · shortfall risk by mine
            </h2>
            {minesErr ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                <p className="font-semibold text-rose-300">Mine register unavailable</p>
                <p className="mt-1 text-slate-400">{minesErr}</p>
              </div>
            ) : !mines ? (
              <p className="py-6 text-xs text-slate-400">Loading mine register…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mines.map((m) => {
                  const v = portfolio[m.id]
                  const isPilot = m.mine_code === PILOT_CODE
                  return (
                    <button
                      key={m.id}
                      onClick={() => openMine(m)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isPilot ? 'border-sky-400/40 bg-sky-500/[0.06] hover:border-sky-400/70'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{m.mine_code}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">{m.state} · {m.zone}</p>
                      {v === undefined || v === null ? (
                        <p className="mt-2 text-[11px] text-slate-500">computing…</p>
                      ) : v === 'err' ? (
                        <p className="mt-2 text-[11px] text-rose-300">forecast unavailable</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-baseline gap-2">
                          <span className={`font-mono text-sm ${
                            v.p > 0.8 ? 'text-rose-300' : v.p > 0.5 ? 'text-amber-300' : 'text-emerald-300'
                          }`}>
                            P {Math.round(v.p * 100)}%
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            −{Math.round(v.shortfall).toLocaleString()} t
                          </span>
                          {/* N-3: the strip shows numbers, so it must show their kind too. */}
                          <SourceBadge env={PORTFOLIO_ENV} />
                        </div>
                      )}
                      {isPilot ? (
                        <p className="mt-1 text-[10px] text-sky-300/80">Track B pilot (PRD §13 Q4)</p>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] leading-snug text-slate-500">
              Shortfall probabilities are computed per mine from the Track B forecaster over synthetic
              operational data. Open a mine for drivers, the backtest and constraint-checked actions.
            </p>
          </section>
        ) : null}

        {level === 'mine' && selected ? (
          <>
            <nav className="flex gap-2 no-print">
              {(['B', 'A'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  aria-pressed={track === t}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    track === t
                      ? t === 'B' ? 'border-sky-400/60 bg-sky-500/10 text-sky-200'
                                  : 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {t === 'B' ? 'Track B · production risk' : 'Track A · prospectivity'}
                </button>
              ))}
            </nav>

            {/* --- face/section level (D-6) --- */}
            {track === 'B' && telemetry ? (
              <section className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">
                  {selected.name} · conditions
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {['weather.rainfall_14d_mm', 'weather.land_surface_temp_c', 'risk.live_downtime_hours', 'operations.blasts_this_week']
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

            {track === 'B'
              ? <TrackBPanel mineId={selected.id} mineName={selected.name} />
              : <TrackAPanel />}
          </>
        ) : null}

        <footer className="border-t border-white/10 pt-4 text-[10px] leading-relaxed text-slate-500">
          <p>
            <strong className="text-slate-400">Guardrails.</strong> No subsurface ore detection from
            satellite — the named inputs are surface and atmospheric only. No statutory UNFC reserve
            figures — outputs are decision support for a qualified person. Constraints are enforced,
            never learned. Stale or missing sources are stated, never silently extrapolated.
          </p>
          <p className="mt-1">
            Operational data is synthetic, generated to the published ingestion contract, because
            MOIL&rsquo;s records are proprietary (PRD §8.2). Weather is measured live.
          </p>
        </footer>
      </main>
    </div>
  )
}
