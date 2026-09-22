'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'
import SpaceDustParticles from '@/components/mission-control/SpaceDustParticles'
import { Box, ArrowLeft, ArrowRight, MapPin, Sparkles, Home } from 'lucide-react'

export default function MineTwinPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

  return (
    <main className="relative min-h-screen bg-[#020408] text-[#E8F0F2] pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <SpaceDustParticles />

      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(0,255,136,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb & Mission Control Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-slate-400 hover:text-white font-bold">
              <Home size={14} className="text-[#00FF88]" />
              <span>Mission Control (Video Landing)</span>
            </Link>
            <span>/</span>
            <span className="text-[#00FF88] font-bold">Feature Page 03: Mine Twin & Operational Simulator</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-mono font-bold flex items-center gap-2 hover:bg-[#00FF88]/25 transition-all shadow-[0_0_12px_rgba(0,255,136,0.3)]"
            >
              <Sparkles size={13} />
              <span>Back to Video Landing Page</span>
            </Link>
          </div>
        </div>

        {/* Mine Switcher Dock */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#081022]/90 border border-white/15 backdrop-blur-xl">
          <span className="text-xs font-mono text-slate-300 font-bold flex items-center gap-2 uppercase">
            <MapPin size={14} className="text-[#00FF88]" />
            Active Mine Context:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {FALLBACK_MINES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMine(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                  selectedMine.id === m.id
                    ? 'bg-gradient-to-r from-[#00FF88] to-[#38BDF8] text-black font-extrabold shadow-[0_0_15px_rgba(0,255,136,0.5)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
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
            <Box className="text-[#00FF88]" size={20} />
            <h1 className="text-xl sm:text-2xl font-bold font-space text-white">
              DIGITAL TWIN &bull; WHAT-IF OPERATIONAL SCENARIO SIMULATOR
            </h1>
          </div>

          <MineTwinPanel selectedMine={selectedMine} />
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-2xl bg-[#060C1B]/95 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/evaluator"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft size={16} />
            <span>Page 2: ML Architecture</span>
          </Link>

          <Link
            href="/production"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#38BDF8]/25 via-[#818CF8]/20 to-[#A855F7]/25 hover:from-[#38BDF8]/40 hover:to-[#A855F7]/40 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer border border-[#38BDF8]/60 hover:border-[#A855F7] shadow-[0_0_18px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-extrabold text-white drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]">Page 4: Production Sentinel</span>
            <ArrowRight size={15} className="text-[#38BDF8]" />
          </Link>
        </div>
      </div>
    </main>
  )
}
