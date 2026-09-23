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
    <main className="relative min-h-screen bg-[#020408] text-[#E8F0F2] pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Radial background sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl space-y-8">
        {/* Header Breadcrumb & Mission Control Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
            <Link href="/" className="hover:underline flex items-center gap-1.5 text-slate-400 hover:text-white font-bold">
              <Home size={14} className="text-[#00FF88]" />
              <span>Mission Control (Video Landing)</span>
            </Link>
            <span>/</span>
            <span className="text-[#38BDF8] font-bold">Feature Page 04: Production Sentinel</span>
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

        {/* Mine Switcher Dock */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#081022]/90 border border-white/15 backdrop-blur-xl">
          <span className="text-xs font-mono text-slate-300 font-bold flex items-center gap-2 uppercase">
            <MapPin size={14} className="text-[#38BDF8]" />
            Active Mine Context:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {FALLBACK_MINES.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMine(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                  selectedMine.id === m.id
                    ? 'bg-gradient-to-r from-[#38BDF8] to-[#00FF88] text-black font-extrabold shadow-[0_0_15px_rgba(56,189,248,0.5)]'
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
            <Activity className="text-[#38BDF8]" size={20} />
            <h1 className="text-xl sm:text-2xl font-bold font-space text-white">
              STAGE 01 &bull; PRODUCTION SENTINEL & EXTRACTION FORECAST
            </h1>
          </div>

          <ProductionSentinel mine={selectedMine} forecast={forecast} risk={risk} weather={weather} />
        </div>

        {/* Bottom Page Navigation Bar */}
        <div className="p-4 rounded-2xl bg-[#060C1B]/95 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-12">
          <Link
            href="/mine-twin"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Page 3: Mine Twin</span>
          </Link>

          <Link
            href="/blending"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FACC15]/25 via-[#FF2E63]/25 to-[#990022]/30 hover:from-[#FACC15]/40 hover:to-[#FF2E63]/50 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors duration-300 cursor-pointer border border-[#FF2E63]/60 hover:border-[#FF80AB] shadow-[0_0_18px_rgba(255,46,99,0.25)] hover:shadow-[0_0_30px_rgba(255,46,99,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="font-extrabold text-white drop-shadow-[0_0_8px_rgba(255,46,99,0.6)]">Page 5: Ore Blending & Risk</span>
            <ArrowRight size={15} className="text-[#FF2E63]" />
          </Link>
        </div>
      </div>
    </main>
  )
}
