/**
 * The what-if calculator's planner assumptions, in one place.
 *
 * Every coefficient here is a **stated assumption**. None is fitted, no data
 * was used to derive it, and none describes a measured mine. They were invented
 * to make option A comparable with option B, which is what PRD C-6 asks for —
 * and PRD C-4 asks each recommendation to state its expected effect *and its
 * assumptions*, which is why they are exported, rendered, and editable rather
 * than buried in a route handler.
 *
 * The validated forecaster is `nakshatra-gbt-cqr-v1`, served from
 * `/api/v1/mines/{id}/forecast` with a published rolling-origin backtest. It
 * predicts from historical covariates and was never fitted to answer "what if
 * the haulage window moved", so it cannot stand in for this and this cannot
 * stand in for it.
 */

export interface AssumptionOption {
  value: string | number
  label: string
  /** Multiplier applied to the baseline. 1.0 means "no assumed effect". */
  factor: number
}

export interface AssumptionGroup {
  id: 'shiftWindow' | 'blastingDelayHours' | 'redeploy' | 'dryBlastTolerance'
  label: string
  /** Why a planner might believe this moves output at all. */
  rationale: string
  options: AssumptionOption[]
}

export const ASSUMPTION_GROUPS: AssumptionGroup[] = [
  {
    id: 'shiftWindow',
    label: 'Haulage shift window',
    rationale:
      'Assumes cooler early shifts sustain a higher haulage rate than night shifts. Not measured here.',
    options: [
      { value: '04-10', label: '04:00–10:00', factor: 1.18 },
      { value: '06-14', label: '06:00–14:00', factor: 1.06 },
      { value: '22-06', label: '22:00–06:00', factor: 0.92 },
    ],
  },
  {
    id: 'blastingDelayHours',
    label: 'Blasting delay',
    rationale: 'Assumes a delayed blast pushes downstream loading out of the shift.',
    options: [
      { value: 0, label: 'On time', factor: 1.0 },
      { value: 6, label: '+6 h', factor: 0.93 },
      { value: 12, label: '+12 h', factor: 0.84 },
    ],
  },
  {
    id: 'redeploy',
    label: 'Equipment redeployment',
    rationale: 'Assumes added capacity converts to output at these rates.',
    options: [
      { value: 'none', label: 'None', factor: 1.0 },
      { value: '1-crusher', label: '+1 crusher', factor: 1.07 },
      { value: '1-shovel-1-dumper', label: '+1 shovel, +1 dumper', factor: 1.12 },
    ],
  },
  {
    id: 'dryBlastTolerance',
    label: 'Dry-blast tolerance',
    rationale: 'Assumes a looser tolerance permits more blasts in wet conditions.',
    options: [
      { value: 10, label: '10 mm', factor: 0.96 },
      { value: 20, label: '20 mm', factor: 0.99 },
      { value: 30, label: '30 mm', factor: 1.01 },
    ],
  },
]

export const ASSUMPTION_NOTE =
  'Assumption-based estimate, not a forecast. Each coefficient is a planner ' +
  'assumption shown above — none is fitted and no data was used to derive it. ' +
  'The validated forecaster is nakshatra-gbt-cqr-v1.'

/** Default factors, by group id, as shipped. */
export function defaultFactors(): Record<string, number> {
  return Object.fromEntries(
    ASSUMPTION_GROUPS.map((g) => [g.id, g.options[0]?.factor ?? 1])
  )
}
