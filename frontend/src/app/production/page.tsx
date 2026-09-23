'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FALLBACK_MINES, fetchLiveMineTelemetry } from '@/components/mission-control/data'
import type { WeatherSignal, ProductionForecast, RiskAnalysis } from '@/components/mission-control/types'
import ProductionSentinel from '@/components/mission-control/ProductionSentinel'
import { Activity, ArrowLeft, ArrowRight, MapPin, Sparkles, Home } from 'lucide-react'

export default function ProductionPage() {
  const [selectedMine, setSelectedMine] = useState(FALLBACK_MINES[0])
  const [weather, setWeather] = useState<WeatherSignal | null>(null)
  const [forecast, setForecast] = useState<ProductionForecast | null>(null)
  const [risk, setRisk] = useState<RiskAnalysis | null>(null)

  useEffect(() => {
    async function loadTelemetry() {
      const data = await fetchLiveMineTelemetry(selectedMine)
      setWeather(data.weather)
      setForecast(data.forecast)
      setRisk(data.risk)
    }
    loadTelemetry()
  }, [selectedMine])

  return (
    <main className="relative min-h-screen bg-surface-0 text-text-primary pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb & Mission Control Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-accent">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-bold">
              <Home size={14} className="text-accent" />
              <span>Mission Control (Video Landing)</span>
            </Link>
            <span>/</span>
            <span className="text-accent font-bold">Feature Page 04: Production Sentinel</span>
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
            <Activity className="text-accent" size={20} />
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-text-primary">
              STAGE 01 &bull; PRODUCTION SENTINEL & EXTRACTION FORECAST
            </h1>
          </div>

          <ProductionSentinel mine={selectedMine} forecast={forecast} risk={risk} weather={weather} />
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-md bg-surface-1/95 border border-border-interactive  shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/mine-twin"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-surface-3 hover:bg-white/20 border border-border-interactive text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Page 3: Mine Twin</span>
          </Link>

          <Link
            href="/blending"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-gradient-to-r from-status-caution/25 via-status-critical/25 to-[#990022]/30 hover:from-status-caution/40 hover:to-status-critical/50 text-text-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-status-critical/60 hover:border-[#FF80AB] hover:  hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-semibold text-text-primary drop-">Page 5: Ore Blending & Risk</span>
            <ArrowRight size={15} className="text-status-critical" />
          </Link>
        </div>
      </div>
    </main>
  )
}
