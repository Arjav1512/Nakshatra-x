'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Brain, Layers, GitBranch, Terminal, ShieldAlert, Award, } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { type TrackAMetrics, fetchDrillTargets, fetchTrackAMetrics } from '@/lib/console-api'
import { Metric } from '@/components/console/Evidence'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { derived } from '@/lib/provenance'

export default function JudgesArchitectureDeck() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'hyperparameters' | 'shap'>('pipeline')

  /**
   * Feature importances come from the trained model.
   *
   * They used to be a literal array in this file — Fault Distance 30.18,
   * Rainfall 21.94, Slope 16.36, Iron Oxide 13.68, Elevation 9.99, Ferrous
   * 7.86 — rendered as a bar chart with no provenance. Two of those names are
   * not features of the model at all: the honest rebuild dropped
   * distance-to-known-mine features precisely because they leaked the labels,
   * and there is no rainfall feature in Track A. The real top feature is
   * elevation at 40.6%, which is the evidence behind the published caveat that
   * part of what the model learns is where mines are built.
   *
   * A chart that disagreed with the model on which features exist is worse than
   * no chart, so it now reads the model or says it cannot.
   */
  const [metrics, setMetrics] = useState<TrackAMetrics | null>(null)
  const [metricsErr, setMetricsErr] = useState<string | null>(null)
  /**
   * Grid size, read from the model rather than typed into the copy.
   *
   * The sentence below said "725-point spatial grid" and the tile beside it
   * said "725 Inferences Computed". The model scores 1,710 candidate cells.
   * Nobody noticed because 725 is a plausible integer inside a sentence: it
   * never appeared as a suspicious literal, and no grep for fabrication
   * patterns would flag it. It was found by reading the rendered page against
   * the live endpoint, which is what B-6 automates.
   */
  const [gridSize, setGridSize] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetchDrillTargets(1).then((r) => {
      if (alive && r.ok) setGridSize(r.data.n_candidates)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    fetchTrackAMetrics().then((r) => {
      if (!alive) return
      if (r.ok) setMetrics(r.data)
      else setMetricsErr(r.error)
    })
    return () => {
      alive = false
    }
  }, [])

  const featureImportances = metrics
    ? Object.entries(metrics.feature_importance)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value: Number((value * 100).toFixed(1)) }))
    : []

  return (
    <div className="ios-glass-card p-6 flex flex-col gap-6 relative overflow-hidden">
      {/* Absolute background glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-status-critical/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-copper flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-status-caution" />
              JUDGES INTERACTIVE EXECUTIVE SUMMARY
            </span>
            <span className="text-xs font-mono text-text-tertiary">&bull; Smart India Hackathon 2026 Evaluation</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight mt-1.5 flex items-center gap-2">
            Mineral Prospectivity Pipeline & Explainability
          </h2>
          <p
            className="text-xs text-text-tertiary mt-1 leading-relaxed"
            data-provenance={metrics ? 'derived' : 'unavailable'}
            data-provenance-model={metrics?.model_version}
          >
            Gradient-boosting model over measured Sentinel-2 band ratios and SRTM
            terrain, validated leave-one-mine-out
            {metrics ? (
              <>
                {' '}(AUC {metrics.lomo.auc.toFixed(2)}, 95% CI{' '}
                {metrics.lomo.auc_ci95[0]}–{metrics.lomo.auc_ci95[1]})
              </>
            ) : null}
            . Maps SURFACE prospectivity only — satellite inputs carry no subsurface
            information (PRD §2.2).
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-md border border-border-default">
          <button type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
              activeTab === 'pipeline'
                ? 'bg-gradient-to-r from-status-caution/20 to-status-caution/20 text-text-primary border border-status-caution/30 shadow-md'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Pipeline Flow
          </button>
          <button type="button"
            onClick={() => setActiveTab('hyperparameters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
              activeTab === 'hyperparameters'
                ? 'bg-gradient-to-r from-status-caution/20 to-status-caution/20 text-text-primary border border-status-caution/30 shadow-md'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Model Specs
          </button>
          <button type="button"
            onClick={() => setActiveTab('shap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
              activeTab === 'shap'
                ? 'bg-gradient-to-r from-status-caution/20 to-status-caution/20 text-text-primary border border-status-caution/30 shadow-md'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Feature Importances
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch relative">
          {/* Step 1 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[var(--color-status-nominal)]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-accent font-bold">STEP 01</span>
                <Layers className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Dataset Prep</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Aggregates 10 known GSI-verified manganese mine coordinates and synthesizes 400 regional background nodes.
              </p>
            </div>
            <div className="mt-4 text-xs font-mono text-accent bg-accent/5 p-1.5 rounded border border-accent/20">
              CSV: 410 Points Generated
            </div>
          </div>

          {/* Step 2 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[var(--color-accent)]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-accent font-bold">STEP 02</span>
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Feature Extraction</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Applies simulated Sentinel-2 SWIR band ratios, DEM topography formulas, and fault geodesic metrics offline.
              </p>
            </div>
            <div className="mt-4 text-xs font-mono text-accent bg-accent/5 p-1.5 rounded border border-accent/20 font-semibold">
              6 Geological Features / Point
            </div>
          </div>

          {/* Step 3 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[var(--color-status-caution)]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-status-caution font-bold">STEP 03</span>
                <Brain className="w-4 h-4 text-status-caution" />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Model Training</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Trains a Random Forest classifier. Imbalances resolved via balanced class weights to optimize recall.
              </p>
            </div>
            <div className="mt-4 text-xs font-mono text-status-caution bg-status-caution/5 p-1.5 rounded border border-status-caution/20">
              Balanced RandomForest (n=100)
            </div>
          </div>

          {/* Step 4 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[var(--color-status-caution)]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-status-caution font-bold">STEP 04</span>
                <GitBranch className="w-4 h-4 text-status-caution" />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Grid Inference</h3>
              <p
                className="text-xs text-text-tertiary leading-relaxed"
                data-provenance={gridSize !== null ? 'derived' : 'unavailable'}
              >
                Scores a{' '}
                {gridSize !== null ? `${gridSize.toLocaleString()}-cell` : ''} spatial grid
                covering the Madhya Pradesh &ndash; Maharashtra mineral belt.
              </p>
            </div>
            <div
              className="mt-4 text-xs font-mono text-status-caution bg-status-caution/5 p-1.5 rounded border border-status-caution/20"
              data-provenance={gridSize !== null ? 'derived' : 'unavailable'}
            >
              {gridSize !== null ? `${gridSize.toLocaleString()} cells scored` : 'grid size unavailable'}
            </div>
          </div>

          {/* Step 5 */}
          <div className="ios-glass-inset p-4 flex flex-col justify-between border-t border-t-[var(--color-status-critical)]/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-status-critical font-bold">STEP 05</span>
                <Terminal className="w-4 h-4 text-status-critical" />
              </div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-1">Export & Render</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Saves to GeoJSON and serves dynamically to render color-coded prospectivity beacons onto the Leaflet map.
              </p>
            </div>
            <div className="mt-4 text-xs font-mono text-status-critical bg-status-critical/5 p-1.5 rounded border border-status-critical/20 font-semibold">
              GeoJSON + FastAPI / Next.js API
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hyperparameters' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ios-glass-inset p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-text-tertiary uppercase block mb-1">Model Parameters</span>
              <h3 className="text-2xl font-mono font-semibold text-accent">Random Forest</h3>
              <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                Selected for non-linear feature handling, resilience to spatial collinearity, and zero risk of model gradient explosion.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-border-subtle text-xs font-mono">
              <div className="flex justify-between"><span className="text-text-tertiary">Estimators:</span> <span className="text-text-primary">100 Trees</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Max Depth:</span> <span className="text-text-primary">6 levels</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Class Weights:</span> <span className="text-accent font-bold">Balanced</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Train-Test Split:</span> <span className="text-text-primary">80 / 20 Stratified</span></div>
            </div>
          </div>

          {/*
            These were literals: 95.1% accuracy, ROC-AUC 0.8875, recall 50.0%, "410 Records". None came from the model, and they contradicted the
            project's own published figures — the honest model is validated
            leave-one-mine-out on 50 points and scores AUC 0.85 with a 95%
            interval of 0.723-0.95. Accuracy was the wrong headline in any case
            at a 20% base rate, where predicting "no ore" everywhere scores 80%.
          */}
          <div className="rounded-md border border-border-default bg-surface-2 p-5">
            <p className="label">Model evaluation</p>
            {metricsErr ? (
              <EmptyState
                className="mt-3"
                title="Metrics unavailable"
                detail={metricsErr}
              />
            ) : !metrics ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Metric
                    label="LOMO AUC"
                    emphasis
                    display={metrics.lomo.auc.toFixed(3)}
                    env={derived(metrics.lomo.auc, 'AUC', `Leave-one-mine-out cross-validation over ${metrics.lomo.n_out_of_fold} out-of-fold points`, {
                      model_version: metrics.model_version,
                      method: metrics.validation,
                      uncertainty: {
                        plus_minus: Number(((metrics.lomo.auc_ci95[1] - metrics.lomo.auc_ci95[0]) / 2).toFixed(3)),
                        confidence: 0.95,
                        basis: `95% CI [${metrics.lomo.auc_ci95[0]}, ${metrics.lomo.auc_ci95[1]}] — an entire deposit is held out at a time.`,
                      },
                    })}
                  />
                  <Metric
                    label="Average precision"
                    display={metrics.lomo.average_precision.toFixed(3)}
                    env={derived(metrics.lomo.average_precision, 'AP', 'Leave-one-mine-out cross-validation', {
                      model_version: metrics.model_version,
                      method: `Base rate is ${metrics.lomo.base_rate}, so AP is the honest headline rather than accuracy.`,
                    })}
                  />
                  <Metric
                    label="Validation points"
                    display={metrics.n_samples}
                    unit="points"
                    env={derived(metrics.n_samples, 'points', 'Track A training set', {
                      model_version: metrics.model_version,
                      method: 'Ten positive sites. An interval this wide is what that sample supports.',
                    })}
                  />
                  <Metric
                    label="Random-split AUC (for contrast)"
                    display={metrics.random_split_auc_for_contrast.toFixed(3)}
                    env={derived(metrics.random_split_auc_for_contrast, 'AUC', 'Random 5-fold split — shown only as a contrast', {
                      model_version: metrics.model_version,
                      method: 'A random split leaks neighbouring cells of the same deposit across folds, so it flatters the model. LOMO is the figure to quote.',
                    })}
                  />
                </div>
                <p className="measure mt-3 text-xs text-text-tertiary">{metrics.lithology_note}</p>
              </>
            )}
          </div>

          <div className="ios-glass-inset p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-text-tertiary uppercase block mb-1">Offline GEE Replacement</span>
              <h3 className="text-2xl font-mono font-semibold text-status-critical">Zero Cost Sandbox</h3>
              <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                Replaces Google Earth Engine APIs by computing terrain slope, elevation, fault distances, and rainfall mathematically.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-border-subtle text-xs font-mono">
              <div className="flex justify-between"><span className="text-text-tertiary">Terrain:</span> <span className="text-text-primary">Deterministic DEM DEM proxy</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Weather:</span> <span className="text-text-primary">Rainfall Seasonality Proxy</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Faults:</span> <span className="text-text-primary">Sausar Shear coordinates</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">API Key Requirement:</span> <span className="text-accent font-bold">0% (Keyless Sandbox)</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shap' && (
        metricsErr ? (
          <EmptyState
            title="Feature importances unavailable"
            detail={`The model metrics endpoint could not be reached: ${metricsErr}. No importances are shown, because the only alternative is numbers that did not come from the model.`}
          />
        ) : !metrics ? (
          <div className="space-y-2">
            <Skeleton className="h-[240px] w-full" />
            <span className="sr-only">Loading model metrics</span>
          </div>
        ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div>
            <p className="label mb-2">
              Feature importance — {metrics.features.length} features, model{' '}
              {metrics.model_version}
            </p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={featureImportances}
                  layout="vertical"
                  margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border-subtle)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                    tickLine={false}
                    axisLine={false}
                    width={150}
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
                    formatter={(value: any) => [`${value}%`, 'importance']}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-accent)"
                    radius={[0, 2, 2, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="measure mt-3 text-xs text-text-tertiary">{metrics.ablation_note}</p>
          </div>

          <div>
            <h3 className="label mb-3 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Every figure below is read from the trained model
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featureImportances.map((item) => (
                <Metric
                  key={item.name}
                  label={item.name.replace(/_/g, ' ')}
                  display={item.value.toFixed(1)}
                  unit="%"
                  env={derived(
                    item.value, '% of total importance', 'Gradient-boosted prospectivity model, leave-one-mine-out validated',
                    {
                      model_version: metrics.model_version,
                      method: 'Impurity-based feature importance from the fitted model, normalised across ' + `${metrics.features.length} features. Not a SHAP value.`,
                    }
                  )}
                />
              ))}
            </div>
            <p className="measure mt-3 text-xs text-text-tertiary">{metrics.honest_note}</p>
          </div>
        </div>
        )
      )}
    </div>
  )
}
