'use client'

import { useState, useEffect } from 'react'
import { EmptyState, PageHeader, PageNav } from '@/components/ui/primitives'
import { fetchLiveMineTelemetry } from '@/components/mission-control/data'
import { selectedFrom, useMineRegister } from '@/components/mission-control/mine-register'
import { RegisterMineSelect } from '@/components/mission-control/RegisterMineSelect'
import type { WeatherSignal, RiskAnalysis } from '@/components/mission-control/types'
import SmartOreBlendingModal from '@/components/mission-control/SmartOreBlendingModal'
import RiskCockpit from '@/components/mission-control/RiskCockpit'

export default function BlendingPage() {
  // The mine comes from FastAPI's register, or there is none (mine-register.ts).
  const register = useMineRegister()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selectedMine = selectedFrom(register, chosenId)
  const [weather, setWeather] = useState<WeatherSignal | null>(null)
  const [risk, setRisk] = useState<RiskAnalysis | null>(null)

  useEffect(() => {
    if (!selectedMine) return
    let alive = true
    // Null when there is no telemetry; RiskCockpit then says so.
    fetchLiveMineTelemetry(selectedMine).then((data) => {
      if (!alive) return
      setWeather(data?.weather ?? null)
      setRisk(data?.risk ?? null)
    })
    return () => {
      alive = false
    }
  }, [selectedMine])

  return (
    <main className="relative mx-auto max-w-[1280px] px-4 pb-8 pt-10 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/*
          The breadcrumb read "Mission Control (Video Landing) / Feature Page NN"
          and the action was "Back to Video Landing Page". The video landing was
          removed in Stage 1, and "Feature Page 03" names nothing a planner is
          looking for. Orientation now says what the screen is (B-5).
        */}
        <PageHeader
          eyebrow="Operations · Blending"
          title="Ore blending"
          description="A linear program over illustrative stockpiles: the cheapest blend that meets a target tonnage and grade. There is no stockpile register in this system, so the inputs are stated assumptions rather than inventory."
        />

        <RegisterMineSelect
          register={register}
          selected={selectedMine}
          onSelect={(m) => setChosenId(m.id)}
          withoutRegister="The blend below does not depend on a mine; the risk context does, so it is not shown."
        />

        {/* Nothing below renders until the register has answered, so content
            arriving with it is inserted rather than pushed down (test:cls). */}
        {register.status === 'loading' ? null : (
          <>
        {/* The page had a second H1 here repeating "Ore blending". */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <div className="h-full">
            <SmartOreBlendingModal />
          </div>
          <div className="h-full">
            {selectedMine ? (
              <RiskCockpit mine={selectedMine} weather={weather} risk={risk} />
            ) : (
              <EmptyState
                title="Risk context unavailable"
                detail="Risk context belongs to a mine, and no mine is selected while the register cannot be read."
              />
            )}
          </div>
        </div>

        <PageNav
          links={[
            { href: '/production', label: 'Production', detail: 'The conditions behind a mine’s shortfall estimate' },
            { href: '/mine-twin', label: 'Scenario calculator', detail: 'What-if arithmetic against a mine’s forecast' },
            { href: '/', label: 'Home', detail: 'The two tracks, and what they are measured to do' },
          ]}
        />
          </>
        )}
      </div>
    </main>
  )
}
