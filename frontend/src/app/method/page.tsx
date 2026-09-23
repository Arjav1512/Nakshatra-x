'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import JudgesArchitectureDeck from '@/components/mission-control/JudgesArchitectureDeck'
import RealtimeMLTrainingStudio from '@/components/mission-control/RealtimeMLTrainingStudio'
import { Cpu, ArrowLeft, ArrowRight, MapPin, Sparkles, Home } from 'lucide-react'

export default function EvaluatorPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

  return (
    <main className="relative min-h-screen bg-surface-0 text-text-primary pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(251,146,60,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb & Mission Control Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-accent">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-bold">
              <Home size={14} className="text-accent" />
              <span>Mission Control (Video Landing)</span>
            </Link>
            <span>/</span>
            <span className="text-status-caution font-bold">Feature Page 02: ML Architecture & Training Studio</span>
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
            <MapPin size={14} className="text-status-caution" />
            Active Mine Context:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {FALLBACK_MINES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMine(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                  selectedMine.id === m.id
                    ? 'bg-gradient-to-r from-status-caution to-status-caution text-black font-semibold'
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
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <Cpu className="text-status-caution" size={20} />
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-text-primary">
              EXECUTIVE EVALUATOR &bull; MACHINE LEARNING PIPELINE & REAL-TIME TRAINING STUDIO
            </h1>
          </div>

          <JudgesArchitectureDeck />
          <RealtimeMLTrainingStudio mine={selectedMine} />
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-md bg-surface-1/95 border border-border-interactive  shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-surface-3 hover:bg-white/20 border border-border-interactive text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Page 1: Mission Control & 3D Map</span>
          </Link>

          <Link
            href="/mine-twin"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-gradient-to-r from-accent/25 via-accent/20 to-accent/25 hover:from-accent/40 hover:to-accent/40 text-text-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-accent/60 hover:border-accent hover:  hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-semibold text-text-primary drop-">Page 3: Mine Twin Simulator</span>
            <ArrowRight size={15} className="text-accent" />
          </Link>
        </div>
      </div>
    </main>
  )
}
