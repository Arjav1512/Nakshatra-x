'use client'

import { CIVIDIS } from '@/lib/colormap'
import { type LegendFact, type TileSourceMode, fetchDate } from '@/lib/map-tile-layers'

/**
 * The legend for whichever map layer is showing.
 *
 * Every word of provenance here arrives from the service that produced the
 * layer — collection, dates, cloud filter, mosaic method, scale, quantity,
 * attribution. This component lays it out; it does not author it. The map
 * used to describe its layers in fixed copy while the layers themselves came
 * from files nobody checked, and a legend that writes its own facts can drift
 * from the data in exactly that way.
 *
 * Two words it deliberately does not use:
 *   - "LIVE" for the measured points. They are real band values, but sampled
 *     once into a training table, not fetched this request. The console's
 *     SourceBadge maps `measured` to LIVE, which is right for weather and wrong
 *     here, so this legend says MEASURED.
 *   - "LIVE" for a tile layer that is drawing from the local cache. It says
 *     CACHED with the date the tiles were fetched.
 */
export type LegendScale = {
  /** Colours in order, low to high. */
  stops: readonly string[]
  low: string
  high: string
  domain?: [number, number] | null
  colormap: string
  stopsSource?: string | null
}

export type LegendModel = {
  layerId: string
  name: string
  kind: 'measured' | 'derived'
  /** For raster tile layers only. */
  tile?: {
    mode: TileSourceMode
    fetchedAt: string | null
    liveReason: string | null
    tilejsonUrl?: string | null
  } | null
  status: 'ok' | 'loading' | 'unavailable'
  reason?: string | null
  facts: LegendFact[]
  scale?: LegendScale | null
  caveat?: string | null
  attribution?: { required: string; tiler: string; licenceName: string; licenceUrl: string } | null
  modelVersion?: string | null
}

const KIND_BADGE: Record<string, { label: string; cls: string; title: string }> = {
  measured: {
    label: 'MEASURED',
    cls: 'border-status-nominal/40 bg-status-nominal/10 text-status-nominal',
    title: 'Observed by a sensor. Not model output.',
  },
  derived: {
    label: 'DERIVED',
    cls: 'border-accent/40 bg-accent-muted text-accent',
    title: 'Computed by a model from measured inputs. Not an observation.',
  },
}

/**
 * A reason as a clause. Upstream reasons arrive as sentences, and the legend
 * wraps them in its own — so "…stay off." became "…stay off.. Nothing is drawn".
 */
function clause(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/[.\s]+$/, '')
}

function TileSourcePill({ mode, fetchedAt }: { mode: TileSourceMode; fetchedAt: string | null }) {
  const date = fetchDate(fetchedAt)
  const text =
    mode === 'live'
      ? 'LIVE'
      : mode === 'cache'
        ? `CACHED · fetched ${date ?? 'unknown date'}`
        : mode === 'mixed'
          ? `PARTLY CACHED · fetched ${date ?? 'unknown date'}`
          : mode === 'unavailable'
            ? 'UNAVAILABLE'
            : 'LOADING'
  const cls =
    mode === 'live'
      ? 'border-status-nominal/40 bg-status-nominal/10 text-status-nominal'
      : mode === 'cache' || mode === 'mixed'
        ? 'border-status-caution/50 bg-status-caution/10 text-status-caution'
        : 'border-border-default bg-surface-1 text-text-tertiary'
  return (
    <span
      data-tile-source={mode}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-xs font-medium tracking-wide ${cls}`}
      title={
        mode === 'cache' || mode === 'mixed'
          ? 'Drawn from the local tile cache because the live tiler failed. The date is when these tiles were fetched.'
          : mode === 'live'
            ? 'Fetched this session from Planetary Computer.'
            : undefined
      }
    >
      {text}
    </span>
  )
}

function ScaleBar({ scale }: { scale: LegendScale }) {
  const gradient = `linear-gradient(to right, ${scale.stops.join(', ')})`
  return (
    <div className="mt-2">
      <div
        className="h-2.5 w-full rounded-sm border border-border-default"
        style={{ backgroundImage: gradient }}
        role="img"
        aria-label={`Colour scale ${scale.colormap}, from ${scale.low} to ${scale.high}`}
      />
      <div className="mt-1 flex justify-between font-mono text-xs text-text-tertiary">
        <span>
          {scale.domain ? `${scale.domain[0]} · ` : ''}
          {scale.low}
        </span>
        <span>
          {scale.high}
          {scale.domain ? ` · ${scale.domain[1]}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function MapLayerLegend({ model }: { model: LegendModel }) {
  const badge = KIND_BADGE[model.kind]
  return (
    <section
      className="flex flex-col gap-2 text-xs"
      data-layer-legend={model.layerId}
      data-provenance={model.kind}
      data-provenance-model={model.modelVersion ?? undefined}
      aria-label={`${model.name} legend`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-text-primary">{model.name}</span>
        {badge ? (
          <span
            title={badge.title}
            className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-xs font-medium tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
        ) : null}
        {model.tile ? <TileSourcePill mode={model.tile.mode} fetchedAt={model.tile.fetchedAt} /> : null}
      </div>

      {model.status === 'unavailable' && !(model.tile && (model.tile.mode === 'cache' || model.tile.mode === 'mixed')) ? (
        <p role="status" className="leading-snug text-status-caution">
          Layer unavailable: {clause(model.reason) || 'no reason given'}. Nothing is drawn in its place.
        </p>
      ) : null}

      {model.tile?.liveReason && (model.tile.mode === 'cache' || model.tile.mode === 'mixed') ? (
        <p role="status" className="leading-snug text-text-secondary">
          Live tiler failed: {clause(model.tile.liveReason)}.
        </p>
      ) : null}

      {model.facts.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          {model.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="font-mono text-text-tertiary">{f.label}</dt>
              <dd className="break-words text-text-secondary">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {model.scale ? <ScaleBar scale={model.scale} /> : null}

      {model.caveat ? (
        <p className="border-l-2 border-status-caution/60 pl-2 leading-snug text-text-secondary">
          {model.caveat}
        </p>
      ) : null}

      {model.attribution ? (
        <p className="leading-snug text-text-tertiary" data-attribution-layer={model.layerId}>
          {model.attribution.required} · {model.attribution.tiler} ·{' '}
          <a
            href={model.attribution.licenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-text-secondary"
          >
            {model.attribution.licenceName}
          </a>
        </p>
      ) : null}
    </section>
  )
}

/** The cividis ramp as legend stops, for the two grid layers. */
export const CIVIDIS_STOPS: readonly string[] = CIVIDIS
