'use client'

import { useState } from 'react'
import { PageHeader, PageNav } from '@/components/ui/primitives'
import { selectedFrom, useMineRegister } from '@/components/mission-control/mine-register'
import { RegisterMineSelect } from '@/components/mission-control/RegisterMineSelect'
import JudgesArchitectureDeck from '@/components/mission-control/JudgesArchitectureDeck'
import RealtimeMLTrainingStudio from '@/components/mission-control/RealtimeMLTrainingStudio'

export default function EvaluatorPage() {
  // The mine comes from FastAPI's register, or there is none (mine-register.ts).
  const register = useMineRegister()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selectedMine = selectedFrom(register, chosenId)

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
          eyebrow="Method"
          title="Method and evidence"
          description="How Track A and Track B are built and validated: the features the models actually use, the held-out accuracy, and the limits each one carries."
        />

        <RegisterMineSelect
          register={register}
          selected={selectedMine}
          onSelect={(m) => setChosenId(m.id)}
          withoutRegister="The method and its validation below do not depend on a mine and are shown in full."
        />

        {/* Nothing below renders until the register has answered, so content
            arriving with it is inserted rather than pushed down (test:cls). */}
        {register.status === 'loading' ? null : (
          <>
        {/* The page had a second H1 here repeating "Method and evidence". */}
        <div className="space-y-8">
          <JudgesArchitectureDeck />
          <RealtimeMLTrainingStudio mine={selectedMine ?? undefined} />
        </div>

        <PageNav
          links={[
            { href: '/console', label: 'Console', detail: 'Portfolio shortfall risk, and both tracks per mine' },
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
