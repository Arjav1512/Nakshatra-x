'use client'

import dynamic from 'next/dynamic'

const AICopilotModal = dynamic(
  () => import('@/components/mission-control/AICopilotModal'),
  { ssr: false }
)

const HistoricalForecastModal = dynamic(
  () => import('@/components/mission-control/HistoricalForecastModal'),
  { ssr: false }
)

export default function GlobalCopilotWrapper() {
  return (
    <>
      <AICopilotModal />
      <HistoricalForecastModal />
    </>
  )
}
