'use client'

import dynamic from 'next/dynamic'

/**
 * Mounts the AI-X copilot, which the app bar's button opens.
 *
 * HistoricalForecastModal was also mounted here. It was opened only from
 * /features/[id] and MissionControlDashboard, both of which this stage removes,
 * so it became unreachable. It rendered an illustrative synthetic trajectory
 * from /api/v1/historical-forecasts — explicitly not the validated forecaster —
 * next to a provenance block naming MOIL, IBM, GSI and IMD. The console already
 * carries the real forecast with its published backtest, so the weaker and more
 * confusable of the two is gone rather than rehomed.
 */
const AICopilotModal = dynamic(
  () => import('@/components/mission-control/AICopilotModal'),
  { ssr: false }
)

export default function GlobalCopilotWrapper() {
  return <AICopilotModal />
}
