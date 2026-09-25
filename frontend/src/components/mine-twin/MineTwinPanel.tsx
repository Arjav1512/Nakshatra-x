'use client'

import { useState, useEffect } from 'react'
import { fetchForecast } from '@/lib/console-api'
import type { MineInfo } from '@/components/mission-control/types'
import {
  HISTORICAL_DATABASE_1977_2026,
  FUTURE_FORECASTS_2026_2040,
} from '@/lib/historical-database'
import {
  Sparkles,
  TrendingUp,
  Play,
  Activity,
  Sliders,
  BarChart3,
  Box,
  Database,
} from 'lucide-react'

export type Scenario = {
  id: string
  mine_name: string
  shift_window: string
  blasting_delay_hours: number
  redeploy: string
  dry_blast_tolerance: number
  predicted_production_t: number
  baseline_production_t: number
  recovery_t: number
  risk_delta: number
  created_at: string
}

interface Props {
  selectedMine?: MineInfo
}

const DEFAULT_MINE: MineInfo = {
  id: 'balaghat',
  numericId: 1,
  name: 'Balaghat',
  code: 'MOIL-BAL-01',
  state: 'MP',
  lat: 21.83,
  lng: 80.19,
  zone: 'Central India',
  targetTonnes: 18000,
  currentProduction: 16800,
}

