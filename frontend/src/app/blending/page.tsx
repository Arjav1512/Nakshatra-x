'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/primitives'
import { FALLBACK_MINES, fetchLiveMineTelemetry } from '@/components/mission-control/data'
import type { WeatherSignal, RiskAnalysis } from '@/components/mission-control/types'
import SmartOreBlendingModal from '@/components/mission-control/SmartOreBlendingModal'
import RiskCockpit from '@/components/mission-control/RiskCockpit'
import { Layers, ArrowLeft, MapPin, Sparkles, Home, } from 'lucide-react'

export default function BlendingPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])
  const [weather, setWeather] = useState<WeatherSignal | null>(null)
  const [risk, setRisk] = useState<RiskAnalysis | null>(null)

  useEffect(() => {
    async function loadTelemetry() {
      const data = await fetchLiveMineTelemetry(selectedMine)
      setWeather(data.weather)
      setRisk(data.risk)
    }
    loadTelemetry()
  }, [selectedMine])

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
          title="Ore blending"
          description="A linear program over illustrative stockpiles: the cheapest blend that meets a target tonnage and grade. There is no stockpile register in this system, so the inputs are stated assumptions rather than inventory."
        />

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
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Layers className="text-status-caution" size={20} />
            <h1 className="text-2xl">
              Ore blending
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <div className="h-full">
              <SmartOreBlendingModal mine={selectedMine} />
            </div>
            <div className="h-full">
              <RiskCockpit mine={selectedMine} weather={weather} risk={risk} />
            </div>
          </div>
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-md bg-surface-1/95 border border-border-interactive  shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/production"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-surface-3 hover:bg-white/20 border border-border-interactive text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Page 4: Production Sentinel</span>
          </Link>

          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border-interactive bg-surface-2 px-4 text-sm text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            <Home size={15} className="mr-2 text-text-tertiary" aria-hidden="true" />
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
