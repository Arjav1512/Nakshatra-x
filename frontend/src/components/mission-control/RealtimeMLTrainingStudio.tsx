'use client'

import { useEffect, useState } from 'react'
import type { MineInfo } from './types'

/**
 * Model card — the validated state of the prospectivity model.
 *
 * WHAT THIS REPLACED
 * ------------------
 * This component was a simulated training studio. Clicking "train" advanced a
 * loop of `setTimeout` calls while `Math.random()` produced a decaying loss
 * curve and an accuracy that converged on a hardcoded constant:
 *
 *     accuracy: 98.7, rocAuc: 0.995        // per "model", invented
 *     stepAcc = preset.accuracy - 12 * Math.exp(-step / 2.1) + Math.random() * 0.4
 *
 * No model was fitted, no data was read, and the numbers were presented as
 * measured performance. It also listed "Fault Line Proximity" as a feature —
 * the distance-to-mine term that invalidated the original pipeline — and
 * claimed to fuse Sentinel-2 SWIR with "GSI/MOIL core drill logs" that this
 * project does not have.
 *
 * It now reports the real validation metrics from
 * `/api/v1/prospectivity/metrics`: leave-one-mine-out AUC with its confidence
 * interval and the feature ablation. Training happens offline
 * (`AI/scripts/08_train_honest_model.py`), which is where model fitting
 * belongs — not behind a button in a dashboard.
 *
 * The export name and props are unchanged so the three pages embedding it keep
 * working.
 */

interface Props {
  mine?: MineInfo
}

interface Metrics {
  model_version: string
  validation: string
  lomo: {
    auc: number
    average_precision: number
    auc_ci95: [number, number]
    n_out_of_fold: number
    per_fold: Array<{ held_out_mine: string; mine_score: number; percentile_vs_negatives: number }>
  }
  ablation_lomo_auc: Record<string, number>
  random_split_auc_for_contrast: number
  feature_importance: Record<string, number>
  features: string[]
  honest_note: string
  guardrail: string
  lithology_note: string
  ablation_note: string
  n_samples: number
}

export default function RealtimeMLTrainingStudio({ mine }: Props) {
  const [m, setM] = useState<Metrics | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/v1/prospectivity/metrics', { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => null)
        if (!alive) return
        if (!r.ok) {
          setErr(body?.note || body?.error || `metrics unavailable (${r.status})`)
          return
        }
        setM(body as Metrics)
      })
      .catch((e) => alive && setErr(e?.message || 'network error'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="rounded-2xl border border-white/10 bg-[#080d16]/80 p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#00FF88]">
          Prospectivity model card
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Validated performance of the model behind the prospectivity map
          {mine?.name ? ` (viewing ${mine.name})` : ''}. Training runs offline —
          this panel reports results, it does not fit models.
        </p>
      </header>

      {err ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
          <p className="font-semibold text-rose-300">Metrics unavailable</p>
          <p className="mt-1 leading-snug text-slate-400">{err}</p>
          <p className="mt-1 leading-snug text-slate-500">
            No figure is shown rather than a placeholder one.
          </p>
        </div>
      ) : !m ? (
        <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-[#00FF88]" />
          Loading validation metrics…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Leave-one-mine-out AUC
              </p>
              <p className="mt-1 font-mono text-2xl text-white">{m.lomo.auc.toFixed(2)}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                95% CI [{m.lomo.auc_ci95[0]}, {m.lomo.auc_ci95[1]}]
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Spectral features alone
              </p>
              <p className="mt-1 font-mono text-2xl text-white">
                {m.ablation_lomo_auc.spectral_only?.toFixed(2)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">the geological claim in isolation</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Validation set</p>
              <p className="mt-1 font-mono text-2xl text-white">{m.n_samples}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                measured points · {m.lomo.per_fold.length} deposits held out
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11px] leading-relaxed text-amber-100">
            <p className="font-semibold">Read this before quoting the number</p>
            <p className="mt-1">{m.honest_note}</p>
            <p className="mt-1">{m.ablation_note}</p>
            <p className="mt-1">{m.lithology_note}</p>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-400">
              Feature importance — {m.features.length} features, none derived from distance to a
              known mine
            </p>
            <div className="space-y-1">
              {Object.entries(m.feature_importance)
                .sort((a, b) => b[1] - a[1])
                .map(([name, imp]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-44 shrink-0 font-mono text-[10px] text-slate-400">{name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-[#00FF88]/70"
                        style={{ width: `${Math.min(100, imp * 100 * 2)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10px] text-slate-400">
                      {imp.toFixed(3)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-400">
              per held-out deposit
            </summary>
            <table className="mt-2 w-full text-[11px]">
              <thead className="text-slate-500">
                <tr className="border-b border-white/10 text-left">
                  <th className="py-1 font-normal">Deposit</th>
                  <th className="py-1 font-normal">Score</th>
                  <th className="py-1 font-normal">Above % of fold negatives</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-300">
                {m.lomo.per_fold.map((f) => (
                  <tr key={f.held_out_mine} className="border-b border-white/5">
                    <td className="py-1">{f.held_out_mine}</td>
                    <td className={`py-1 ${f.mine_score < 0.35 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {f.mine_score.toFixed(3)}
                    </td>
                    <td className="py-1 text-slate-400">
                      {Math.round(f.percentile_vs_negatives * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <p className="text-[10px] leading-snug text-slate-500">
            {m.model_version} · validated {m.validation} · random-split AUC{' '}
            {m.random_split_auc_for_contrast} shown only for contrast. ⛔ {m.guardrail}
          </p>
        </div>
      )}
    </section>
  )
}
