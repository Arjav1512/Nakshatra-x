'use client'

import { useState, useEffect } from 'react'
import { fetchForecast } from '@/lib/console-api'
import { ASSUMPTION_GROUPS, ASSUMPTION_NOTE } from '@/lib/scenario-assumptions'
import { Metric } from '@/components/console/Evidence'
import { assumption, measuredValue, reference } from '@/lib/provenance'
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

/**
 * A scenario the user ran. `risk_delta` is gone: it was a hardcoded ternary
 * (0.06 / 0.08 / -0.05 / -0.03) and nothing in this system estimates a change
 * in risk. `predicted_` became `estimated_`, because a prediction is what the
 * forecaster makes and this is arithmetic over stated assumptions.
 */
export type Scenario = {
  id: string
  mine_name: string
  /** What the planner chose, per assumption group. */
  selections: Record<string, string | number>
  /** The multiplier used for each group, as shown on screen. */
  factors: Record<string, number>
  combined_multiplier: number
  baseline_production_t: number
  baseline_source: string
  baseline_model_version: string | null
  estimated_production_t: number
  difference_t: number
  kind: 'assumption'
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
  // Null, not 16800.
  //
  // This is a placeholder used before a mine is chosen, and a current
  // production figure is a reading — the register is the only thing entitled to
  // state one. With the service layer down it was the last number still on
  // screen here, sourced from nothing but this line.
  currentProduction: null,
}

