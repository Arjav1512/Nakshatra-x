'use client'

import { useState } from 'react'
import { PageHeader, PageNav } from '@/components/ui/primitives'
import { selectedFrom, useMineRegister } from '@/components/mission-control/mine-register'
import { RegisterMineSelect } from '@/components/mission-control/RegisterMineSelect'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'

export default function MineTwinPage() {
  // The mine comes from FastAPI's register, or there is none (mine-register.ts).
  const register = useMineRegister()
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selectedMine = selectedFrom(register, chosenId)

  return (
    // overflow-x-clip, not overflow-hidden: hidden makes this a scroll
    // container, and the panel's sticky controls would stick to it instead of
    // the page.
    <main className="relative mx-auto max-w-[1280px] overflow-x-clip px-4 pb-8 pt-10 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/*
          The breadcrumb read "Mission Control (Video Landing) / Feature Page NN"
          and the action was "Back to Video Landing Page". The video landing was
          removed in Stage 1, and "Feature Page 03" names nothing a planner is
          looking for. Orientation now says what the screen is (B-5).
        */}
        <PageHeader
          eyebrow="Operations · Scenario"
          title="Scenario calculator"
          description="A what-if calculator for one mine: set the operating assumptions, see what the arithmetic gives against the mine's own forecast baseline, and whether the constraint engine permits the plan."
        />

        <RegisterMineSelect
          register={register}
          selected={selectedMine}
          onSelect={(m) => setChosenId(m.id)}
          withoutRegister="The calculator works against one mine's forecast, so it is not shown."
        />

        {/* Nothing below renders until the register has answered, so content
            arriving with it is inserted rather than pushed down (test:cls). */}
        {register.status === 'loading' ? null : (
          <>
        {/* A second H1, "Mine twin", sat here between the page title and
            the panel's own heading: three titles for one calculator. The
            page title and the panel's mine name are the two it needs. */}
        {selectedMine ? <MineTwinPanel selectedMine={selectedMine} /> : null}

        {/* These were "Page 2: ML Architecture" and "Page 4: Production
            Sentinel" — names of screens that no longer exist. */}
        <PageNav
          links={[
            { href: '/production', label: 'Production', detail: 'The conditions behind a mine’s shortfall estimate' },
            { href: '/blending', label: 'Ore blending', detail: 'The cheapest blend over stated stockpile assumptions' },
            { href: '/method', label: 'Method and evidence', detail: 'How both tracks are built and validated' },
          ]}
        />
          </>
        )}
      </div>
    </main>
  )
}
