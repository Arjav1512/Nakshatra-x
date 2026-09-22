'use client'

import { useEffect, useState } from 'react'
import { derived, measured } from '@/lib/provenance'
import {
  type DrillTargetsResponse, type TrackAMetrics,
  fetchDrillTargets, fetchTrackAMetrics, predictPoint,
} from '@/lib/console-api'
import { Metric } from './Evidence'

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
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
      <p className="font-semibold text-rose-300">{what} unavailable</p>
      <p className="mt-1 leading-snug text-slate-400">{reason}</p>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      {label}
    </div>
  )
}

export function TrackAPanel() {
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
          Track A · Prospectivity
        </h2>
        {metrics ? (
          <p className="font-mono text-[10px] text-slate-500">
            {metrics.model_version} · validated {metrics.validation}
          </p>
        ) : null}
      </header>

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

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11px] leading-relaxed text-amber-100">
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
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">
          Ranked drill targets (PRD A-5) — ranked by score, each with its evidence
        </p>
        {tErr ? (
          <Unavailable what="Drill targets" reason={tErr} />
        ) : !targets ? (
          <Spinner label="Ranking candidates…" />
        ) : (
          <>
            <p className="mb-2 font-mono text-[10px] text-slate-500">
              {targets.n_candidates.toLocaleString()} candidate cells · {targets.n_observations} measured
              observations · {targets.ranked_by}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[11px]">
                <thead className="text-slate-500">
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-1 font-normal">#</th>
                    <th className="py-1 font-normal">Location</th>
                    <th className="py-1 font-normal">Prospectivity</th>
                    <th className="py-1 font-normal">Uncertainty (±sd)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-300">
                  {targets.targets.map((t) => (
                    <tr key={`${t.lat},${t.lng}`} className="border-b border-white/5 align-top">
                      <td className="py-1.5">{t.rank}</td>
                      <td className="py-1.5">{t.lat.toFixed(3)}, {t.lng.toFixed(3)}</td>
                      <td className="py-1.5 text-emerald-300">{t.prospectivity_score.toFixed(3)}</td>
                      <td className="py-1.5 text-slate-400">±{t.uncertainty_sd.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
                evidence for rank 1
              </summary>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">{targets.targets[0]?.evidence}</p>
            </details>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              {targets.information_gain_note}
            </p>
          </>
        )}
      </div>

      {/* --- map-click equivalent: the real model, with uncertainty --- */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">
          Score a location (PRD A-3, A-4, A-7)
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-500">
            <span className="mb-1 block uppercase tracking-wider">Latitude</span>
            <input
              value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal"
              className="w-28 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-slate-200 outline-none focus:border-emerald-400/60"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            <span className="mb-1 block uppercase tracking-wider">Longitude</span>
            <input
              value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal"
              className="w-28 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-slate-200 outline-none focus:border-emerald-400/60"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-1 text-[10px] text-slate-400">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-emerald-500" />
            fetch live Sentinel-2 (slower)
          </label>
          <button type="button"
            onClick={runProbe} disabled={pLoading}
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {pLoading ? 'Scoring…' : 'Score'}
          </button>
          <button type="button"
            onClick={() => { setLat(String(OPENCAST_PILOT.lat)); setLng(String(OPENCAST_PILOT.lng)) }}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-white/30"
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
                uncertainty: {
                  plus_minus: Number(probe.uncertainty_sd?.toFixed(3) ?? 0),
                  confidence: 0.68,
                  basis: `Kriging standard deviation; variogram range ${Math.round((probe.variogram?.range_m ?? 0) / 1000)} km.`,
                },
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
          <div className="mt-3 space-y-1 rounded-md border border-white/10 bg-black/20 p-2 text-[10px] leading-snug text-slate-400">
            <p>⛔ {probe.guardrails.no_subsurface_detection}</p>
            <p>⛔ {probe.guardrails.not_a_reserve}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