export default function MineTwinPanel({ selectedMine = DEFAULT_MINE }: Props) {
  // What-If Simulator Controls
  const [shift, setShift] = useState<'04-10' | '06-14' | '22-06'>('04-10')
  const [blastDelay, setBlastDelay] = useState<0 | 6 | 12>(0)
  const [redeploy, setRedeploy] = useState<'none' | '1-crusher' | '1-shovel-1-dumper'>('1-shovel-1-dumper')
  const [tolerance, setTolerance] = useState<10 | 20 | 30>(20)

  /**
   * The multipliers, editable.
   *
   * They used to live inside the route handler, invisible to whoever was
   * reading the output. PRD C-4 asks a recommendation to state its expected
   * effect *and its assumptions*; an assumption you cannot see or change is not
   * stated. Defaults come from `scenario-assumptions.ts`, which is the one
   * place they are written down.
   */
  const [factors, setFactors] = useState<Record<string, number>>(() => {
    // Seed from the controls' own initial selections, not from `options[0]`.
    // Those disagreed: the panel opened on "+1 shovel, +1 dumper" while the
    // factor row showed 1.0 for redeployment, so the arithmetic on screen did
    // not match the options on screen.
    const initial: Record<string, string | number> = {
      shiftWindow: '04-10',
      blastingDelayHours: 0,
      redeploy: '1-shovel-1-dumper',
      dryBlastTolerance: 20,
    }
    return Object.fromEntries(
      ASSUMPTION_GROUPS.map((g) => [
        g.id,
        g.options.find((o) => o.value === initial[g.id])?.factor ?? g.options[0]?.factor ?? 1,
      ])
    )
  })
  // When a control moves, adopt that option's documented default factor —
  // unless the planner has already overridden it.
  const chooseOption = (groupId: string, optionValue: string | number) => {
    const group = ASSUMPTION_GROUPS.find((g) => g.id === groupId)
    const opt = group?.options.find((o) => o.value === optionValue)
    if (opt) setFactors((f) => ({ ...f, [groupId]: opt.factor }))
  }

  const selectionOf: Record<string, string | number> = {
    shiftWindow: shift,
    blastingDelayHours: blastDelay,
    redeploy,
    dryBlastTolerance: tolerance,
  }

  // Simulation State
  // Null until a simulation has actually run.
  //
  // This used to be seeded with {predicted: 16620, recovery: 2420,
  // riskDelta: -0.05}, so the screen showed a complete "Digital Twin Result"
  // before anyone had pressed the button — three numbers presented as the
  // output of a simulation that had not happened.
  const [simResult, setSimResult] = useState<{
    estimated: number
    difference: number
    multiplier: number
    note: string
  } | null>(null)
  const [simError, setSimError] = useState<string | null>(null)
  /**
   * The constraint engine's verdict on these controls (PRD C-1..C-5).
   *
   * Arithmetic does not know that blasting at 02:00 is inside the statutory
   * rest window. The engine does, and its action vocabulary is exactly these
   * controls, so a scenario that cannot legally be run is reported as such
   * rather than quietly costed.
   */
  const [constraints, setConstraints] = useState<{
    feasible: boolean
    checks: { action_type: string; description: string; feasible: boolean; violations: { rule: string; detail: string }[] }[]
  } | null>(null)

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
    if (baselineProd === null) {
      setSimError(
        'No baseline is available for this mine, so there is nothing to apply the assumptions to.'
      )
      return
    }
    setLoading(true)
    setSimError(null)
    setConstraints(null)
    try {
      const res = await fetch('/api/v1/mine-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mineId: selectedMine.id,
          mineName: selectedMine.name,
          factors,
          selections: selectionOf,
          baselineProduction: baselineProd,
          baselineSource: `Track B forecast artifact, 14-day median${
            forecastMeta ? ` (${forecastMeta.model}, from ${forecastMeta.origin})` : ''
          }`,
          baselineModelVersion: forecastMeta?.model ?? null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSimResult({
          estimated: data.estimated,
          difference: data.difference,
          multiplier: data.combined_multiplier,
          note: data.model_note ?? ASSUMPTION_NOTE,
        })
        setSimError(null)
        setHistory(data.scenarios || [])

        // Check the controls against the operating rules, in parallel with
        // showing the arithmetic — never instead of it.
        try {
          const cr = await fetch('/api/v1/scenario/constraint-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mine_id: selectedMine.numericId ?? 1,
              shift_window: shift,
              blasting_delay_hours: blastDelay,
              redeploy,
              dry_blast_tolerance_mm: tolerance,
            }),
          })
          setConstraints(cr.ok ? await cr.json() : null)
        } catch {
          setConstraints(null)
        }
      } else {
        const body = await res.json().catch(() => null)
        setSimResult(null)
        setSimError(body?.error || `The scenario service answered ${res.status}.`)
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
  /**
   * Baseline tonnes, from the mine's own forecast artifact.
   *
   * This read `selectedMine.currentProduction`, a client constant, and the
   * route defaulted a missing value to 14,200. Both are gone: the baseline is
   * the summed 14-day median from the artifact the console already serves, it
   * carries that artifact's model version, and when it cannot be read the
   * calculator says so instead of estimating from nothing.
   */
  const baselineProd =
    trajectory && trajectory.length
      ? Math.round(trajectory.reduce((a, d) => a + d.median, 0))
      : null
  const estimatedProd = simResult?.estimated ?? null
  const differenceVal = simResult?.difference ?? null

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
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Baseline, 14 days"
              data={
                baselineProd !== null && forecastMeta
                  ? measuredValue(
                      reference(baselineProd, 't', `Track B forecast artifact (${forecastMeta.model})`, {
                        model_version: forecastMeta.model,
                        method: `Sum of the 14-day median trajectory, forecast from ${forecastMeta.origin}.`,
                      })
                    )
                  : null
              }
              unavailable="No forecast artifact for this mine, so there is no baseline to apply assumptions to."
            />

            <Metric
              label="Estimate under assumptions"
              emphasis
              data={
                estimatedProd !== null && simResult
                  ? measuredValue(
                      assumption(
                        estimatedProd,
                        't',
                        'Arithmetic over the planner assumptions shown below',
                        ASSUMPTION_GROUPS.map((g) => ({
                          label: g.label,
                          value: factors[g.id] ?? 1,
                        })),
                        { method: simResult.note }
                      )
                    )
                  : null
              }
              unavailable="Set the assumptions below and run the scenario. Nothing is shown until you do."
            />

            <Metric
              label="Difference vs baseline"
              data={
                differenceVal !== null && simResult
                  ? measuredValue(
                      assumption(
                        differenceVal,
                        't',
                        `Estimate minus baseline, combined multiplier ${simResult.multiplier}`,
                        ASSUMPTION_GROUPS.map((g) => ({
                          label: g.label,
                          value: factors[g.id] ?? 1,
                        })),
                        { method: simResult.note }
                      )
                    )
                  : null
              }
              unavailable="Run the scenario to compare it against the baseline."
            />
          </div>

          {/* The assumptions, on screen and editable (PRD C-4). */}
          <div className="rounded-md border border-border-default bg-surface-1 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Planner assumptions</h3>
              <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
                not fitted &middot; no data derived
              </span>
            </div>
            <p className="measure mt-2 text-xs text-text-secondary">{ASSUMPTION_NOTE}</p>

            <ul className="mt-4 space-y-3">
              {ASSUMPTION_GROUPS.map((g) => (
                <li key={g.id} className="border-l border-border-strong pl-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-text-primary">{g.label}</span>
                    <label className="flex items-center gap-2 text-xs text-text-tertiary">
                      <span className="font-mono">x</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={factors[g.id] ?? 1}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v) && v > 0) {
                            setFactors((f) => ({ ...f, [g.id]: v }))
                          }
                        }}
                        className="w-20 rounded-sm border border-border-default bg-surface-2 px-2 py-1 text-right font-mono text-xs text-text-primary tabular-nums"
                        aria-label={`${g.label} multiplier`}
                      />
                    </label>
                  </div>
                  <p className="measure mt-1 text-xs text-text-tertiary">{g.rationale}</p>
                </li>
              ))}
            </ul>
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
          ) : differenceVal === null ? (
            <div className="p-4 rounded-md border border-border-default bg-surface-2 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-text-tertiary shrink-0 mt-0.5" />
              <p className="measure text-xs text-text-secondary leading-relaxed">
                Choose the options above, adjust the assumptions if you disagree with them, then run
                the scenario. Nothing is shown here until you do.
              </p>
            </div>
          ) : (
          <div
            className="rounded-md border border-dashed border-text-tertiary/60 bg-surface-1 p-4"
            data-provenance="assumption"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
                Assumption-based estimate &mdash; not a forecast
              </span>
              <span className="font-mono text-xs text-text-tertiary tabular-nums">
                combined multiplier {simResult?.multiplier}
              </span>
            </div>
            <p className="measure mt-2 text-sm text-text-primary">
              With a {shift} haulage window, {redeploy.replace(/-/g, ' ')} and a {tolerance} mm
              dry-blast tolerance, this arithmetic gives{' '}
              <span className="font-mono tabular-nums">
                {differenceVal >= 0 ? '+' : ''}{differenceVal.toLocaleString()} t
              </span>{' '}
              against a baseline of{' '}
              <span className="font-mono tabular-nums">{baselineProd?.toLocaleString()} t</span>{' '}
              over 14 days.
            </p>
            {/* The route's own caveat, on screen rather than in a field nobody reads. */}
            <p className="measure mt-2 text-xs text-text-tertiary">{simResult?.note}</p>

            {constraints ? (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <p
                  className={`text-xs font-medium ${
                    constraints.feasible ? 'text-status-nominal' : 'text-status-critical'
                  }`}
                >
                  {constraints.feasible
                    ? 'Constraint check passed — these controls can be run as configured.'
                    : 'Constraint check failed — these controls cannot be run as configured.'}
                </p>
                <ul className="mt-1 space-y-1">
                  {constraints.checks.map((c) => (
                    <li key={c.action_type} className="text-xs text-text-secondary">
                      <span className="font-mono text-text-tertiary">{c.action_type}</span>{' '}
                      {c.feasible ? (
                        <span className="text-status-nominal">ok</span>
                      ) : (
                        c.violations.map((v) => (
                          <span key={v.rule} className="text-status-critical">
                            {v.detail}
                          </span>
                        ))
                      )}
                    </li>
                  ))}
                </ul>
                <p className="measure mt-1 text-xs text-text-tertiary">
                  Constraints are enforced, never learned. The estimate above is what the arithmetic
                  gives; this is whether the plan is allowed.
                </p>
              </div>
            ) : null}
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
              <span>Scenarios you have run ({history.length})</span>
            </h3>
            <span className="font-mono text-xs uppercase tracking-wider text-text-tertiary">assumption-based &middot; this session only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.slice(0, 6).map((s) => (
              <div
                key={s.id}
                onClick={() => setComparedScenario(s)}
                data-provenance="assumption"
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
                  {Object.entries(s.selections ?? {}).map(([k, v]) => (
                    <span key={k}>&bull; {String(v)}</span>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono">
                  <span className="text-text-secondary tabular-nums">
                    {s.baseline_production_t?.toLocaleString()} t &rarr;
                  </span>
                  <span className="text-text-primary font-bold tabular-nums">
                    {s.estimated_production_t?.toLocaleString()} t
                  </span>
                  <span className="text-text-tertiary tabular-nums">
                    ({s.difference_t >= 0 ? '+' : ''}{s.difference_t?.toLocaleString()} t)
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
