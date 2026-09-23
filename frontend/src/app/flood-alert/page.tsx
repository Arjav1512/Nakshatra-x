'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FALLBACK_MINES } from '@/components/mission-control/data'
import LocationFloodAlertFinder from '@/components/mission-control/LocationFloodAlertFinder'
import { CloudRain, ArrowLeft, ArrowRight, Home, Sparkles } from 'lucide-react'

export default function DedicatedFloodAlertPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])

  return (
    <main className="relative min-h-screen bg-[#020408] text-[#E8F0F2] pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(0,229,255,0.15)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-slate-400 hover:text-white font-bold">
              <Home size={14} className="text-[#00FF88]" />
              <span>Mission Control (Landing Page)</span>
            </Link>
            <span>/</span>
            <span className="text-[#00E5FF] font-bold">Real-Time ISRO Satellite Flood Alert Search</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-mono font-bold flex items-center gap-2 hover:bg-[#00FF88]/25 transition-colors shadow-[0_0_12px_rgba(0,255,136,0.3)]"
            >
              <Sparkles size={13} />
              <span>Back to Video Landing Page</span>
            </Link>
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CloudRain className="text-[#00E5FF] " size={24} />
            <h1 className="text-xl sm:text-3xl font-bold font-space text-white">
              ISRO RAIN RADAR &amp; REAL-TIME SATELLITE FLOOD ALERT FINDER
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
            Type any mine location, city, district, or coordinates in India below to search and calculate live 14-day rainfall totals, soil moisture saturation, and 30-minute ISRO Doppler radar cloudburst predictions.
          </p>
        </div>

        {/* Dedicated Standalone Search Widget */}
        <LocationFloodAlertFinder onSelectMine={(m) => setSelectedMine(m)} />

        {/* Navigation Footer */}
        <div className="p-4 rounded-2xl bg-[#060C1B]/95 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Mission Control Landing Page</span>
          </Link>

          <Link
            href="/production"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF]/25 via-[#38BDF8]/20 to-[#A855F7]/25 hover:from-[#00E5FF]/40 hover:to-[#A855F7]/40 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-[#00E5FF]/60 shadow-[0_0_18px_rgba(0,229,255,0.25)] backdrop-blur-xl"
          >
            <span className="font-extrabold text-white">Production &amp; SCADA Dewatering Pumps</span>
            <ArrowRight size={15} className="text-[#00E5FF]" />
          </Link>
        </div>
      </div>
    </main>
  )
}
