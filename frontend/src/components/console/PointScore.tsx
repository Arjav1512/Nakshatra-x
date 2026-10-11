import { derived, measured, measuredOrNull, measuredValue } from '@/lib/provenance'
import { Metric } from './Evidence'

/**
 * What the Track A model says about one point: the kriged score with its
 * kriging spread, the direct model score from a live satellite read (or the
 * service's reason there is none), and the guardrails that travel with it.
 *
 * One component for both ways in — the "Score a location" form under the map,
 * and a click on the map itself. The click used to open its own panel, written
 * for a response shape the service no longer sends: it printed "NaN%" as a
 * "manganese possibility", filled the gaps with literals (a 4.2 km fault, SWIR
 * 0.32 / 0.41), and when the request failed built a whole prediction in the
 * browser and marked it live (docs/design/POLISH_AUDIT.md, issue 1). Rendering
 * the same response through the same `Metric`s is what makes the two agree.
 */
export function PointScore({ probe }: { probe: any }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label="Kriged prospectivity"
          emphasis
          data={measuredValue(derived(probe.kriged_prospectivity_score, 'score 0-1', 'Ordinary kriging over measured observations', {
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
          }), () => String(probe.kriged_prospectivity_score?.toFixed(3)))}
        />
        {probe.direct_model_score != null ? (
          <Metric
            label="Direct model score (live read)"
            emphasis
            data={measuredValue(measured(probe.direct_model_score, 'probability', probe.source ?? 'Sentinel-2 L2A + SRTM', {
              model_version: probe.model_version,
              vintage: probe.scene?.datetime,
              method: `Scene ${probe.scene?.scene_id} · cloud ${probe.scene?.cloud_cover_pct}%`,
            }), () => String(probe.direct_model_score.toFixed(3)))}
          />
        ) : (
          <Metric
            label="Direct model score (live read)"
            data={measuredOrNull(null)}
            unavailable={probe.note ?? 'Live satellite read not requested.'}
          />
        )}
      </div>

      {probe.guardrails ? (
        <div
          className="mt-3 space-y-1 rounded-md border border-border-default bg-surface-1 p-3 text-xs leading-snug text-text-secondary"
          // Statements the service returns with every score. They name
          // "Sentinel-2" and "PRD 2.4"; the kind says where they come from.
          data-provenance="reference"
          data-provenance-model={probe.model_version}
        >
          <p>{probe.guardrails.no_subsurface_detection}</p>
          <p>{probe.guardrails.not_a_reserve}</p>
        </div>
      ) : null}
    </>
  )
}
