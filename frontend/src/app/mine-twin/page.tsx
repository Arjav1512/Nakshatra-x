'use client'

import { useState } from 'react'
import { MineSwitcher, PageHeader, PageNav } from '@/components/ui/primitives'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'

export default function MineTwinPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

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

        <MineSwitcher
          mines={FALLBACK_MINES}
          selectedId={selectedMine.id}
          onSelect={setSelectedMine}
        />

        {/* A second H1, "Mine twin", sat here between the page title and
            the panel's own heading: three titles for one calculator. The
            page title and the panel's mine name are the two it needs. */}
        <MineTwinPanel selectedMine={selectedMine} />

        {/* These were "Page 2: ML Architecture" and "Page 4: Production
            Sentinel" — names of screens that no longer exist. */}
        <PageNav
          links={[
            { href: '/production', label: 'Production', detail: 'The conditions behind a mine’s shortfall estimate' },
            { href: '/blending', label: 'Ore blending', detail: 'The cheapest blend over stated stockpile assumptions' },
            { href: '/method', label: 'Method and evidence', detail: 'How both tracks are built and validated' },
          ]}
        />
      </div>
    </main>
  )
}
