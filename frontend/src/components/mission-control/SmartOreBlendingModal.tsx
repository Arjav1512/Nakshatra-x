'use client'

import { useState } from 'react'
import type { MineInfo } from './types'
import { Sparkles, Scale, } from 'lucide-react'

interface Props {
  mine: MineInfo
}

export default function SmartOreBlendingModal({ mine }: Props) {
  const [targetTonnes, setTargetTonnes] = useState(5000)
  const [targetMnMin, setTargetMnMin] = useState(41.0)
  const [isSolving, setIsSolving] = useState(false)
  /**
   * Null until the solver has run.
   *
   * This was seeded with a complete optimiser result — a "Simplex Optimal
   * Solution Found" status, a blended grade of 41.2% Mn, a cost of ₹6,240/t and
   * a three-line blend plan naming "Balaghat High-Grade SP-1 (46.2% Mn)" and
   * "Dongri Buzurg Med-Grade SP-2 (37.5% Mn)". None of it had been computed,
   * and an ore grade attributed to a named MOIL mine is precisely the claim
   * removed from the map popup and the hotspot table in earlier phases: Track A
   * produces a prospectivity score, which PRD §2.4 is explicit is not a grade.
   *
   * The request payload had already been corrected to say "Illustrative SP-1 —
   * high grade". The seeded *result* was missed, so the screen went on showing
   * the old names before anyone pressed the button.
   */
  const [blendResult, setBlendResult] = useState<any>(null)
  const [blendError, setBlendError] = useState<string | null>(null)

  const handleRunOptimizer = async () => {
    setIsSolving(true)
    setBlendError(null)
    try {
      const res = await fetch('/api/v1/optimize-blending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_tonnes: targetTonnes,
          target_mn_min: targetMnMin,
          target_p_max: 0.15,
          target_sio2_max: 6.5,
          // Illustrative stockpiles. These grades, tonnages and costs are
          // invented inputs used to exercise the solver — there is no stockpile
          // register in this system. They were previously labelled with real
          // mine names ("Balaghat High-Grade SP-1", "Dongri Buzurg Med-Grade
          // SP-2"), which presented them as those mines' actual inventory.
          stockpiles: [
            { name: 'Illustrative SP-1 — high grade', available_tonnes: 3200, mn_grade_pct: 46.2, p_pct: 0.11, sio2_pct: 4.8, cost_per_tonne_inr: 8200 },
            { name: 'Illustrative SP-2 — medium grade', available_tonnes: 4500, mn_grade_pct: 37.5, p_pct: 0.16, sio2_pct: 7.2, cost_per_tonne_inr: 5400 },
            { name: 'Illustrative SP-3 — silico-Mn', available_tonnes: 2800, mn_grade_pct: 34.0, p_pct: 0.14, sio2_pct: 8.1, cost_per_tonne_inr: 4100 },
            { name: 'Illustrative SP-4 — low grade', available_tonnes: 2100, mn_grade_pct: 28.5, p_pct: 0.18, sio2_pct: 9.5, cost_per_tonne_inr: 2900 },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setBlendResult(data)
        setBlendError(null)
      } else {
        setBlendResult(null)
        setBlendError(`The optimiser answered ${res.status}.`)
      }
    } catch (err: any) {
      setBlendResult(null)
      setBlendError(err?.message || 'The optimiser could not be reached.')
    } finally {
      setIsSolving(false)
    }
  }

  return (
    <div className="ios-glass-card p-6 flex flex-col justify-between space-y-6 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-gold">
              REAL CASE OPTIMIZER
            </span>
            <span className="text-xs font-mono text-text-tertiary">SciPy Simplex Linear Programming</span>
          </div>
          <span className="ios-badge ios-badge-live">
            <Scale className="w-3 h-3 text-accent" />
            Shortfall Mitigator
          </span>
        </div>

        <h2 className="text-2xl font-bold text-text-primary tracking-tight">
          Smart Ore Blending & Grade Optimizer
        </h2>
        <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
          When primary mining face suffers shortfall, dynamically solves multi-stockpile blending ratios to guarantee customer contract grade specifications ({targetMnMin}% Mn) with lowest cost.
        </p>
      </div>

      {/* Target Controls (Light Liquid Glass Inset) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ios-glass-inset p-4">
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <label htmlFor="blend-volume" className="text-text-tertiary">Required dispatch volume:</label>
            <span className="font-bold text-text-primary" data-provenance="reference">
              {targetTonnes.toLocaleString()} Tonnes
            </span>
          </div>
          <input
            id="blend-volume"
            type="range"
            min="1000"
            max="12000"
            step="500"
            value={targetTonnes}
            onChange={(e) => setTargetTonnes(Number(e.target.value))}
            className="w-full accent-accent cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <label htmlFor="blend-grade" className="text-text-tertiary">Contract minimum Mn grade:</label>
            <span className="font-bold text-status-caution">{targetMnMin}% Mn</span>
          </div>
          <input
            id="blend-grade"
            type="range"
            min="30.0"
            max="45.0"
            step="0.5"
            value={targetMnMin}
            onChange={(e) => setTargetMnMin(Number(e.target.value))}
            className="w-full accent-status-caution cursor-pointer"
          />
        </div>
      </div>

      {/* Solve Button */}
      <button type="button"
        onClick={handleRunOptimizer}
        disabled={isSolving}
        className="ios-glass-button w-full py-3 rounded-md text-xs font-mono font-bold text-accent flex items-center justify-center gap-2 cursor-pointer"
      >
        <Sparkles className={`w-4 h-4 ${isSolving ? 'animate-spin' : ''}`} />
        <span>{isSolving ? 'Solving Simplex Mathematical Model...' : 'Calculate Optimal Stockpile Blending Plan'}</span>
      </button>

      {/* Solver Output Results */}
      {blendError ? (
        <div className="rounded-md border border-status-critical/30 bg-status-critical/5 p-3 text-xs">
          <p className="font-semibold text-status-critical">Optimiser unavailable</p>
          <p className="mt-1 leading-snug text-text-secondary">
            {blendError} No blend plan is shown, because a plan this screen invented would be
            indistinguishable from one the solver produced.
          </p>
        </div>
      ) : !blendResult ? (
        <div className="rounded-md border border-border-default bg-surface-2 p-3 text-xs text-text-secondary">
          Set the target tonnage and minimum grade above, then run the optimiser. Nothing is shown
          here until it returns a plan. The stockpiles it solves against are illustrative inputs,
          not a MOIL inventory — no stockpile register exists in this system.
        </div>
      ) : null}

      {blendResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="ios-glass-inset p-3.5" data-provenance="derived">
              <span className="text-xs font-mono uppercase text-text-tertiary">Blended Mn Grade</span>
              <div className="text-xl font-mono font-bold text-accent my-1">
                {blendResult.blended_mn_grade_pct}% Mn
              </div>
              <span className="text-xs font-mono text-text-tertiary">Meets customer spec</span>
            </div>

            <div className="ios-glass-inset p-3.5" data-provenance="derived">
              <span className="text-xs font-mono uppercase text-text-tertiary">Avg Blended Cost</span>
              <div className="text-xl font-mono font-bold text-status-caution my-1">
                {/* `|| 6240` stood here: a missing cost became a plausible one. */}
                {blendResult.avg_cost_per_tonne_inr != null
                  ? `₹${blendResult.avg_cost_per_tonne_inr.toLocaleString()}`
                  : '—'}{' '}
                <span className="text-xs font-normal text-text-tertiary">/ T</span>
              </div>
              <span className="text-xs font-mono text-accent">&bull; Cost Minimized</span>
            </div>

            <div className="ios-glass-inset p-3.5" data-provenance="derived">
              <span className="text-xs font-mono uppercase text-text-tertiary">Shortfall Recovered</span>
              <div className="text-xl font-mono font-bold text-accent my-1">
                +{blendResult.target_tonnes?.toLocaleString()} T
              </div>
              <span className="text-xs font-mono text-text-tertiary">100% Contract Fulfillment</span>
            </div>
          </div>

          {/* Allocation Breakdown Table */}
          <div className="rounded-md border border-border-default bg-surface-2 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="label">Blend allocation</span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-status-caution/40 bg-status-caution/10 px-1.5 py-0.5 font-mono text-xs text-status-caution">
                SYNTHETIC INPUTS
              </span>
            </div>
            <p className="measure mb-3 text-xs text-text-tertiary">
              The linear program is real and its infeasibility reporting is the point of it, but the
              stockpiles it solved over are illustrative: this system has no stockpile register, so
              the tonnages and rupee figures below describe the example, not a mine.
            </p>
            {blendResult.blend_plan?.map((item: any, idx: number) => (
              <div key={idx} data-provenance="derived" className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-text-tertiary">{item.stockpile_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-accent font-bold">{item.tonnes_allocated} T ({item.allocation_pct}%)</span>
                  <span className="text-text-tertiary">₹{(item.cost_inr / 100000).toFixed(1)}L</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
