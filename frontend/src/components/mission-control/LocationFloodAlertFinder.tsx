'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Button, EmptyState, Skeleton, StatusDot, type Status } from '@/components/ui/primitives'
import { Metric } from '@/components/console/Evidence'
import { derived, measured } from '@/lib/provenance'

/**
 * Rainfall context for a location, from measured weather only.
 *
 * WHAT THIS REPLACED. The previous implementation fabricated most of what it
 * displayed, on a screen about flooding:
 *
 *   - Rainfall, soil moisture, temperature and humidity were initialised from
 *     latitude (`rain14d = lat >= 21.5 ? 124.5 : 88.0`) and shown as readings
 *     whenever the weather request failed.
 *   - When the API returned no precipitation, it SYNTHESISED a 14-day curve
 *     from `sin()` of the coordinates — the comment called it "build a distinct
 *     realistic monsoon curve" — and summed it into a 14-day total.
 *   - Null daily readings were coerced to 0 mm and added to that total, so a
 *     gap in the record became a measured dry day.
 *   - The risk level depended on `locSeed > 0.42`, a hash of the coordinates.
 *     Two places with identical weather could differ in reported risk.
 *   - It emitted per-day pump discharge, a "30-Minute Cloudburst Prediction
 *     Lead Time Vector" and `scadaPumpPowerPct`, for a SCADA integration that
 *     is PRD §4 non-goal 2 and does not exist.
 *   - All of it was labelled `source: 'LIVE Open-Meteo & ISRO MOSDAC Telemetry
 *     Stream'`. MOSDAC is not a source of this project.
 *
 * What remains is what Open-Meteo actually returns. Missing days are gaps, not
 * zeros. There is no forecast, no lead time and no pump: this shows measured
 * rainfall and says what it is.
 */

type Reading = { date: string; rainfallMm: number | null }

interface FloodContext {
  locationName: string
  lat: number
  lng: number
  observedAt: string
  rainfall14dMm: number
  daysMeasured: number
  daysMissing: number
  tempC: number | null
  humidityPct: number | null
  soilMoisturePct: number | null
  readings: Reading[]
}

/**
 * Threshold rule, stated rather than modelled. This is not a flood forecast —
 * it is a reading of accumulated rainfall against two fixed numbers, and the
 * numbers are shown so a reader can disagree with them.
 */
const HIGH_MM = 95
const ELEVATED_MM = 50

function band(mm: number): { status: Status; label: string } {
  if (mm > HIGH_MM) return { status: 'critical', label: `above ${HIGH_MM} mm` }
  if (mm > ELEVATED_MM) return { status: 'caution', label: `above ${ELEVATED_MM} mm` }
  return { status: 'nominal', label: `at or below ${ELEVATED_MM} mm` }
}

interface Props {
  onSelectMine?: (mine: unknown) => void
}

