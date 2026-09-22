'use client'

import type React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FEATURES_DATA, type FeatureItem } from '@/data/featuresData'
import { FALLBACK_MINES, } from '@/components/mission-control/data'
import IndiaSatelliteMap from '@/components/mission-control/IndiaSatelliteMap'
import RealtimeMLTrainingStudio from '@/components/mission-control/RealtimeMLTrainingStudio'
import MineTwinPanel from '@/components/mine-twin/MineTwinPanel'
import SmartOreBlendingModal from '@/components/mission-control/SmartOreBlendingModal'
import ProductionSentinel from '@/components/mission-control/ProductionSentinel'
import {
  Satellite,
  Brain,
  Map,
  Box,
  Layers,
  Activity,
  History,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Bot,
  Zap,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Satellite,
  Brain,
  Map,
  Box,
  Layers,
  Activity,
  History,
  ShieldCheck,
}

export default function SingleFeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const currentMine = FALLBACK_MINES[0]

  // Find target feature
  const featureIndex = FEATURES_DATA.findIndex(
    (f) => f.slug === resolvedParams.id || f.id === resolvedParams.id
  )
  const currentFeature: FeatureItem | undefined = FEATURES_DATA[featureIndex]

  if (!currentFeature) {
    return (
      <main className="min-h-screen bg-[#020408] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold text-red-500 font-mono mb-4">Feature Not Found</h1>
        <p className="text-slate-400 max-w-md mb-6">
          The requested feature page &quot;{resolvedParams.id}&quot; does not exist.
        </p>
        <Link
          href="/features"
          className="px-6 py-2.5 rounded-xl bg-[#00FF88] text-black font-mono font-bold text-xs uppercase"
        >
          Return to Features Hub
        </Link>
      </main>
    )
  }

  const Icon = ICON_MAP[currentFeature.iconName] || Satellite
  const prevFeature = FEATURES_DATA[featureIndex > 0 ? featureIndex - 1 : FEATURES_DATA.length - 1]
  const nextFeature = FEATURES_DATA[featureIndex < FEATURES_DATA.length - 1 ? featureIndex + 1 : 0]

  return (
    <main className="relative min-h-screen bg-[#020408] text-[#E8F0F2] pt-24 md:pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Dynamic Background Sheen matching feature accent color */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] blur-3xl opacity-15 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: currentFeature.color }}
      />

      <div className="relative mx-auto max-w-7xl">
        {/* ============================================================
            1. TOP STEP-BY-STEP FEATURE SWITCHER DOCK
            ============================================================ */}
        <div className="mb-8 p-4 rounded-2xl bg-[#081022]/90 border border-white/15 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
              <Link href="/features" className="hover:underline flex items-center gap-1 text-slate-400 hover:text-white">
                <ArrowLeft size={13} /> Features Hub
              </Link>
              <span>/</span>
              <span className="text-[#00FF88] font-bold">
                Feature {String(currentFeature.number).padStart(2, '0')} of 08
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                Step-by-Step Feature Selector:
              </span>
            </div>
          </div>

          {/* 8 Feature Buttons Dock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {FEATURES_DATA.map((feat) => {
              const isActive = feat.id === currentFeature.id
              return (
                <button
                  key={feat.id}
                  onClick={() => router.push(`/features/${feat.slug}`)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-gradient-to-b from-[#00FF88]/20 to-[#00FF88]/5 border-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.3)] scale-[1.02]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300'
                  }`}
                  type="button"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-mono font-black ${
                        isActive ? 'text-[#00FF88]' : 'text-[#38BDF8]'
                      }`}
                    >
                      #{String(feat.number).padStart(2, '0')}
                    </span>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-ping" />}
                  </div>
                  <span
                    className={`text-xs font-bold font-space truncate ${
                      isActive ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {feat.shortTitle}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ============================================================
            2. FEATURE HERO BANNER
            ============================================================ */}
        <div className="rounded-3xl bg-[#081022]/80 border border-white/15 p-6 sm:p-10 mb-10 shadow-2xl relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ backgroundColor: currentFeature.color }}
          />

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider border shadow-md"
              style={{
                backgroundColor: `${currentFeature.color}20`,
                borderColor: currentFeature.color,
                color: currentFeature.color,
              }}
            >
              FEATURE #{String(currentFeature.number).padStart(2, '0')} OF 08
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 border border-white/20 text-slate-200">
              {currentFeature.category}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8]">
              {currentFeature.badge}
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-3 rounded-2xl border"
                  style={{
                    backgroundColor: `${currentFeature.color}15`,
                    borderColor: `${currentFeature.color}50`,
                    color: currentFeature.color,
                  }}
                >
                  <Icon size={32} />
                </div>
                <h1 className="text-2xl sm:text-4xl font-black font-space text-white tracking-tight leading-tight">
                  {currentFeature.title}
                </h1>
              </div>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal mt-3">
                {currentFeature.overview}
              </p>
            </div>

            {/* Quick Action Navigation */}
            <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => router.push(`/features/${nextFeature.slug}`)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#38BDF8] text-black font-mono text-xs font-black uppercase tracking-wider hover:brightness-110 shadow-[0_0_20px_rgba(0,255,136,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                type="button"
              >
                <span>NEXT FEATURE (#{String(nextFeature.number).padStart(2, '0')})</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            3. LIVE INTERACTIVE FEATURE PREVIEW ENGINE
            ============================================================ */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00FF88] animate-ping" />
              <h2 className="text-xs font-mono font-black uppercase tracking-widest text-[#00FF88]">
                LIVE INTERACTIVE COMPONENT PREVIEW &bull; {currentFeature.shortTitle.toUpperCase()}
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Interactive Sandbox Active
            </span>
          </div>

          <div className="rounded-3xl border border-white/15 bg-[#050B18]/90 overflow-hidden shadow-2xl p-2 sm:p-4">
            {currentFeature.componentKey === 'satellite-map' && (
              <IndiaSatelliteMap
                selectedMine={currentMine}
                onSelectMine={() => {}}
                activeLayer="satellite"
                onChangeLayer={() => {}}
              />
            )}

            {currentFeature.componentKey === 'ml-studio' && (
              <RealtimeMLTrainingStudio mine={currentMine} />
            )}

            {currentFeature.componentKey === 'mine-twin' && (
              <MineTwinPanel selectedMine={currentMine} />
            )}

            {currentFeature.componentKey === 'smart-blending' && (
              <SmartOreBlendingModal mine={currentMine} />
            )}

            {currentFeature.componentKey === 'production-sentinel' && (
              <ProductionSentinel mine={currentMine} />
            )}

            {currentFeature.componentKey === 'historical-forecast' && (
              <div className="p-8 text-center space-y-6 bg-slate-900/60 rounded-2xl border border-white/10">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[#00E5FF]/20 border border-[#00E5FF]/50 flex items-center justify-center text-[#00E5FF]">
                  <History size={36} />
                </div>
                <h3 className="text-2xl font-bold font-space text-white">50-Year Historical Database & 2040 Forecast Engine</h3>
                <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                  Explore a synthetic 50-year production series generated to the published ingestion contract, with an illustrative forward trajectory. Not MOIL's reported figures, and not an ARIMA model — no such library is a dependency.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-historical-forecast-modal'))}
                  className="px-6 py-3 rounded-xl bg-[#00E5FF] text-black font-mono font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] cursor-pointer"
                  type="button"
                >
                  Launch Interactive 50-Year Historical Modal
                </button>
              </div>
            )}

            {currentFeature.componentKey === 'ai-copilot' && (
              <div className="p-8 text-center space-y-6 bg-slate-900/60 rounded-2xl border border-white/10">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[#00FF88]/20 border border-[#00FF88]/50 flex items-center justify-center text-[#00FF88]">
                  <Bot size={36} />
                </div>
                <h3 className="text-2xl font-bold font-space text-white">AI Sentinel Conversational Copilot</h3>
                <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                  Interactive domain LLM copilot with real-time telemetry context, voice input speech-to-text, and automated IBM compliance reporting.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-aix-copilot'))}
                  className="px-6 py-3 rounded-xl bg-[#00FF88] text-black font-mono font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,136,0.4)] cursor-pointer"
                  type="button"
                >
                  Launch Interactive AI Copilot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            4. TECHNICAL SPECIFICATIONS & CAPABILITIES GRID
            ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {/* Key Capabilities Column */}
          <div className="lg:col-span-2 rounded-3xl bg-[#081022]/80 border border-white/15 p-6 sm:p-8">
            <h3 className="text-lg font-bold font-space text-white flex items-center gap-2 mb-6">
              <Zap className="text-[#00FF88]" size={20} />
              Key Technical Capabilities
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentFeature.keyCapabilities.map((cap, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 hover:border-white/20 transition-all"
                >
                  <CheckCircle2 size={18} className="text-[#00FF88] shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-200 leading-relaxed font-normal">{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Specifications Column */}
          <div className="rounded-3xl bg-[#081022]/80 border border-white/15 p-6 sm:p-8">
            <h3 className="text-lg font-bold font-space text-white flex items-center gap-2 mb-6">
              <Cpu className="text-[#38BDF8]" size={20} />
              System Specs
            </h3>

            <div className="space-y-4">
              {currentFeature.specifications.map((spec, i) => (
                <div key={i} className="pb-3 border-b border-white/10 last:border-0 last:pb-0">
                  <div className="text-[11px] font-mono text-slate-400 uppercase">{spec.label}</div>
                  <div className="text-sm font-bold font-mono text-[#38BDF8] mt-0.5">{spec.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================
            5. BOTTOM ONE-BY-ONE NAVIGATION BAR
            ============================================================ */}
        <div className="sticky bottom-6 z-40 p-4 rounded-2xl bg-[#060C1B]/95 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Previous Feature Button */}
          <button
            onClick={() => router.push(`/features/${prevFeature.slug}`)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            type="button"
          >
            <ArrowLeft size={16} />
            <span>PREVIOUS: FEATURE #{String(prevFeature.number).padStart(2, '0')} ({prevFeature.shortTitle})</span>
          </button>

          {/* Center Hub Link */}
          <Link
            href="/features"
            className="text-xs font-mono font-bold text-[#38BDF8] hover:text-[#00FF88] underline transition-colors"
          >
            All Features Hub (8 Total)
          </Link>

          {/* Next Feature Button */}
          <button
            onClick={() => router.push(`/features/${nextFeature.slug}`)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00FF88] hover:bg-[#00FF88]/90 text-black font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,136,0.4)] cursor-pointer"
            type="button"
          >
            <span>NEXT: FEATURE #{String(nextFeature.number).padStart(2, '0')} ({nextFeature.shortTitle})</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </main>
  )
}
