'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'
import { Box, ArrowLeft, ArrowRight, MapPin, Sparkles, Home } from 'lucide-react'

export default function MineTwinPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

  return (
    <main className="relative min-h-screen bg-surface-0 text-text-primary pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(0,255,136,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb & Mission Control Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-accent">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-bold">
              <Home size={14} className="text-accent" />
              <span>Mission Control (Video Landing)</span>
            </Link>
            <span>/</span>
            <span className="text-accent font-bold">Feature Page 03: Mine Twin & Operational Simulator</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-accent/15 border border-accent/40 text-accent text-xs font-mono font-bold flex items-center gap-2 hover:bg-accent/25 transition-colors"
            >
              <Sparkles size={13} />
              <span>Back to Video Landing Page</span>
            </Link>
          </div>
        </div>

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
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-text-primary">
              DIGITAL TWIN &bull; WHAT-IF OPERATIONAL SCENARIO SIMULATOR
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
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-gradient-to-r from-accent/25 via-[#818CF8]/20 to-[#A855F7]/25 hover:from-accent/40 hover:to-[#A855F7]/40 text-text-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-accent/60 hover:border-[#A855F7] hover:  hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-semibold text-text-primary drop-">Page 4: Production Sentinel</span>
            <ArrowRight size={15} className="text-accent" />
          </Link>
        </div>
      </div>
    </main>
  )
}
