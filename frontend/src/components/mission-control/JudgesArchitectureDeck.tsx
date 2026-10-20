'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Brain, Layers, GitBranch, Terminal, ShieldAlert, Award, } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { type TrackAMetrics, fetchDrillTargets, fetchTrackAMetrics } from '@/lib/console-api'
import { Metric } from '@/components/console/Evidence'
import { DATA_WELL, EmptyState, Skeleton } from '@/components/ui/primitives'
import { AXIS_TICK, BAR_CURSOR, GRID_STROKE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from '@/lib/chart-theme'
import { derived, measuredValue } from '@/lib/provenance'

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
    // Flat, as the reference's surfaces: the two blurred colour glows that sat
    // behind this card were decoration (reference rule 5).
    <div className="relative flex flex-col gap-6 overflow-hidden rounded-xl border border-border-default bg-surface-1 p-5 md:p-6">

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="label flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              Executive summary
            </span>
            <span className="label">&bull; Smart India Hackathon 2026</span>
          </div>
          <h2 className="mt-2 flex items-center gap-2 font-display text-2xl text-text-primary md:text-3xl">
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
        <fieldset className="m-0 inline-flex min-w-0 flex-wrap items-center gap-0.5 self-start rounded-md border-0 bg-surface-2 p-[3px] xl:shrink-0">
          <legend className="sr-only">Section</legend>
          <button type="button"
            onClick={() => setActiveTab('pipeline')}
            aria-pressed={activeTab === 'pipeline'}
            className={`h-[34px] rounded-sm px-3.5 text-[14px] tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out ${
              activeTab === 'pipeline'
                ? 'bg-surface-0 text-text-primary ring-1 ring-border-default'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Pipeline Flow
          </button>
          <button type="button"
            onClick={() => setActiveTab('hyperparameters')}
            aria-pressed={activeTab === 'hyperparameters'}
            className={`h-[34px] rounded-sm px-3.5 text-[14px] tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out ${
              activeTab === 'hyperparameters'
                ? 'bg-surface-0 text-text-primary ring-1 ring-border-default'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Model Specs
          </button>
          <button type="button"
            onClick={() => setActiveTab('shap')}
            aria-pressed={activeTab === 'shap'}
            className={`h-[34px] rounded-sm px-3.5 text-[14px] tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out ${
              activeTab === 'shap'
                ? 'bg-surface-0 text-text-primary ring-1 ring-border-default'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Feature Importances
          </button>
        </fieldset>
      </div>

      {/* Tab Contents */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch relative">
          {/* Step 1 */}
          <div className="rounded-tile bg-surface-2 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-text-tertiary">STEP 01</span>
                <Layers className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm text-text-primary">Dataset Prep</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Aggregates 10 known GSI-verified manganese mine coordinates and synthesizes 400 regional background nodes.
              </p>
            </div>
            <div className="mt-4 rounded-sm bg-surface-0 px-2 py-1.5 font-mono text-xs text-text-secondary">
              CSV: 410 Points Generated
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-tile bg-surface-2 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-text-tertiary">STEP 02</span>
                <Sparkles className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm text-text-primary">Feature Extraction</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Applies simulated Sentinel-2 SWIR band ratios, DEM topography formulas, and fault geodesic metrics offline.
              </p>
            </div>
            <div className="mt-4 rounded-sm bg-surface-0 px-2 py-1.5 font-mono text-xs text-text-secondary">
              6 Geological Features / Point
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-tile bg-surface-2 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-text-tertiary">STEP 03</span>
                <Brain className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm text-text-primary">Model Training</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Trains a Random Forest classifier. Imbalances resolved via balanced class weights to optimize recall.
              </p>
            </div>
            <div className="mt-4 rounded-sm bg-surface-0 px-2 py-1.5 font-mono text-xs text-text-secondary">
              Balanced RandomForest (n=100)
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-tile bg-surface-2 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-text-tertiary">STEP 04</span>
                <GitBranch className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm text-text-primary">Grid Inference</h3>
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
              className="mt-4 rounded-sm bg-surface-0 px-2 py-1.5 font-mono text-xs text-text-secondary"
              data-provenance={gridSize !== null ? 'derived' : 'unavailable'}
            >
              {gridSize !== null ? `${gridSize.toLocaleString()} cells scored` : 'grid size unavailable'}
            </div>
          </div>

          {/* Step 5 */}
          <div className="rounded-tile bg-surface-2 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-text-tertiary">STEP 05</span>
                <Terminal className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm text-text-primary">Export & Render</h3>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Saves to GeoJSON and serves dynamically to render color-coded prospectivity beacons onto the Leaflet map.
              </p>
            </div>
            <div className="mt-4 rounded-sm bg-surface-0 px-2 py-1.5 font-mono text-xs text-text-secondary">
              GeoJSON + FastAPI / Next.js API
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hyperparameters' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-tile bg-surface-2 p-5 flex flex-col justify-between">
            <div>
              <span className="label mb-1 block">Model Parameters</span>
              <h3 className="font-mono text-2xl text-text-primary">Random Forest</h3>
              <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                Selected for non-linear feature handling, resilience to spatial collinearity, and zero risk of model gradient explosion.
              </p>
            </div>
            <div className="space-y-1.5 mt-6 pt-3 border-t border-border-subtle text-xs font-mono">
              <div className="flex justify-between"><span className="text-text-tertiary">Estimators:</span> <span className="text-text-primary">100 Trees</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Max Depth:</span> <span className="text-text-primary">6 levels</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Class Weights:</span> <span className="text-text-primary">Balanced</span></div>
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
          <div className="rounded-xl border border-border-default bg-surface-1 p-5">
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
              data={measuredValue(derived(metrics.lomo.auc, 'AUC', `Leave-one-mine-out cross-validation over ${metrics.lomo.n_out_of_fold} out-of-fold points`, {
                      model_version: metrics.model_version,
                      method: metrics.validation,
                      uncertainty: {
                        plus_minus: Number(((metrics.lomo.auc_ci95[1] - metrics.lomo.auc_ci95[0]) / 2).toFixed(3)),
                        confidence: 0.95,
                        basis: `95% CI [${metrics.lomo.auc_ci95[0]}, ${metrics.lomo.auc_ci95[1]}] — an entire deposit is held out at a time.`,
                      },
                    }), () => String(metrics.lomo.auc.toFixed(3)))}
          />
                  <Metric
                    label="Average precision"
              data={measuredValue(derived(metrics.lomo.average_precision, 'AP', 'Leave-one-mine-out cross-validation', {
                      model_version: metrics.model_version,
                      method: `Base rate is ${metrics.lomo.base_rate}, so AP is the honest headline rather than accuracy.`,
                    }), () => String(metrics.lomo.average_precision.toFixed(3)))}
          />
                  <Metric
                    label="Validation points"
                    
                    unit="points"
              data={measuredValue(derived(metrics.n_samples, 'points', 'Track A training set', {
                      model_version: metrics.model_version,
                      method: 'Ten positive sites. An interval this wide is what that sample supports.',
                    }), () => String(metrics.n_samples))}
          />
                  <Metric
                    label="Random-split AUC (for contrast)"
              data={measuredValue(derived(metrics.random_split_auc_for_contrast, 'AUC', 'Random 5-fold split — shown only as a contrast', {
                      model_version: metrics.model_version,
                      method: 'A random split leaks neighbouring cells of the same deposit across folds, so it flatters the model. LOMO is the figure to quote.',
                    }), () => String(metrics.random_split_auc_for_contrast.toFixed(3)))}
          />
                </div>
                <p className="measure mt-3 text-xs text-text-tertiary">{metrics.lithology_note}</p>
              </>
            )}
          </div>

          <div className="rounded-tile bg-surface-2 p-5 flex flex-col justify-between">
            <div>
              <span className="label mb-1 block">
                Model inputs
              </span>
              <h3 className="font-mono text-2xl text-text-primary">
                Measured, not proxied
              </h3>
              {/*
                This panel described the superseded pipeline. It read "Replaces
                Google Earth Engine APIs by computing terrain slope, elevation,
                fault distances, and rainfall mathematically", and listed
                "Deterministic DEM DEM proxy", "Rainfall Seasonality Proxy" and
                "Sausar Shear coordinates".

                Every one of those is a feature the honest rebuild removed:
                fault distance and rainfall leaked the labels or did not exist,
                and the terrain is real SRTM rather than a formula. So the
                evidence page advertised, as an architecture feature, the exact
                thing the model was rebuilt to stop doing. It was never on a
                screen a crawler reaches as a *number*, which is why the
                rendered-page guard did not find it.

                The feature list now comes from the model.
              */}
              <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
                Track A is fitted on measured Sentinel-2 L2A band ratios and SRTM terrain. Nothing
                is synthesised from a formula, and no feature is derived from distance to a known
                mine &mdash; that leaked the labels and was removed.
              </p>
            </div>
            <div
              className="space-y-1.5 mt-6 pt-3 border-t border-border-subtle text-xs font-mono"
              data-provenance={metrics ? 'derived' : 'unavailable'}
              data-provenance-model={metrics?.model_version}
            >
              {metrics ? (
                metrics.features.map((f) => (
                  <div key={f} className="flex justify-between gap-3">
                    <span className="text-text-tertiary">{f.replace(/_/g, ' ')}</span>
                    <span className="text-text-primary">fitted</span>
                  </div>
                ))
              ) : (
                <p className="text-text-tertiary">
                  The feature list could not be read from the model, so none is shown.
                </p>
              )}
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
            {/* Importances are the model's own output: the model data role. */}
            <div className={`h-[240px] w-full rounded-tile p-2 ${DATA_WELL}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={featureImportances}
                  layout="vertical"
                  margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID_STROKE}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    // Every feature named: left to Recharts, it drops alternate
                    // labels it judges too close, which leaves bars unnamed.
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    cursor={BAR_CURSOR}
                    formatter={(value: any) => [`${value}%`, 'importance']}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-data-model)"
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
                  
                  unit="%"
              data={measuredValue(derived(
                    item.value, '% of total importance', 'Gradient-boosted prospectivity model, leave-one-mine-out validated',
                    {
                      model_version: metrics.model_version,
                      method: 'Impurity-based feature importance from the fitted model, normalised across ' + `${metrics.features.length} features. Not a SHAP value.`,
                    }
                  ), () => String(item.value.toFixed(1)))}
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
