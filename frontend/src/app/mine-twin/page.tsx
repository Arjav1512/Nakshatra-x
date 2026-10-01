'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/primitives'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'
import { Box, ArrowLeft, ArrowRight, MapPin, Sparkles, Home } from 'lucide-react'

export default function MineTwinPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

  return (
    <main className="relative min-h-screen bg-surface-0 text-text-primary pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/*
          The breadcrumb read "Mission Control (Video Landing) / Feature Page NN"
          and the action was "Back to Video Landing Page". The video landing was
          removed in Stage 1, and "Feature Page 03" names nothing a planner is
          looking for. Orientation now says what the screen is (B-5).
        */}
        <PageHeader
          title="Scenario calculator"
          description="A what-if calculator for one mine: set the operating assumptions, see what the arithmetic gives against the mine's own forecast baseline, and whether the constraint engine permits the plan."
        />

        {/* Mine Switcher Dock */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md bg-surface-1/90 border border-border-default ">
          <span className="text-xs font-mono text-text-secondary font-bold flex items-center gap-2 uppercase">
            <MapPin size={14} className="text-accent" />
            Active Mine Context:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {FALLBACK_MINES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMine(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                  selectedMine.id === m.id
                    ? 'bg-gradient-to-r from-accent to-accent text-black font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
                }`}
                type="button"
              >
                {m.name} ({m.state})
              </button>
            ))}
          </div>
        </div>

        {/* Core Component Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Box className="text-accent" size={20} />
            <h1 className="text-2xl">
              Mine twin
            </h1>
          </div>

          <MineTwinPanel selectedMine={selectedMine} />
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-md bg-surface-1/95 border border-border-interactive  shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/method"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-surface-3 hover:bg-white/20 border border-border-interactive text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Page 2: ML Architecture</span>
          </Link>

          <Link
            href="/production"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-gradient-to-r from-accent/25 via-[var(--color-accent)]/20 to-[var(--color-accent)]/25 hover:from-accent/40 hover:to-[var(--color-accent)]/40 text-text-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-accent/60 hover:border-[var(--color-accent)] hover:  hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-semibold text-text-primary drop-">Page 4: Production Sentinel</span>
            <ArrowRight size={15} className="text-accent" />
          </Link>
        </div>
      </div>
    </main>
  )
}
