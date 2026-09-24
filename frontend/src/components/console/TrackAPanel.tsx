'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { derived, measured } from '@/lib/provenance'
import {
  type DrillTargetsResponse, type TrackAMetrics,
  fetchDrillTargets, fetchTrackAMetrics, predictPoint,
} from '@/lib/console-api'
import { cividis } from '@/lib/colormap'
import { Metric } from './Evidence'
import type { LayerType } from '@/components/mission-control/IndiaSatelliteMap'
import type { MineInfo } from '@/components/mission-control/types'

/**
 * The prospectivity map.
 *
 * It lived on /features/[id], which this stage redirects to /console. Track A
 * is where a prospectivity surface belongs, and putting it here also closes the
 * gap READINESS records against D-5: ranked targets existed only as a table,
 * never plotted.
 *
 * Loaded dynamically because it pulls in Leaflet, which has no business in the
 * bundle for anyone who opens Track B and never switches.
 */
const IndiaSatelliteMap = dynamic(
  () => import('@/components/mission-control/IndiaSatelliteMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] w-full rounded-md border border-border-default bg-surface-2">
        <span className="sr-only">Loading map</span>
      </div>
    ),
  }
)

/** Balaghat — PRD §13 Q4 names it the pilot; the map's own selector changes it. */
const DEFAULT_MAP_MINE: MineInfo = {
  id: 'balaghat',
  numericId: 1,
  name: 'Balaghat',
  code: 'MOIL-BAL-01',
  state: 'MP',
  lat: 21.83,
  lng: 80.19,
  zone: 'Central India',
  targetTonnes: 18000,
  currentProduction: 0,
}

/**
 * Track A — prospectivity (PRD A-3, A-4, A-5, A-7, D-1, D-5).
 *
 * Architecture: "Track A output goes straight to the dashboard. The decision
 * layer serves Track B only." So this panel talks to the prospectivity
 * endpoints directly and never routes through the recommender.
 *
 * Guardrails are rendered, not just documented: surface indicators only
 * (PRD §2.2), and output typed prospectivity_score — never "reserve" (§2.4).
 */

/** PRD §13 Q4 recommends an opencast mine for Track A; Balaghat is ~383 m underground. */
const OPENCAST_PILOT = { name: 'Dongri Buzurg', lat: 20.99, lng: 79.34 }

function Unavailable({ what, reason }: { what: string; reason: string }) {
  return (
    <div className="rounded-md border border-status-critical/30 bg-status-critical/5 p-3 text-xs">
      <p className="font-semibold text-status-critical">{what} unavailable</p>
      <p className="mt-1 leading-snug text-text-secondary">{reason}</p>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-text-secondary">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-tertiary border-t-status-nominal" />
      {label}
    </div>
  )
}

