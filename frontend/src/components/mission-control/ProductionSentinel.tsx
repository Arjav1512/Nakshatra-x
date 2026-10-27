'use client'

import { useEffect, useState } from 'react'
import { type MineRow, fetchMines, fetchTelemetry } from '@/lib/console-api'
import { Metric, IntegrityBanner } from '@/components/console/Evidence'
import { measuredOrNull } from '@/lib/provenance'
import { EmptyState, Skeleton, StatusDot, riskBand } from '@/components/ui/primitives'

/**
 * Track B operational detail for one mine.
 *
 * WHAT THIS REPLACED. The previous component had no `fetch` anywhere. Every
 * number it displayed was manufactured in the browser:
 *
 *   liveShiftExtracted = mine.targetTonnes * 0.018
 *   liveHourlyRate     = mine.targetTonnes / 240
 *   trucksDispatched   = 64          // literal
 *   activeSkipCycle    = 142         // literal
 *   shiftTargetTonnes  = targetTonnes / 60
 *
 * alongside a simulated SCADA event log, an `isScadaPumpActive` flag and a
 * `radarCloudburstAlert` — for a SCADA and radar integration that is PRD §4
 * non-goal 2 and does not exist. A "STREAMING" badge sat on top of it, with the
 * word "simulated" only in a hover tooltip.
 *
 * The real operational picture was already available: /telemetry returns every
 * figure below inside a provenance envelope, which is why each one can go
 * straight through Metric and carry its own source, vintage and kind. Where a
 * value is synthetic the badge says so, on the value itself, not in a tooltip.
 */

const TILES: { key: string; label: string }[] = [
  // Not the forecaster's shortfall: the console's figure comes from the
  // validated per-grade model, this from a conditions heuristic. Labelled
  // alike, they gave one mine 0.7% and 43% for the same question.
  { key: 'forecast.shortfall_percentage', label: 'Conditions drag, % of plan' },
  { key: 'forecast.total_planned_tonnes', label: 'Planned output' },
  { key: 'risk.composite_risk_score', label: 'Composite risk' },
  { key: 'operations.equipment_availability_pct', label: 'Equipment availability' },
  { key: 'risk.live_downtime_hours', label: 'Downtime' },
  { key: 'operations.blasts_this_week', label: 'Blasts this week' },
  { key: 'weather.rainfall_14d_mm', label: 'Rainfall, 14 days' },
  { key: 'weather.land_surface_temp_c', label: 'Land surface temperature' },
]

export default function ProductionSentinel() {
  const [mines, setMines] = useState<MineRow[] | null>(null)
  const [minesErr, setMinesErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [telemetry, setTelemetry] = useState<any>(null)
  const [telErr, setTelErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchMines().then((r) => {
      if (!alive) return
      if (!r.ok) { setMinesErr(r.error); return }
      setMines(r.data)
      if (r.data.length) setSelected(r.data[0].id)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (selected == null) return
    let alive = true
    setTelemetry(null)
    setTelErr(null)
    fetchTelemetry(selected).then((r) => {
      if (!alive) return
      if (r.ok) setTelemetry(r.data)
      else setTelErr(`${r.error}${r.status ? ` (${r.status})` : ''}`)
    })
    return () => { alive = false }
  }, [selected])

  if (minesErr) {
    return (
      <EmptyState
        title="Mine register unavailable"
        detail={`${minesErr} No production figures are shown, because the register defines which mine they would belong to.`}
      />
    )
  }

  const prov = telemetry?.provenance ?? {}
  const risk = prov['risk.composite_risk_score']?.value

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="production-mine" className="label mb-1.5 block">
          Mine
        </label>
        {!mines ? (
          <Skeleton className="h-[46px] w-64" />
        ) : (
          <select
            id="production-mine"
            value={selected ?? ''}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="h-[46px] w-full max-w-sm rounded-md border border-border-interactive bg-surface-0 px-3.5 text-base tracking-[0.02em] text-text-primary transition-[border-color] duration-[180ms] ease-out hover:border-text-primary focus:border-text-primary"
          >
            {mines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.mine_code}
              </option>
            ))}
          </select>
        )}
      </div>

      {telemetry?.data_integrity ? (
        <IntegrityBanner integrity={telemetry.data_integrity} />
      ) : null}

      {telErr ? (
        <EmptyState
          title="Telemetry unavailable"
          detail={`${telErr} Nothing is estimated in its place.`}
        />
      ) : !telemetry ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => i).map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
          <span className="sr-only">Loading telemetry</span>
        </div>
      ) : (
        <>
          {typeof risk === 'number' ? (
            <p className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <StatusDot status={riskBand(risk).status} />
              Composite risk is {riskBand(risk).label} for this mine
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.filter((t) => prov[t.key]).map((t) => (
              <Metric
                key={t.key}
                label={t.label}
                data={measuredOrNull(prov[t.key])}
                unit={prov[t.key].unit}
            unavailable="The service returned no value for this field, so none is shown."
          />
            ))}
          </div>

          <p className="measure text-xs text-text-tertiary">
            Every tile above is rendered from the telemetry envelope, so each carries its own
            source and kind — weather is measured, operational figures are synthetic, and the
            badge on each value says which. The drag and composite-risk figures are a heuristic
            over this week&apos;s conditions, not the forecaster&apos;s expected shortfall: that,
            with its per-grade intervals, backtest and constraint-checked actions, is on the
            console for this mine.
          </p>
        </>
      )}
    </div>
  )
}
