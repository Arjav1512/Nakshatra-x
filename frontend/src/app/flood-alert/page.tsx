import type { Metadata } from 'next'
import LocationFloodAlertFinder from '@/components/mission-control/LocationFloodAlertFinder'
import { PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Rainfall context · Nakshatra-X',
  description:
    'Measured 14-day rainfall for a location, from Open-Meteo, with the days that were not measured stated as such.',
}

/**
 * The page title used to read "Real-Time ISRO Satellite Flood Alert Search" and
 * linked "Back to Video Landing Page". Neither was accurate: ISRO is not a
 * source here, nothing about this is an alert system, and the video landing
 * page is gone. See LocationFloodAlertFinder for the data that was fabricated
 * underneath that title.
 */
export default function FloodAlertPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Rainfall context"
        description="Accumulated rainfall for a location over the past 14 days, measured. Rain is one of the drivers the Track B forecaster uses, so this is the raw signal behind part of a shortfall estimate — not a flood warning, and not a control system."
      />
      <div className="mt-8">
        <LocationFloodAlertFinder />
      </div>
    </main>
  )
}