export function TrackAPanel() {
  const [mapMine, setMapMine] = useState<MineInfo>(DEFAULT_MAP_MINE)
  const [mapLayer, setMapLayer] = useState<LayerType>('prospectivity' as LayerType)
  const [metrics, setMetrics] = useState<TrackAMetrics | null>(null)
  const [mErr, setMErr] = useState<string | null>(null)
  const [targets, setTargets] = useState<DrillTargetsResponse | null>(null)
  const [tErr, setTErr] = useState<string | null>(null)
  const [probe, setProbe] = useState<any>(null)
  const [pErr, setPErr] = useState<string | null>(null)
  const [pLoading, setPLoading] = useState(false)
  const [lat, setLat] = useState(String(OPENCAST_PILOT.lat))
  const [lng, setLng] = useState(String(OPENCAST_PILOT.lng))
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    fetchTrackAMetrics().then((r) => { if (alive) r.ok ? setMetrics(r.data) : setMErr(r.error) })
    fetchDrillTargets(8).then((r) => { if (alive) r.ok ? setTargets(r.data) : setTErr(r.error) })
    return () => { alive = false }
  }, [])

  const runProbe = async () => {
    const la = Number(lat), ln = Number(lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) { setPErr('Latitude and longitude must be numbers.'); return }
    setPLoading(true); setPErr(null); setProbe(null)
    const r = await predictPoint(la, ln, live)
    r.ok ? setProbe(r.data) : setPErr(r.error)
    setPLoading(false)
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-status-nominal">
          Track A · Prospectivity
        </h2>
        {metrics ? (
          <p className="font-mono text-xs text-text-tertiary">
            {metrics.model_version} · validated {metrics.validation}
          </p>
        ) : null}
      </header>

      {/*
        The map leads Track A.

        It used to sit at the very bottom of this panel, below the metric tiles,
        the caveat panel and the full ranked-target table — 1,521 px down a
        2,513 px page, reachable only after opening the console, choosing a
        mine, switching track and scrolling 1.4 screens. It rendered correctly
        the whole time, which is why no test caught it: a prospectivity surface
        nobody scrolls to is missing in every sense that matters.
      */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="label">Prospectivity surface (PRD A-3, D-5)</h3>
          <p className="text-xs text-text-tertiary">
            Click any cell to score it against the model
          </p>
        </div>
        <div className="overflow-hidden rounded-md border border-border-default">
          <IndiaSatelliteMap
            selectedMine={mapMine}
            onSelectMine={setMapMine}
            activeLayer={mapLayer}
            onChangeLayer={setMapLayer}
          />
        </div>
        <p className="measure mt-2 text-xs text-text-tertiary">
          The surface scores where prospecting is more likely to be worthwhile from surface geology
          and terrain. It does not see ore underground, and a cell can be promising and poorly
          constrained at the same time — the kriging uncertainty below is what separates the two.
        </p>
      </div>

      {/* --- honest validation, AUC with its CI --- */}
      {mErr ? (
        <Unavailable what="Model metrics" reason={mErr} />
      ) : !metrics ? (
        <Spinner label="Loading validation metrics…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="LOMO AUC (honest)"
              emphasis
              display={metrics.lomo.auc.toFixed(2)}
              env={derived(metrics.lomo.auc, 'AUC', 'Leave-one-mine-out cross-validation', {
                model_version: metrics.model_version,
                method:
                  'Each fold holds out an entire deposit — the model must find a mine it has never seen.',
                uncertainty: {
                  plus_minus: Number(((metrics.lomo.auc_ci95[1] - metrics.lomo.auc_ci95[0]) / 2).toFixed(3)),
                  confidence: 0.95,
                  basis: `Percentile bootstrap, 95% CI [${metrics.lomo.auc_ci95[0]}, ${metrics.lomo.auc_ci95[1]}] over ${metrics.lomo.n_out_of_fold} out-of-fold points.`,
                },
              })}
            />
            <Metric
              label="Spectral-only AUC"
              display={metrics.ablation_lomo_auc.spectral_only?.toFixed(3)}
              env={derived(metrics.ablation_lomo_auc.spectral_only, 'AUC', 'Ablation: band ratios alone', {
                model_version: metrics.model_version,
                method: 'The geological claim in isolation, without terrain.',
              })}
            />
            <Metric
              label="Slope-only AUC"
              display={metrics.ablation_lomo_auc.slope_only?.toFixed(3)}
              env={derived(metrics.ablation_lomo_auc.slope_only, 'AUC', 'Ablation: slope alone', {
                model_version: metrics.model_version,
                method: 'Near 0.5 — chance. Rules out a pure "mines are on flat ground" detector.',
              })}
            />
          </div>

          <div className="rounded-md border border-status-caution/30 bg-status-caution/[0.07] p-3 text-xs leading-relaxed text-status-caution">
            <p className="font-semibold">What this number does and does not support</p>
            <p className="mt-1">{metrics.ablation_note}</p>
            <p className="mt-1">{metrics.lithology_note}</p>
            <p className="mt-1 opacity-80">
              For contrast, a random 5-fold split scores{' '}
              <span className="font-mono">{metrics.random_split_auc_for_contrast}</span> — shown so the
              optimistic protocol is visible, not quoted.
            </p>
          </div>
        </>
      )}

      {/* --- A-5 ranked drill targets with evidence --- */}
      <div className="rounded-md border border-border-default bg-surface-2 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-text-secondary">
          Ranked drill targets (PRD A-5) — ranked by score, each with its evidence
        </p>
        {tErr ? (
          <Unavailable what="Drill targets" reason={tErr} />
        ) : !targets ? (
          <Spinner label="Ranking candidates…" />
        ) : (
          <>
            <p className="mb-2 font-mono text-xs text-text-tertiary">
              {targets.n_candidates.toLocaleString()} candidate cells · {targets.n_observations} measured
              observations · {targets.ranked_by}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="text-text-tertiary">
                  <tr className="border-b border-border-default text-left">
                    <th className="py-1 font-normal">#</th>
                    <th className="py-1 font-normal">Location</th>
                    <th className="py-1 font-normal">Prospectivity</th>
                    <th className="py-1 font-normal">Uncertainty (±sd)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-text-secondary">
                  {targets.targets.map((t) => (
                    <tr key={`${t.lat},${t.lng}`} className="border-b border-border-subtle align-top">
                      <td className="py-1.5">{t.rank}</td>
                      <td className="py-1.5">{t.lat.toFixed(3)}, {t.lng.toFixed(3)}</td>
                      <td className="py-1.5">
                        {/* Continuous quantity -> sequential colormap, not a
                            status colour: a score is not a state. The swatch
                            carries the magnitude, the figure carries the value. */}
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: cividis(t.prospectivity_score) }}
                          />
                          <span className="text-text-primary">
                            {t.prospectivity_score.toFixed(3)}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 text-text-secondary">±{t.uncertainty_sd.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-text-tertiary hover:text-text-secondary">
                evidence for rank 1
              </summary>
              <p className="mt-1 text-xs leading-snug text-text-secondary">{targets.targets[0]?.evidence}</p>
            </details>
            <p className="mt-2 text-xs leading-snug text-text-tertiary">
              {targets.information_gain_note}
            </p>
          </>
        )}
      </div>

      {/* --- map-click equivalent: the real model, with uncertainty --- */}
      <div className="rounded-md border border-border-default bg-surface-2 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-text-secondary">
          Score a location (PRD A-3, A-4, A-7)
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-text-tertiary">
            <span className="mb-1 block uppercase tracking-wider">Latitude</span>
            <input
              value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal"
              className="w-28 rounded border border-border-default bg-black/40 px-2 py-1 font-mono text-xs text-text-primary outline-none focus:border-status-nominal/60"
            />
          </label>
          <label className="text-xs text-text-tertiary">
            <span className="mb-1 block uppercase tracking-wider">Longitude</span>
            <input
              value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal"
              className="w-28 rounded border border-border-default bg-black/40 px-2 py-1 font-mono text-xs text-text-primary outline-none focus:border-status-nominal/60"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-1 text-xs text-text-secondary">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-status-nominal" />
            fetch live Sentinel-2 (slower)
          </label>
          <button type="button"
            onClick={runProbe} disabled={pLoading}
            className="rounded-md border border-border-interactive bg-surface-2 px-3 py-1.5 text-xs text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3 disabled:opacity-45"
          >
            {pLoading ? 'Scoring…' : 'Score'}
          </button>
          <button type="button"
            onClick={() => { setLat(String(OPENCAST_PILOT.lat)); setLng(String(OPENCAST_PILOT.lng)) }}
            className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-interactive"
          >
            {OPENCAST_PILOT.name} (opencast pilot)
          </button>
        </div>

        {pErr ? <div className="mt-3"><Unavailable what="Prediction" reason={pErr} /></div> : null}

        {probe ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Metric
              label="Kriged prospectivity"
              emphasis
              display={probe.kriged_prospectivity_score?.toFixed(3)}
              env={derived(probe.kriged_prospectivity_score, 'score 0-1', 'Ordinary kriging over measured observations', {
                model_version: probe.model_version,
                method: probe.uncertainty_basis,
                // `?? 0` here reported an uncertainty of ZERO when the kriging
                // standard deviation was missing — the single most misleading
                // value available, since it claims the estimate is exact. An
                // absent spread is now "not quantified", which is what Metric
                // renders when `uncertainty` is undefined.
                uncertainty:
                  probe.uncertainty_sd != null
                    ? {
                        plus_minus: Number(probe.uncertainty_sd.toFixed(3)),
                        confidence: 0.68,
                        basis:
                          probe.variogram?.range_m != null
                            ? `Kriging standard deviation; variogram range ${Math.round(probe.variogram.range_m / 1000)} km.`
                            : 'Kriging standard deviation; variogram range not reported.',
                      }
                    : undefined,
              })}
            />
            {probe.direct_model_score != null ? (
              <Metric
                label="Direct model score (live read)"
                emphasis
                display={probe.direct_model_score.toFixed(3)}
                env={measured(probe.direct_model_score, 'probability', probe.source ?? 'Sentinel-2 L2A + SRTM', {
                  model_version: probe.model_version,
                  vintage: probe.scene?.datetime,
                  method: `Scene ${probe.scene?.scene_id} · cloud ${probe.scene?.cloud_cover_pct}%`,
                })}
              />
            ) : (
              <Metric
                label="Direct model score (live read)"
                env={null}
                unavailableReason={probe.note ?? 'Live satellite read not requested.'}
              />
            )}
          </div>
        ) : null}

        {probe?.guardrails ? (
          <div className="mt-3 space-y-1 rounded-md border border-border-default bg-surface-1 p-3 text-xs leading-snug text-text-secondary">
            <p>{probe.guardrails.no_subsurface_detection}</p>
            <p>{probe.guardrails.not_a_reserve}</p>
          </div>
        ) : null}
      </div>

    </section>
  )
}