export default function LocationFloodAlertFinder(_props: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FloodContext | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const geoRes = await fetch(`/api/v1/geocode?q=${encodeURIComponent(q)}`)
      if (!geoRes.ok) throw new Error(`Location lookup failed (${geoRes.status}).`)
      const geo = await geoRes.json()
      const place = geo?.results?.[0]
      if (!place) throw new Error(`No location matched "${q}".`)

      const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${place.lat}&longitude=${place.lng}` +
        '&current=temperature_2m,relative_humidity_2m' +
        '&daily=precipitation_sum&past_days=14&forecast_days=0' +
        '&hourly=soil_moisture_0_to_1cm&timezone=UTC'

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Weather service returned ${res.status}. No reading is shown.`)
      const wx = await res.json()

      const dates: string[] = wx?.daily?.time ?? []
      const sums: (number | null)[] = wx?.daily?.precipitation_sum ?? []
      if (!dates.length) throw new Error('The weather service returned no daily record for this location.')

      // Nulls stay null. A missing day is not a dry day, and the total below is
      // explicitly a total of the days that WERE measured.
      const readings: Reading[] = dates.map((d, i) => ({
        date: d,
        rainfallMm: typeof sums[i] === 'number' ? (sums[i] as number) : null,
      }))
      const measuredDays = readings.filter((r) => r.rainfallMm !== null)
      const total = Math.round(measuredDays.reduce((a, r) => a + (r.rainfallMm as number), 0) * 10) / 10

      const soil = wx?.hourly?.soil_moisture_0_to_1cm?.find((v: number | null) => typeof v === 'number')

      setData({
        locationName: place.displayName || place.name || q,
        lat: place.lat,
        lng: place.lng,
        observedAt: wx?.current?.time || dates[dates.length - 1],
        rainfall14dMm: total,
        daysMeasured: measuredDays.length,
        daysMissing: readings.length - measuredDays.length,
        tempC: typeof wx?.current?.temperature_2m === 'number' ? wx.current.temperature_2m : null,
        humidityPct: typeof wx?.current?.relative_humidity_2m === 'number' ? wx.current.relative_humidity_2m : null,
        soilMoisturePct: typeof soil === 'number' ? Math.round(soil * 100) : null,
        readings,
      })
    } catch (err: any) {
      setError(err?.message || 'The reading could not be retrieved.')
    } finally {
      setLoading(false)
    }
  }

  const SOURCE = 'Open-Meteo forecast API (ERA5-backed reanalysis and station observations)'

  return (
    <section>
      <form onSubmit={run} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="flood-location" className="label mb-1.5 block">
            Location
          </label>
          <input
            id="flood-location"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Balaghat, Nagpur, a district or a place name"
            className="h-10 w-full rounded-md border border-border-interactive bg-surface-2 px-3 text-base text-text-primary transition-colors duration-[120ms] ease-out placeholder:text-text-tertiary hover:bg-surface-3"
          />
        </div>
        <Button type="submit" variant="primary" size="md" disabled={loading || !query.trim()}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {loading ? 'Reading…' : 'Read rainfall'}
        </Button>
      </form>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : null}

      {error ? (
        <EmptyState
          className="mt-6"
          title="No reading available"
          detail={`${error} Nothing is estimated in its place — a rainfall figure that was not measured is worse than none on a screen about flooding.`}
        />
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold">{data.locationName}</h3>
            <p className="mt-1 font-mono text-xs text-text-tertiary">
              {data.lat.toFixed(4)}, {data.lng.toFixed(4)} · observed {data.observedAt} UTC
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Rainfall, last 14 days"
              emphasis
              display={data.rainfall14dMm.toLocaleString()}
              unit="mm"
              env={measured(data.rainfall14dMm, 'mm', SOURCE, {
                vintage: data.observedAt,
                method:
                  `Sum of ${data.daysMeasured} measured daily totals` +
                  (data.daysMissing > 0
                    ? `. ${data.daysMissing} day(s) had no record and are excluded rather than counted as zero, so this is a total over ${data.daysMeasured} days, not 14.`
                    : ' over the full 14-day window.'),
              })}
            />
            <Metric
              label="Temperature"
              display={data.tempC != null ? data.tempC.toFixed(1) : null}
              unit="°C"
              unavailableReason="The service returned no current temperature."
              env={data.tempC != null ? measured(data.tempC, '°C', SOURCE, { vintage: data.observedAt }) : undefined}
            />
            <Metric
              label="Relative humidity"
              display={data.humidityPct != null ? data.humidityPct : null}
              unit="%"
              unavailableReason="The service returned no current humidity."
              env={data.humidityPct != null ? measured(data.humidityPct, '%', SOURCE, { vintage: data.observedAt }) : undefined}
            />
            <Metric
              label="Soil moisture, 0–1 cm"
              display={data.soilMoisturePct != null ? data.soilMoisturePct : null}
              unit="%"
              unavailableReason="The service returned no soil-moisture value for this location."
              env={
                data.soilMoisturePct != null
                  ? derived(data.soilMoisturePct, '%', SOURCE, {
                      vintage: data.observedAt,
                      method: 'First non-null hourly value in the window, expressed as a percentage.',
                    })
                  : undefined
              }
            />
          </div>

          <div className="rounded-md border border-border-default bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="label">Daily rainfall, measured</h4>
              <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                <StatusDot status={band(data.rainfall14dMm).status} />
                14-day total {band(data.rainfall14dMm).label}
              </span>
            </div>

            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.readings} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    unit="mm"
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
                    formatter={(v: any) => [v == null ? 'no record' : `${v} mm`, 'rainfall']}
                  />
                  <ReferenceLine
                    y={ELEVATED_MM / 14}
                    stroke="var(--color-text-tertiary)"
                    strokeDasharray="4 3"
                  />
                  <Bar
                    dataKey="rainfallMm"
                    fill="var(--color-accent)"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="measure mt-3 text-xs text-text-tertiary">
              Days with no record are drawn as gaps, not as zero rainfall. The dashed line is the
              daily average that would reach the {ELEVATED_MM} mm threshold over 14 days.
            </p>
          </div>

          <p className="measure text-xs text-text-tertiary">
            The band above compares accumulated rainfall with two fixed thresholds
            ({ELEVATED_MM} mm and {HIGH_MM} mm over 14 days). It is not a flood forecast, it models
            no drainage or catchment, and it controls no equipment. Use it as context for a person
            deciding, not as a warning system.
          </p>
        </div>
      ) : null}
    </section>
  )
}