export default function MineTwinPanel({ selectedMine = DEFAULT_MINE }: Props) {
  // What-If Simulator Controls
  const [shift, setShift] = useState<'04-10' | '06-14' | '22-06'>('04-10')
  const [blastDelay, setBlastDelay] = useState<0 | 6 | 12>(0)
  const [redeploy, setRedeploy] = useState<'none' | '1-crusher' | '1-shovel-1-dumper'>('1-shovel-1-dumper')
  const [tolerance, setTolerance] = useState<10 | 20 | 30>(20)

  // Simulation State
  // Null until a simulation has actually run.
  //
  // This used to be seeded with {predicted: 16620, recovery: 2420,
  // riskDelta: -0.05}, so the screen showed a complete "Digital Twin Result"
  // before anyone had pressed the button — three numbers presented as the
  // output of a simulation that had not happened.
  const [simResult, setSimResult] = useState<{
    predicted: number
    recovery: number
    riskDelta: number
  } | null>(null)
  const [simError, setSimError] = useState<string | null>(null)

  const [history, setHistory] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)
  const [comparedScenario, setComparedScenario] = useState<Scenario | null>(null)

  // Minimalistic 50-Year History Graph Controls
  const [chartMetric, setChartMetric] = useState<'production' | 'reserves' | 'grade'>('production')
  const [activeHoverYear, setActiveHoverYear] = useState<number | null>(2025)

  // Combined SYNTHETIC 1977-2026 history and the illustrative 2026-2040
  // trajectory. Neither is MOIL's record: operational data is proprietary
  // (PRD 8.2) and `historical-database.ts` labels both as synthetic. The
  // comment here called it "real", which the screen then repeated.
  const fullTimeline = [
    ...HISTORICAL_DATABASE_1977_2026.map((d) => ({
      year: d.year,
      value:
        chartMetric === 'production'
          ? d.totalProductionTonnes
          : chartMetric === 'reserves'
          ? d.indicativeResourceBaseTonnes
          : d.avgMnGradePct,
      productionTonnes: d.totalProductionTonnes,
      reservesTonnes: d.indicativeResourceBaseTonnes,
      gradePct: d.avgMnGradePct,
      isForecast: false,
      milestone: d.majorMilestone,
      grade: d.gradeType,
      source: d.primarySource,
    })),
    ...FUTURE_FORECASTS_2026_2040.map((f) => ({
      year: f.year,
      value:
        chartMetric === 'production'
          ? f.predictedProductionTonnes
          : chartMetric === 'reserves'
          ? f.projectedProvedReservesTonnes
          : 38.0 + (f.year - 2026) * 0.15,
      productionTonnes: f.predictedProductionTonnes,
      reservesTonnes: f.projectedProvedReservesTonnes,
      gradePct: 38.0 + (f.year - 2026) * 0.15,
      isForecast: true,
      milestone: f.aiStrategyDirective,
      grade: 'SciPy Refined Grade',
      source: `NAKSHATRA-X 2040 (${f.modelBasis})`,
    })),
  ]

  const activeHoverRecord = fullTimeline.find((d) => d.year === activeHoverYear) || fullTimeline[fullTimeline.length - 1]
  const maxVal = Math.max(...fullTimeline.map((d) => d.value || 1), 1)
  const minVal = Math.min(...fullTimeline.map((d) => d.value || 0))

  const runSimulation = async () => {
    setLoading(true)
    setSimError(null)
    try {
      const res = await fetch('/api/v1/mine-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineId: selectedMine.id,
          mineName: selectedMine.name,
          shiftWindow: shift,
          blastingDelayHours: blastDelay,
          redeploy,
          dryBlastTolerance: tolerance,
          baselineProduction: selectedMine.currentProduction || 14200,
          currentRisk: 0.12,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSimResult({
          predicted: data.predicted,
          recovery: data.recovery,
          riskDelta: data.riskDelta,
        })
        setSimError(null)
        setHistory(data.scenarios || [])
      } else {
        setSimResult(null)
        setSimError(`The simulation service answered ${res.status}.`)
      }
    } catch (err: any) {
      // Report the failure. Do not invent a result.
      //
      // This branch used to compute a "simulation" in the browser from
      // hardcoded multipliers (1.18 / 1.06 / 0.92 …) and render it through the
      // same cards as a real backend result, with nothing on screen to
      // distinguish the two. A number the model did not produce must not be
      // shown as though it did (PRD N-6).
      setSimResult(null)
      setSimError(err?.message || 'The simulation service could not be reached.')
    } finally {
      setLoading(false)
    }
  }

  // The daily chart below shows the real Track B forecast for this mine.
  //
  // It used to be `Math.sin(i * 1.2) * 120` around a scalar — seven bars of
  // invented daily output labelled "Projected Haulage Output", which is the
  // same fabrication pattern as the map's six removed layers and survived the
  // same three sweeps for the same reason: the numbers existed only at render
  // time. The forecaster already produces a dated daily trajectory with a
  // seasonal-naive baseline, so the chart shows that instead.
  const [trajectory, setTrajectory] = useState<
    { date: string; median: number; baseline: number }[] | null
  >(null)
  const [trajectoryState, setTrajectoryState] = useState<'loading' | 'ready' | 'warming' | 'error'>('loading')
  const [forecastMeta, setForecastMeta] = useState<{ model: string; origin: string } | null>(null)

  useEffect(() => {
    let alive = true
    setTrajectory(null)
    setTrajectoryState('loading')
    fetchForecast(selectedMine.numericId ?? 1).then((r) => {
      if (!alive) return
      if (!r.ok) {
        setTrajectoryState(r.warming ? 'warming' : 'error')
        return
      }
      // Sum the per-grade trajectories: the chart is mine-level output.
      const byDate = new Map<string, { median: number; baseline: number }>()
      for (const g of r.data.grades ?? []) {
        for (const pt of g.trajectory ?? []) {
          const cur = byDate.get(pt.date) ?? { median: 0, baseline: 0 }
          cur.median += pt.median_tonnes
          cur.baseline += pt.baseline_tonnes
          byDate.set(pt.date, cur)
        }
      }
      setTrajectory([...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, median: v.median, baseline: v.baseline })))
      setForecastMeta({ model: r.data.model_version, origin: r.data.forecast_origin })
      setTrajectoryState('ready')
    })
    return () => { alive = false }
  }, [selectedMine.numericId])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/v1/mine-twin')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.scenarios || [])
      }
    } catch {}
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // `|| 14200`, `|| 16620` and `|| 2420` used to stand here. Each one turned a
  // missing value into a plausible number, and `|| 0` would have fired on a
  // legitimate zero as well. A value that is not there is rendered as not
  // there.
  const baselineProd = selectedMine.currentProduction ?? null
  const predictedProd = simResult?.predicted ?? null
  const recoveryVal = simResult?.recovery ?? null
  const riskDelta = simResult?.riskDelta ?? null

  return (
    <div className="ios-glass-card p-6 border border-border-interactive rounded-md space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Cyber Ambient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="ios-badge ios-badge-gold text-xs font-mono font-bold tracking-widest uppercase">
              ⭐ DIGITAL TWIN &bull; SIEMENS CONCEPT
            </span>
            <span className="ios-badge ios-badge-live text-xs font-mono font-bold">
              REAL 50-YR MOIL & IBM DATA &bull; 2040 FORECAST
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight flex items-center gap-2 font-sans">
            <Box className="w-6 h-6 text-accent" />
            MINE TWIN &bull; <span className="text-accent">Live Digital Twin & What-If Operational Simulator</span>
          </h2>
          <p className="text-xs font-mono text-text-secondary mt-1 max-w-3xl leading-relaxed">
            Real-time virtual copy of <span className="text-accent font-bold">{selectedMine.name} Mine ({selectedMine.code})</span>. Driven by a synthetic 50-year series generated to the published ingestion contract, with an illustrative forward trajectory. Not statutory disclosures, and not a fitted trajectory model.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-full bg-surface-1/90 border border-accent/40 text-xs font-mono text-accent font-bold flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-accent " />
            <span>TWIN SYNCED (4ms)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Parameter Controls + Real Digital Data Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Scenario Controls (5 Columns) */}
        <div className="lg:col-span-5 space-y-5 ios-glass-inset p-5 rounded-md border border-border-default">
          <div className="flex items-center justify-between border-b border-border-default pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider">
                What-If Parameter Controls
              </h3>
            </div>
            <span className="text-xs font-mono text-text-tertiary">4 Variable Vectors</span>
          </div>

          {/* 1. Haulage Shift Window */}
          <div>
            <label className="text-xs font-mono text-text-secondary font-bold uppercase tracking-wider flex items-center justify-between mb-2">
              <span>1. Haulage Shift Window:</span>
              <span className="text-accent">{shift}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['04-10', '06-14', '22-06'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setShift(opt)}
                  className={`py-2 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer border ${
                    shift === opt
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface-2 border-border-default text-text-secondary hover:bg-white/15'
                  }`}
                  type="button"
                >
                  {opt === '04-10' ? '04:00-10:00' : opt === '06-14' ? '06:00-14:00' : '22:00-06:00'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Pit Blasting Delay */}
          <div>
            <label className="text-xs font-mono text-text-secondary font-bold uppercase tracking-wider flex items-center justify-between mb-2">
              <span>2. Pit Blasting Delay:</span>
              <span className="text-status-caution">{blastDelay === 0 ? 'ON TIME' : `+${blastDelay} Hours`}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([0, 6, 12] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBlastDelay(opt)}
                  className={`py-2 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer border ${
                    blastDelay === opt
                      ? 'bg-status-caution/20 border-status-caution text-status-caution'
                      : 'bg-surface-2 border-border-default text-text-secondary hover:bg-white/15'
                  }`}
                  type="button"
                >
                  {opt === 0 ? 'ON TIME (0h)' : `+${opt}H DELAY`}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Equipment Redeployment */}
          <div>
            <label className="text-xs font-mono text-text-secondary font-bold uppercase tracking-wider flex items-center justify-between mb-2">
              <span>3. Equipment Redeploy:</span>
              <span className="text-accent">{redeploy.toUpperCase()}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['none', '1-crusher', '1-shovel-1-dumper'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRedeploy(opt)}
                  className={`py-2 px-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer border text-center ${
                    redeploy === opt
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface-2 border-border-default text-text-secondary hover:bg-white/15'
                  }`}
                  type="button"
                >
                  {opt === 'none' ? 'NONE' : opt === '1-crusher' ? '1 CRUSHER' : '1 SHOVEL+DUMPER'}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Dry Blast Tolerance */}
          <div>
            <label className="text-xs font-mono text-text-secondary font-bold uppercase tracking-wider flex items-center justify-between mb-2">
              <span>4. Dry Blast Tolerance:</span>
              <span className="text-text-primary">{tolerance}%</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([10, 20, 30] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTolerance(opt)}
                  className={`py-2 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer border ${
                    tolerance === opt
                      ? 'bg-white/20 border-white text-text-primary'
                      : 'bg-surface-2 border-border-default text-text-secondary hover:bg-white/15'
                  }`}
                  type="button"
                >
                  {opt}% TOL
                </button>
              ))}
            </div>
          </div>

          {/* Action Simulation Trigger Button */}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-3.5 rounded-md bg-gradient-to-r from-accent to-accent text-black font-semibold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors hover: hover:scale-[1.02]"
            type="button"
          >
            <Play className={`w-4 h-4 fill-black ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'RUNNING DIGITAL TWIN SIMULATION...' : 'RUN WHAT-IF SIMULATION'}</span>
          </button>
        </div>

        {/* Right Column: Simulation Outcomes & Sleek Minimalistic 50-Yr Graph (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Key Simulation Outcome Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className="ios-glass-inset p-4 space-y-1 border border-border-default"
              data-provenance="reference"
            >
              <span className="text-xs font-mono text-text-secondary uppercase">Baseline Plan</span>
              <div className="text-xl font-bold font-mono text-text-primary">
                {baselineProd !== null ? `${baselineProd.toLocaleString()} T` : '—'}
              </div>
              <span className="text-xs font-mono text-text-secondary">&bull; Mine register</span>
            </div>

            <div
              className="ios-glass-inset p-4 space-y-1 border border-accent/30 bg-accent/5"
              data-provenance={predictedProd !== null ? 'synthetic' : 'unavailable'}
            >
              <span className="text-xs font-mono text-accent uppercase font-bold">Predicted Output</span>
              <div className="text-xl font-bold font-mono text-accent">
                {predictedProd !== null ? `${predictedProd.toLocaleString()} T` : 'not run'}
              </div>
              <span className="text-xs font-mono text-accent font-bold">
                {predictedProd !== null ? '\u2022 Simulation result' : '\u2022 Run the simulation'}
              </span>
            </div>

            <div
              className="ios-glass-inset p-4 space-y-1 border border-status-caution/30 bg-status-caution/5"
              data-provenance={recoveryVal !== null ? 'derived' : 'unavailable'}
            >
              <span className="text-xs font-mono text-status-caution uppercase font-bold">Net Recovery</span>
              <div className="text-xl font-bold font-mono text-status-caution">
                {recoveryVal === null
                  ? 'not run'
                  : `${recoveryVal >= 0 ? '+' : ''}${recoveryVal.toLocaleString()} T`}
              </div>
              <span className="text-xs font-mono text-status-caution">
                {recoveryVal !== null ? '\u2022 vs baseline' : '\u2022 Run the simulation'}
              </span>
            </div>

            {/*
              A "Twin Confidence" tile used to sit here showing
              `simResult?.confidence || 94`% under the label "High Precision ML".
              The endpoint's confidence was min(96, max(72, 90 - |delay| * 1.4 ...)),
              and when it was absent this fell back to the literal 94. Nothing
              about a fixed-multiplier calculator supports a confidence, so it
              reports none — and says what it is instead.
            */}
            <div className="rounded-md border border-border-default bg-surface-1 p-4">
              <span className="label">What this is</span>
              <p className="measure mt-2 text-xs text-text-secondary">
                A deterministic what-if over fixed multipliers that are stated assumptions, not
                fitted coefficients. It compares options against each other. It is not a forecast
                and carries no uncertainty — the validated forecaster, with its interval and
                backtest, is on the console.
              </p>
            </div>
          </div>

          {/* SLEEK MINIMALISTIC 50-YEAR HISTORY (1975-2025) & 2040 FORECAST GRAPH */}
          <div className="ios-glass-inset p-5 rounded-md border border-border-default space-y-3 relative overflow-hidden bg-[var(--color-surface-1)]/90">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider">
                  50-Year Historical Mining Baseline &bull; <span className="text-status-caution">1975–2040 AI Forecast</span>
                </h3>
              </div>

              {/* Metric Pill Toggles */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {[
                  { key: 'production', label: 'ROM Output (T)' },
                  { key: 'reserves', label: 'Reserves (T)' },
                  { key: 'grade', label: 'Grade (% Mn)' },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key as any)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                      chartMetric === m.key
                        ? 'bg-accent/20 border border-accent text-accent'
                        : 'bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary'
                    }`}
                    type="button"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Minimalistic Trend Line */}
            <div className="relative h-36 w-full pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 150" preserveAspectRatio="none">
                {/* Horizontal guide lines */}
                {[0, 37.5, 75, 112.5, 150].map((yVal, i) => (
                  <line key={i} x1="0" y1={yVal} x2="1000" y2={yVal} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                ))}

                {/* 2026 Boundary vertical line */}
                <line x1="770" y1="0" x2="770" y2="150" stroke="var(--color-status-caution)" strokeOpacity="0.4" strokeDasharray="4 4" strokeWidth="1.5" />

                {(() => {
                  const points = fullTimeline.map((item, index) => {
                    const x = (index / Math.max(fullTimeline.length - 1, 1)) * 1000
                    const range = maxVal - minVal || 1
                    const y = 140 - ((item.value - minVal) / range) * 130
                    return { x, y, item }
                  })

                  const historyPoints = points.filter((p) => !p.item.isForecast)
                  const forecastPoints = points.filter((p) => p.item.isForecast)

                  if (historyPoints.length > 0 && forecastPoints.length > 0) {
                    forecastPoints.unshift(historyPoints[historyPoints.length - 1])
                  }

                  const historyPath = historyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                  const forecastPath = forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                  const areaPath = historyPoints.length > 0
                    ? `${historyPath} L ${historyPoints[historyPoints.length - 1].x} 145 L ${historyPoints[0].x} 145 Z`
                    : ''

                  return (
                    <>
                      <defs>
                        <linearGradient id="miniHistArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-status-nominal)" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="var(--color-status-nominal)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {areaPath && <path d={areaPath} fill="url(#miniHistArea)" />}

                      {historyPath && (
                        <path
                          d={historyPath}
                          fill="none"
                          stroke="var(--color-status-nominal)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.6))' }}
                        />
                      )}

                      {forecastPath && (
                        <path
                          d={forecastPath}
                          fill="none"
                          stroke="var(--color-status-caution)"
                          strokeWidth="2.5"
                          strokeDasharray="5 3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))' }}
                        />
                      )}

                      {points.map((p, idx) => {
                        const isHovered = activeHoverYear === p.item.year
                        return (
                          <g
                            key={idx}
                            className="cursor-pointer"
                            onClick={() => setActiveHoverYear(p.item.year)}
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? 6 : p.item.year % 5 === 0 ? 3.5 : 2}
                              fill={isHovered ? 'var(--color-text-primary)' : p.item.isForecast ? 'var(--color-status-caution)' : 'var(--color-status-nominal)'}
                              stroke={isHovered ? (p.item.isForecast ? 'var(--color-status-caution)' : 'var(--color-status-nominal)') : 'none'}
                              strokeWidth={2}
                            />
                            {(p.item.year % 10 === 0 || p.item.year === 2040) && (
                              <text
                                x={p.x}
                                y="148"
                                fill="var(--color-text-tertiary)"
                                fontSize="8"
                                fontFamily="monospace"
                                textAnchor="middle"
                              >
                                {p.item.year}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </>
                  )
                })()}
              </svg>
            </div>

            {/* Minimal Active Year Inspection Badge */}
            {activeHoverRecord && (
              <div
                className="flex flex-wrap items-center justify-between text-xs font-mono pt-2 border-t border-border-default text-text-secondary"
                data-provenance="synthetic"
              >
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-bold">Year {activeHoverRecord.year}:</span>
                  <span className="text-accent font-bold">
                    {activeHoverRecord.productionTonnes.toLocaleString()} T ROM
                  </span>
                  <span className="text-text-secondary">({activeHoverRecord.grade})</span>
                </div>
                <div className="text-text-secondary truncate max-w-xs" title={activeHoverRecord.milestone}>
                  {activeHoverRecord.milestone}
                </div>
              </div>
            )}
          </div>

          {/* Daily forecast trajectory — the real Track B artifact, not a shape */}
          <div
            className="ios-glass-inset p-5 rounded-md border border-border-default space-y-3"
            data-provenance={trajectoryState === 'ready' ? 'synthetic' : 'unavailable'}
            data-provenance-model={forecastMeta?.model}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider">
                  Daily forecast · {selectedMine.name}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-accent font-bold">
                  <span className="w-2.5 h-2.5 rounded bg-accent inline-block" /> forecast median
                </span>
                <span className="flex items-center gap-1 text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded bg-text-tertiary inline-block" /> seasonal-naive
                </span>
              </div>
            </div>

            {trajectoryState === 'ready' && trajectory ? (
              <>
                <p className="text-xs text-text-secondary">
                  {forecastMeta ? (
                    <>
                      {forecastMeta.model} · forecast from {forecastMeta.origin}, covering{' '}
                      {trajectory[0]?.date} to {trajectory[trajectory.length - 1]?.date}. Synthetic
                      operational data (PRD §8.2), not a measurement.
                    </>
                  ) : null}
                </p>
                <div className="grid gap-1 pt-2 items-end h-32"
                     style={{ gridTemplateColumns: `repeat(${trajectory.length}, minmax(0, 1fr))` }}>
                  {trajectory.map((d) => {
                    const peak = Math.max(...trajectory.map((f) => Math.max(f.median, f.baseline)), 1)
                    const medianH = Math.round((d.median / peak) * 100)
                    const baseH = Math.round((d.baseline / peak) * 100)
                    return (
                      <div key={d.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-0.5 h-24">
                          <div
                            style={{ height: `${medianH}%` }}
                            className="w-1.5 bg-accent rounded-t-sm"
                            title={`${d.date} · forecast median ${Math.round(d.median).toLocaleString()} t`}
                          />
                          <div
                            style={{ height: `${baseH}%` }}
                            className="w-1.5 bg-text-tertiary rounded-t-sm"
                            title={`${d.date} · seasonal-naive ${Math.round(d.baseline).toLocaleString()} t`}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-secondary">
                          {d.date.slice(8)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : trajectoryState === 'warming' ? (
              <p className="py-8 text-center text-xs text-accent" role="status">
                Computing this mine&rsquo;s forecast in the background — the chart appears when it
                finishes.
              </p>
            ) : trajectoryState === 'loading' ? (
              <p className="py-8 text-center text-xs text-text-secondary">Loading the forecast…</p>
            ) : (
              <p className="py-8 text-center text-xs text-text-secondary">
                No forecast is available for this mine, so no daily chart is drawn. A shape without
                a forecast behind it would not be a forecast.
              </p>
            )}
          </div>

          {/* Simulation summary — only after a simulation has produced one */}
          {simError ? (
            <div className="p-4 rounded-md border border-status-critical/30 bg-status-critical/5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-status-critical shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono text-status-critical font-bold uppercase tracking-wider">
                  Simulation unavailable
                </div>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {simError} No result is shown, because a number this screen invented would be
                  indistinguishable from one the model produced.
                </p>
              </div>
            </div>
          ) : recoveryVal === null ? (
            <div className="p-4 rounded-md border border-border-default bg-surface-2 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-text-tertiary shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Set the shift window, blast delay and redeployment above, then run the simulation.
                Nothing is shown here until it returns a result.
              </p>
            </div>
          ) : (
          <div
            className="p-4 rounded-md bg-gradient-to-r from-[rgba(0,255,136,0.15)] to-[rgba(56,189,248,0.15)] border border-accent/40 flex items-start gap-3"
            data-provenance="derived"
          >
            <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono text-accent font-bold uppercase tracking-wider">
                Simulation result
              </div>
              <p className="text-xs text-text-primary font-sans mt-0.5 leading-relaxed">
                Shifting haulage to <span className="text-accent font-bold">{shift}</span> with{' '}
                <span className="text-accent font-bold">{redeploy.toUpperCase()}</span> redeployment
                changes output by{' '}
                <span className="text-status-caution font-bold">
                  {recoveryVal >= 0 ? '+' : ''}{recoveryVal.toLocaleString()} t
                </span>{' '}
                against the register baseline
                {riskDelta !== null ? (
                  <>
                    , with a modelled shortfall-risk change of{' '}
                    <span className="text-accent font-bold">
                      {(riskDelta * 100).toFixed(1)} pp
                    </span>
                  </>
                ) : null}
                . Simulated on synthetic operational data (PRD §8.2) — decision support, not a
                commitment.
              </p>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Saved Scenarios History & Comparison Drawer */}
      {history.length > 0 && (
        <div className="pt-4 border-t border-border-default space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-status-caution" />
              <span>Saved Scenario Archives ({history.length} Scenarios Recorded)</span>
            </h3>
            <span className="text-xs font-mono text-text-secondary">Encrypted Mission Ledger</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.slice(0, 6).map((s) => (
              <div
                key={s.id}
                onClick={() => setComparedScenario(s)}
                data-provenance="derived"
                className={`ios-glass-inset p-3.5 rounded-md border transition-colors cursor-pointer hover:border-accent/50 ${
                  comparedScenario?.id === s.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border-default bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono font-bold text-text-primary mb-1">
                  <span>{s.mine_name}</span>
                  <span className="text-xs text-text-secondary">
                    {new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs font-mono text-text-secondary space-x-1">
                  <span>SHIFT {s.shift_window}</span>
                  <span>&bull; BLAST +{s.blasting_delay_hours}H</span>
                  <span>&bull; {s.redeploy.toUpperCase()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono">
                  <span className="text-text-secondary">{s.baseline_production_t.toLocaleString()}T &rarr;</span>
                  <span className="text-accent font-bold">{s.predicted_production_t.toLocaleString()}T</span>
                  <span className="text-status-caution font-bold">
                    ({s.recovery_t >= 0 ? '+' : ''}{s.recovery_t.toLocaleString()} T)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
