'use client'

import type { MineInfo, RiskAnalysis, WeatherSignal } from './types'
import { Metric } from '@/components/console/Evidence'
import { EmptyState, StatusDot, type Status } from '@/components/ui/primitives'
import { derived, measured, measuredOrNull, synthetic } from '@/lib/provenance'

/**
 * Risk context for the mine whose stockpiles are being blended.
 *
 * WHAT THIS REPLACED. Every value had a fabricated fallback keyed off the
 * mine's state, so a failed telemetry fetch produced confident-looking numbers:
 *
 *   compositeScore = risk?.composite_risk_score ?? (state === 'MP' ? 72.4 : 44.5)
 *   rainfallMm     = weather?.rainfall_14d_mm   ?? (state === 'MP' ? 118  : 64)
 *   soilMoisture   = weather?.soil_moisture_pct ?? (state === 'MP' ? 42   : 34)
 *   landTemp       = weather?.land_surface_temp_c ?? 34.2
 *
 * It also synthesised a 14-day rainfall series from `sin(i * 0.7)` and drew it
 * as a trend, and labelled itself "Isolation Forest & Constraint Scoring" —
 * Isolation Forest is not a dependency of this project and fits nothing here.
 *
 * Absent telemetry now renders as absent.
 */

interface Props {
  mine: MineInfo
  weather: WeatherSignal | null
  risk: RiskAnalysis | null
}

function band(score: number): { status: Status; label: string } {
  if (score >= 70) return { status: 'critical', label: 'high' }
  if (score >= 40) return { status: 'caution', label: 'elevated' }
  return { status: 'nominal', label: 'low' }
}

const WEATHER_SOURCE = 'NASA POWER daily meteorology'

/**
 * Build the envelope from the payload's own flags, never from a constant.
 *
 * These three cards called `measured(value, unit, WEATHER_SOURCE)` outright. In
 * degraded mode — the FastAPI layer unreachable — `fetchLiveMineTelemetry`
 * falls back to `degradedTelemetry`, which *generates* rainfall in the browser
 * from `boundedNormal(85, 25, 0, 320)` and labels itself honestly:
 * `is_live: false`, `is_synthetic: true`, `source: 'SYNTHETIC FALLBACK —
 * service layer unreachable. Not observed data.'`
 *
 * The component threw all of that away. The card rendered
 * **LIVE · 49.7 mm · NASA POWER daily meteorology** over a number no instrument
 * produced. The data was honest; the badge was not, because the badge was a
 * literal.
 *
 * Found by running the provenance guard with the backend stopped — the value
 * was attributed, so the ordinary run passed it.
 */
function weatherEnvelope<T>(
  value: T,
  unit: string,
  weather: { is_synthetic?: boolean; source?: string; updated_at?: string } | null
) {
  const vintage = weather?.updated_at
  if (weather?.is_synthetic) {
    return synthetic(value, unit, weather.source ?? 'Synthetic fallback — service layer unreachable.', { vintage })
  }
  return measured(value, unit, weather?.source ?? WEATHER_SOURCE, { vintage })
}

export default function RiskCockpit({ mine, weather, risk }: Props) {
  if (!weather && !risk) {
    return (
      <EmptyState
        title="Risk context unavailable"
        detail={`No telemetry was returned for ${mine.name}. Nothing is shown in its place — the figures here previously defaulted to values chosen from the mine's state, which made a failed request look like a reading.`}
      />
    )
  }

  const score = risk?.composite_risk_score

  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label">Risk context</p>
          <h2 className="mt-1 text-lg font-semibold">{mine.name}</h2>
        </div>
        {typeof score === 'number' ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <StatusDot status={band(score).status} />
            {band(score).label}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Composite risk"
          emphasis
          
          unit="/ 100"
          data={measuredOrNull(typeof score === 'number'
              ? derived(score, 'score 0-100', 'Constraint-weighted composite over weather and operational drivers', {
                  method:
                    'A weighted index, not a probability. The calibrated probability of shortfall is on the console, from the Track B forecaster.',
                })
              : undefined, () => String(typeof score === 'number' ? score.toFixed(1) : null))}
            unavailable="The risk service returned no composite score."
          />
        <Metric
          label="Rainfall, 14 days"
          
          unit="mm"
          data={measuredOrNull(weather?.rainfall_14d_mm != null
              ? weatherEnvelope(weather.rainfall_14d_mm, 'mm', weather)
              : undefined, () => String(weather?.rainfall_14d_mm != null ? weather.rainfall_14d_mm : null))}
            unavailable="No measured rainfall was returned for this location."
          />
        <Metric
          label="Soil moisture"
          
          unit="%"
          data={measuredOrNull(weather?.soil_moisture_pct != null
              ? weatherEnvelope(weather.soil_moisture_pct, '%', weather)
              : undefined, () => String(weather?.soil_moisture_pct != null ? weather.soil_moisture_pct : null))}
            unavailable="No soil-moisture value was returned."
          />
        <Metric
          label="Land surface temperature"
          
          unit="°C"
          data={measuredOrNull(weather?.land_surface_temp_c != null
              ? weatherEnvelope(weather.land_surface_temp_c, '°C', weather)
              : undefined, () => String(weather?.land_surface_temp_c != null ? weather.land_surface_temp_c : null))}
            unavailable="No land-surface temperature was returned."
          />
      </div>

      <p className="measure mt-4 text-xs text-text-tertiary">
        Rain and temperature are measured. The composite score is an index over those measurements
        and the mine's synthetic operational record — useful for ordering mines, not for stating
        how likely a shortfall is. That number is on the console, with its interval.
      </p>
    </div>
  )
}
