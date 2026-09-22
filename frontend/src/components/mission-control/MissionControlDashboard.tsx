'use client'

import { useEffect, useState } from 'react'
import { FALLBACK_MINES, fetchLiveMineTelemetry, fetchMines } from './data'
import type {
  MineInfo,
  WeatherSignal,
  ProductionForecast,
  RiskAnalysis,
  ShapExplanation,
  AuditRecord,
  STACScene,
} from './types'
import IndiaSatelliteMap, { type LayerType } from './IndiaSatelliteMap'
import SpaceDustParticles from './SpaceDustParticles'
import AICopilotModal from './AICopilotModal'
import { TextEffect } from '@/components/ui/text-effect'
import {
  ShieldCheck,
  MapPin,
  RefreshCw,
  Sparkles,
  Orbit,
  Radio,
  Cpu,
  Layers,
  Activity,
  Lock,
  History,
  Box,
  Search,
} from 'lucide-react'
import Link from 'next/link'


export default function MissionControlDashboard() {
  const [mines, setMines] = useState<MineInfo[]>(FALLBACK_MINES)
  const [selectedMine, setSelectedMine] = useState<MineInfo>(FALLBACK_MINES[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLayer, setActiveLayer] = useState<LayerType>('satellite')

  const getISTTime = () => {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).toUpperCase()
  }

  const [weather, setWeather] = useState<WeatherSignal | null>(null)
  const [forecast, setForecast] = useState<ProductionForecast | null>(null)
  const [risk, setRisk] = useState<RiskAnalysis | null>(null)
  const [shap, setShap] = useState<ShapExplanation | null>(null)
  const [audit, setAudit] = useState<AuditRecord | null>(null)
  const [stacScenes, setStacScenes] = useState<STACScene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('')
  const [countdownSeconds, setCountdownSeconds] = useState(258)
  const [isLiveAutoSync, setIsLiveAutoSync] = useState(true)

  const loadMineData = async (mine: MineInfo, isBackground = false) => {
    if (!isBackground) setIsLoading(true)
    try {
      const data = await fetchLiveMineTelemetry(mine)
      setWeather(data.weather)
      setForecast(data.forecast)
      setRisk(data.risk)
      setShap(data.shap)
      setAudit(data.audit)
      setStacScenes(data.stacScenes)
      setLastSyncTime(getISTTime())
    } finally {
      if (!isBackground) setIsLoading(false)
    }
  }

  // Live real-time Indian Standard Time (IST) clock sync ticker
  useEffect(() => {
    setLastSyncTime(getISTTime())
    const timer = setInterval(() => {
      setLastSyncTime(getISTTime())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function initMines() {
      const dynamicMines = await fetchMines()
      setMines(dynamicMines)
      if (dynamicMines.length > 0) {
        setSelectedMine(dynamicMines[0])
      }
    }
    initMines()
  }, [])

  useEffect(() => {
    if (!selectedMine) return
    loadMineData(selectedMine)
  }, [selectedMine])

  useEffect(() => {
    if (!isLiveAutoSync) return
    const interval = setInterval(() => {
      loadMineData(selectedMine, true)
    }, 4000)
    return () => clearInterval(interval)
  }, [selectedMine, isLiveAutoSync])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev <= 1 ? 300 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }

  const mpMines = mines.filter((m) => m.state === 'MP')
  const mhMines = mines.filter((m) => m.state === 'MH')

  return (
    <section id="mission-control" className="relative z-10 bg-transparent text-[#FFFFFF] border-t border-white/10 overflow-hidden">
      {/* Background Cosmic Particle Bokeh Field */}
      <SpaceDustParticles />

      {/* Subtle Background Radial Light Sheen */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.03)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-16 lg:py-24 flex flex-col gap-12">
        {/* ============================================================
            HERO COMMAND SECTION (Open Floating Layout with Reddish Cyber Accent)
            ============================================================ */}
        <div className="flex flex-col items-center justify-center text-center py-6 sm:py-10 relative">
          <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Top Badges with Cyber Accents */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5">
              <span className="ios-badge ios-badge-live !font-bold">
                <span className="h-2 w-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88] animate-ping" />
                LIVE SATELLITE TELEMETRY ACTIVE
              </span>
              <span className="ios-badge !bg-[#38BDF8]/15 !text-[#38BDF8] !border-[#38BDF8]/40 !font-bold">
                SIH 2026 &bull; PROBLEM ID 26009
              </span>
              <span className="ios-badge !bg-[#FF2E63]/15 !text-[#FF2E63] !border-[#FF2E63]/40 !shadow-[0_0_12px_rgba(255,46,99,0.35)] !font-bold">
                <span className="h-2 w-2 rounded-full bg-[#FF2E63] shadow-[0_0_8px_#FF2E63]" />
                ISRO MOSDAC / BHUVAN ACTIVE
              </span>
              <span className="ios-badge !bg-[#00FF88]/15 !text-[#00FF88] !border-[#00FF88]/40 !font-bold">
                <Orbit className="w-3.5 h-3.5 text-[#00FF88] drop-shadow-[0_0_6px_#00FF88]" />
                NEXT SENTINEL-2 PASS: {formatCountdown(countdownSeconds)}
              </span>
            </div>

            {/* Pure Text with Glowing Space Font, Dual Bloody & Light Transparent Red -X */}
            <div className="flex items-center justify-center gap-x-1 select-none my-3 bg-transparent">
              <span className="font-3d-cyber text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-[0.28em] uppercase font-space text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                NAKSHATRA
              </span>
              <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-[0.28em] bg-gradient-to-r from-[#8B0000] via-[#E60026] to-[rgba(255,102,128,0.85)] bg-clip-text text-transparent ml-1 font-space drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] drop-shadow-[0_0_22px_rgba(230,0,38,0.9)] drop-shadow-[0_0_38px_rgba(139,0,0,0.8)]">
                -X
              </span>
            </div>

            {/* Description - TextEffect Motion Component under Second NAKSHATRA-X heading */}
            <TextEffect
              per="word"
              preset="slide"
              delay={0.1}
              className="text-sm sm:text-base text-slate-300 max-w-2xl mt-2 leading-relaxed font-normal text-center"
            >
              Autonomous Space-Geological Decision Support Platform for Ministry of Steel & MOIL Ltd. Powered by ISRO Earth Observation, MOSDAC / Bhuvan geospatial meteorology, and mathematical shortfall mitigation across India.
            </TextEffect>

            {/* Floating Telemetry Status Capsule */}
            <div className="mt-6 flex items-center gap-4 px-5 py-2.5 rounded-full bg-[rgba(6,12,24,0.6)] backdrop-blur-2xl border border-white/15 shadow-2xl">
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#38BDF8] uppercase font-bold tracking-wider">
                <Radio className="w-3.5 h-3.5 text-[#FF2E63] animate-pulse drop-shadow-[0_0_8px_#FF2E63]" />
                <span>LIVE STREAM TICK: 4s</span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_6px_#00FF88]" />
                10 Active MOIL Sites
              </div>
              <div className="h-4 w-px bg-white/20" />
              <button type="button"
                onClick={() => loadMineData(selectedMine)}
                className="p-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-[#FF2E63]/20 border border-white/20 hover:border-[#FF2E63]/50 text-[#38BDF8] hover:text-[#FF2E63] hover:scale-105 transition-all shadow-md cursor-pointer flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase"
                title="Force Immediate Orbital Sync"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>SYNC</span>
              </button>
              <div className="h-4 w-px bg-white/20" />
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-historical-forecast-modal'))}
                className="ios-glass-button px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 cursor-pointer text-[#38BDF8] border border-[#38BDF8]/40 hover:border-[#00FF88] hover:text-[#00FF88] shadow-[0_0_12px_rgba(56,189,248,0.2)] hover:shadow-[0_0_16px_rgba(0,255,136,0.3)] transition-all"
                title="Open 50-Year Historical Database & 2040 Forecast Panel"
                type="button"
              >
                <History className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>50-Yr History & 2040 Predictions</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            MINE SITE SEARCH & SELECTION DOCK
            ============================================================ */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5 font-bold">
              <MapPin className="w-3.5 h-3.5 text-[#FB923C]" />
              Select or Search Manganese Mining Location (e.g., Dongri, Balaghat, Chikla, Tirodi):
            </span>

            {/* Interactive Mine Location Search Bar */}
            <div className="relative flex-1 max-w-md min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#38BDF8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchQuery(val)
                  if (val.trim()) {
                    const match = mines.find((m) =>
                      m.name.toLowerCase().includes(val.toLowerCase()) ||
                      m.code.toLowerCase().includes(val.toLowerCase()) ||
                      m.state.toLowerCase().includes(val.toLowerCase())
                    )
                    if (match) setSelectedMine(match)
                  }
                }}
                placeholder="Search mine location e.g. Dongri, Balaghat..."
                className="w-full pl-9 pr-4 py-1.5 rounded-full bg-[#060C1B]/90 border border-white/20 text-white placeholder-slate-400 text-xs font-mono focus:outline-none focus:border-[#00FF88] shadow-inner transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* MP Group */}
            <div className="ios-segment-bar flex items-center gap-1.5">
              <span className="px-3 text-[10px] font-mono text-[#94A3B8] border-r border-white/15 font-bold">
                MP
              </span>
              {mpMines.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMine(m)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                    selectedMine.id === m.id
                      ? 'bg-gradient-to-r from-[#FB923C] to-[#FACC15] text-black font-extrabold shadow-[0_0_18px_rgba(251,146,60,0.6)]'
                      : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-white/10'
                  }`}
                  type="button"
                >
                  {m.name}
                </button>
              ))}
            </div>

            {/* MH Group */}
            <div className="ios-segment-bar flex items-center gap-1.5">
              <span className="px-3 text-[10px] font-mono text-[#94A3B8] border-r border-white/15 font-bold">
                MH
              </span>
              {mhMines.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMine(m)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                    selectedMine.id === m.id
                      ? 'bg-gradient-to-r from-[#FB923C] to-[#FACC15] text-black font-extrabold shadow-[0_0_18px_rgba(251,146,60,0.6)]'
                      : 'text-[#94A3B8] hover:text-[#FFFFFF] hover:bg-white/10'
                  }`}
                  type="button"
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================
            STAGE 1: 3D REAL SATELLITE INDIAN MAP & CAPITAL CITIES (FEATURE 1)
            ============================================================ */}
        <div id="satellite-map" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#00FF88] animate-ping" />
              <h3 className="text-xs font-mono font-black uppercase tracking-widest text-[#00FF88]">
                FEATURE 01 &bull; 3D REAL SATELLITE INDIAN MAP &amp; ORBITAL TELEMETRY COMMAND
              </h3>
            </div>
            <span className="text-xs font-mono text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 px-3 py-1 rounded-full font-bold">
              PAGE 1 OF 5 ACTIVE
            </span>
          </div>

          <IndiaSatelliteMap
            selectedMine={selectedMine}
            onSelectMine={(m) => setSelectedMine(m)}
            activeLayer={activeLayer}
            onChangeLayer={(l) => setActiveLayer(l)}
          />
        </div>

        {/* ============================================================
            DEDICATED 5-PAGE FEATURE MODULE LAUNCHER GRID
            ============================================================ */}
        <div className="pt-8 border-t border-white/10 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono text-[#00FF88] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/30">
              EXPLORE DEDICATED FEATURE PAGES (PAGES 2 - 5)
            </span>
            <h3 className="text-2xl font-bold font-space text-white">
              Launch Dedicated Platform Modules
            </h3>
            <p className="text-xs text-slate-300">
              Each core intelligence component operates on its own dedicated full-screen page view. Click any button below to open that page directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Page 2: ML Architecture */}
            <div className="ios-glass-card p-6 rounded-3xl backdrop-blur-2xl bg-[#081022]/70 border border-[#FB923C]/50 hover:border-[#FB923C] shadow-[0_0_30px_rgba(251,146,60,0.2)] hover:shadow-[0_0_50px_rgba(251,146,60,0.45)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-gradient-to-br from-[#FF5E00]/30 via-[#FB923C]/20 to-transparent blur-3xl pointer-events-none group-hover:scale-125 transition-all duration-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-black text-[#FB923C] bg-gradient-to-r from-[#FF5E00]/20 to-[#FACC15]/20 border border-[#FB923C]/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(251,146,60,0.3)]">
                    PAGE 2 &bull; FEATURE 02
                  </span>
                  <Cpu size={22} className="text-[#FB923C] drop-shadow-[0_0_12px_#FB923C]" />
                </div>
                <h4 className="text-xl font-bold font-space text-white group-hover:text-[#FB923C] transition-colors mb-2">
                  ML Pipeline &amp; Studio
                </h4>
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6 font-normal">
                  Architecture flow and the prospectivity model card — leave-one-mine-out validation with its confidence interval. Training runs offline; there is no in-browser training.
                </p>
              </div>
              <Link
                href="/evaluator"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5E00]/25 via-[#FB923C]/20 to-[#FACC15]/25 hover:from-[#FF5E00]/40 hover:to-[#FACC15]/40 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all duration-300 cursor-pointer border border-[#FB923C]/60 hover:border-[#FACC15] shadow-[0_0_18px_rgba(251,146,60,0.25)] hover:shadow-[0_0_30px_rgba(251,146,60,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98] group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="flex items-center gap-2 font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]">
                  OPEN PAGE 2 &rarr;
                </span>
                <div className="w-6 h-6 rounded-lg bg-[#FB923C]/20 backdrop-blur-md flex items-center justify-center text-[#FB923C] border border-[#FB923C]/40 group-hover/btn:scale-110 transition-transform">
                  <Sparkles size={12} className="animate-pulse text-[#FB923C]" />
                </div>
              </Link>
            </div>

            {/* Page 3: Mine Twin */}
            <div className="ios-glass-card p-6 rounded-3xl backdrop-blur-2xl bg-[#081022]/70 border border-[#00FF88]/50 hover:border-[#00FF88] shadow-[0_0_30px_rgba(0,255,136,0.2)] hover:shadow-[0_0_50px_rgba(0,255,136,0.45)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-gradient-to-br from-[#00FF88]/30 via-[#00E5FF]/20 to-transparent blur-3xl pointer-events-none group-hover:scale-125 transition-all duration-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-black text-[#00FF88] bg-gradient-to-r from-[#00FF88]/20 to-[#00E5FF]/20 border border-[#00FF88]/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                    PAGE 3 &bull; FEATURE 03
                  </span>
                  <Box size={22} className="text-[#00FF88] drop-shadow-[0_0_12px_#00FF88]" />
                </div>
                <h4 className="text-xl font-bold font-space text-white group-hover:text-[#00FF88] transition-colors mb-2">
                  Mine Twin Simulator
                </h4>
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6 font-normal">
                  Interactive operational Digital Twin with what-if scenario sliders for haulage, rainfall, and shovel rate.
                </p>
              </div>
              <Link
                href="/mine-twin"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00FF88]/25 via-[#00E5FF]/20 to-[#38BDF8]/25 hover:from-[#00FF88]/40 hover:to-[#38BDF8]/40 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all duration-300 cursor-pointer border border-[#00FF88]/60 hover:border-[#00E5FF] shadow-[0_0_18px_rgba(0,255,136,0.25)] hover:shadow-[0_0_30px_rgba(0,255,136,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98] group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="flex items-center gap-2 font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(0,255,136,0.6)]">
                  OPEN PAGE 3 &rarr;
                </span>
                <div className="w-6 h-6 rounded-lg bg-[#00FF88]/20 backdrop-blur-md flex items-center justify-center text-[#00FF88] border border-[#00FF88]/40 group-hover/btn:scale-110 transition-transform">
                  <Sparkles size={12} className="animate-pulse text-[#00FF88]" />
                </div>
              </Link>
            </div>

            {/* Page 4: Production Sentinel */}
            <div className="ios-glass-card p-6 rounded-3xl backdrop-blur-2xl bg-[#081022]/70 border border-[#38BDF8]/50 hover:border-[#38BDF8] shadow-[0_0_30px_rgba(56,189,248,0.2)] hover:shadow-[0_0_50px_rgba(56,189,248,0.45)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-gradient-to-br from-[#38BDF8]/30 via-[#818CF8]/20 to-transparent blur-3xl pointer-events-none group-hover:scale-125 transition-all duration-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-black text-[#38BDF8] bg-gradient-to-r from-[#38BDF8]/20 to-[#A855F7]/20 border border-[#38BDF8]/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.3)]">
                    PAGE 4 &bull; FEATURE 04
                  </span>
                  <Activity size={22} className="text-[#38BDF8] drop-shadow-[0_0_12px_#38BDF8]" />
                </div>
                <h4 className="text-xl font-bold font-space text-white group-hover:text-[#38BDF8] transition-colors mb-1.5">
                  Production Sentinel
                </h4>
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold text-[#00E5FF] bg-[#00E5FF]/15 border border-[#00E5FF]/40 px-2.5 py-0.5 rounded-full">
                    NEW: Early Flood Warning &amp; Auto-Pumps
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6 font-normal">
                  ISRO rain radar 30-min cloudburst predictor, automated SCADA pump control, and extraction velocity meters.
                </p>
              </div>
              <Link
                href="/production"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#38BDF8]/25 via-[#818CF8]/20 to-[#A855F7]/25 hover:from-[#38BDF8]/40 hover:to-[#A855F7]/40 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all duration-300 cursor-pointer border border-[#38BDF8]/60 hover:border-[#A855F7] shadow-[0_0_18px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98] group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="flex items-center gap-2 font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]">
                  OPEN PAGE 4 &rarr;
                </span>
                <div className="w-6 h-6 rounded-lg bg-[#38BDF8]/20 backdrop-blur-md flex items-center justify-center text-[#38BDF8] border border-[#38BDF8]/40 group-hover/btn:scale-110 transition-transform">
                  <Sparkles size={12} className="animate-pulse text-[#38BDF8]" />
                </div>
              </Link>
            </div>

            {/* Page 5: Ore Blending */}
            <div className="ios-glass-card p-6 rounded-3xl backdrop-blur-2xl bg-[#081022]/70 border border-[#FF2E63]/50 hover:border-[#FF2E63] shadow-[0_0_30px_rgba(255,46,99,0.2)] hover:shadow-[0_0_50px_rgba(255,46,99,0.45)] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-gradient-to-br from-[#FACC15]/30 via-[#FF2E63]/30 to-transparent blur-3xl pointer-events-none group-hover:scale-125 transition-all duration-500" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-black text-[#FF2E63] bg-gradient-to-r from-[#FACC15]/20 to-[#FF2E63]/20 border border-[#FF2E63]/50 px-3 py-1 rounded-full shadow-[0_0_12px_rgba(255,46,99,0.3)]">
                    PAGE 5 &bull; FEATURE 05
                  </span>
                  <Layers size={22} className="text-[#FF2E63] drop-shadow-[0_0_12px_#FF2E63]" />
                </div>
                <h4 className="text-xl font-bold font-space text-white group-hover:text-[#FF2E63] transition-colors mb-2">
                  Ore Blending &amp; Risk
                </h4>
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6 font-normal">
                  Simplex LP grade ratio optimizer for manganese chemistry specifications paired with operational risk cockpit.
                </p>
              </div>
              <Link
                href="/blending"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FACC15]/25 via-[#FF2E63]/25 to-[#990022]/30 hover:from-[#FACC15]/40 hover:to-[#FF2E63]/50 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all duration-300 cursor-pointer border border-[#FF2E63]/60 hover:border-[#FF80AB] shadow-[0_0_18px_rgba(255,46,99,0.25)] hover:shadow-[0_0_30px_rgba(255,46,99,0.6)] backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98] group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <span className="flex items-center gap-2 font-black tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,46,99,0.6)]">
                  OPEN PAGE 5 &rarr;
                </span>
                <div className="w-6 h-6 rounded-lg bg-[#FF2E63]/20 backdrop-blur-md flex items-center justify-center text-[#FF2E63] border border-[#FF2E63]/40 group-hover/btn:scale-110 transition-transform">
                  <Sparkles size={12} className="animate-pulse text-[#FF2E63]" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ============================================================
            EXECUTIVE FOOTER (Light Liquid Glass)
            ============================================================ */}
        <div className="ios-glass-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00FF88]" />
            <span>
              Decision-Support Prototype &bull; MOIL Limited &bull; Ministry of Steel &bull; Smart India Hackathon 2026
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#00FF88] animate-pulse" />
              Live Stream Sync: <span className="text-[#00FF88] font-bold" suppressHydrationWarning>{lastSyncTime} IST</span>
            </div>
            <Link
              href="/about"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#FF2E63]/20 to-[#38BDF8]/20 border border-[#FF2E63]/40 text-white hover:text-[#FF2E63] text-[11px] font-bold transition-all shadow-[0_0_10px_rgba(255,46,99,0.2)]"
            >
              <Sparkles size={12} className="text-[#FF2E63]" />
              <span>About Problem Statement</span>
            </Link>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-[#38BDF8]/15 border border-white/10 hover:border-[#38BDF8]/40 text-[#94A3B8] hover:text-[#38BDF8] text-[11px] transition-all"
            >
              <Lock size={12} className="text-[#38BDF8]" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive AI Sentinel Copilot Launcher */}
      <AICopilotModal mine={selectedMine} />
    </section>
  )
}
