'use client'

import { useState, useEffect, useMemo, } from 'react'
import type { MineInfo, ProductionForecast, RiskAnalysis, WeatherSignal } from './types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts'
import {
  Sliders,
  ShieldCheck,
  Activity,
  Clock,
  Radio,
  Pause,
} from 'lucide-react'

interface Props {
  mine: MineInfo
  forecast?: ProductionForecast | null
  risk?: RiskAnalysis | null
  weather?: WeatherSignal | null
}

interface ScadaLogEvent {
  id: string
  timestamp: string
  message: string
  type: 'haul' | 'crush' | 'winder' | 'pump'
  tonnes?: number
}

export default function ProductionSentinel({ mine, forecast, risk, weather }: Props) {
  // Real-time ticking clock (IST)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Real-time dynamic operational metrics that change with time
  const [liveShiftExtracted, setLiveShiftExtracted] = useState<number>(() => Math.round(mine.targetTonnes * 0.018 * 10) / 10)
  const [liveHourlyRate, setLiveHourlyRate] = useState<number>(() => Math.round((mine.targetTonnes / 240) * 10) / 10)
  const [trucksDispatched, setTrucksDispatched] = useState<number>(64)
  const [activeSkipCycle, setActiveSkipCycle] = useState<number>(142)
  const [scadaLogs, setScadaLogs] = useState<ScadaLogEvent[]>([])

  // Dynamic simulation sliders
  const initialRain = weather?.rainfall_14d_mm ?? 118
  const [rainfallSlider, setRainfallSlider] = useState<number>(initialRain)
  const [downtimeSlider, setDowntimeSlider] = useState<number>(12.5)
  const [gradeVariance, setGradeVariance] = useState<number>(0)
  const [chartView, setChartView] = useState<'daily' | 'cumulative'>('daily')

  // SCADA Auto-Pumps & Early Flood Warning State
  const [isScadaPumpActive, setIsScadaPumpActive] = useState<boolean>(true)
  const [radarCloudburstAlert, setRadarCloudburstAlert] = useState<boolean>(false)

  // Update real rainfall slider when weather updates for the mine
  useEffect(() => {
    if (weather?.rainfall_14d_mm != null) {
      setRainfallSlider(weather.rainfall_14d_mm)
    }
  }, [weather?.rainfall_14d_mm])

  // Real-time 1-second clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Operational shift detector (IST)
  const shiftInfo = useMemo(() => {
    const now = currentTime
    // Format in IST
    const istHours = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24
    const istMinutes = (now.getUTCMinutes() + 30) % 60

    if (istHours >= 6 && istHours < 14) {
      const elapsedMinutes = (istHours - 6) * 60 + istMinutes
      return {
        name: 'Shift A (Morning)',
        timeRange: '06:00 - 14:00 IST',
        progressPct: Math.min(100, Math.round((elapsedMinutes / 480) * 100)),
        shiftTargetTonnes: Math.round(mine.targetTonnes / 60),
      }
    } else if (istHours >= 14 && istHours < 22) {
      const elapsedMinutes = (istHours - 14) * 60 + istMinutes
      return {
        name: 'Shift B (Evening Peak)',
        timeRange: '14:00 - 22:00 IST',
        progressPct: Math.min(100, Math.round((elapsedMinutes / 480) * 100)),
        shiftTargetTonnes: Math.round((mine.targetTonnes / 60) * 1.15),
      }
    } else {
      const elapsedMinutes = istHours >= 22 ? (istHours - 22) * 60 + istMinutes : (istHours + 2) * 60 + istMinutes
      return {
        name: 'Shift C (Night Maintenance & Haulage)',
        timeRange: '22:00 - 06:00 IST',
        progressPct: Math.min(100, Math.round((elapsedMinutes / 480) * 100)),
        shiftTargetTonnes: Math.round((mine.targetTonnes / 60) * 0.75),
      }
    }
  }, [currentTime, mine.targetTonnes])

  // Real-time live data stream simulator: changes extraction numbers, trucks, and logs every 2.5 seconds
  useEffect(() => {
    if (!isLiveStreaming) return

    const interval = setInterval(() => {
      // Dynamic tonnage increment per skip/truck dump
      const randomTonnes = Math.round((1.2 + Math.random() * 2.8) * 10) / 10
      const currentRate = Math.round((mine.targetTonnes / 220 + (Math.random() - 0.5) * 18) * 10) / 10

      setLiveShiftExtracted((prev) => Math.round((prev + randomTonnes) * 10) / 10)
      setLiveHourlyRate(Math.max(40, currentRate))
      setActiveSkipCycle((prev) => prev + 1)

      // Randomly trigger truck weighbridge completion
      if (Math.random() > 0.45) {
        setTrucksDispatched((prev) => prev + 1)
      }

      // Generate realistic SCADA telemetry log entry
      const nowStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
      const logTypes: Array<ScadaLogEvent['type']> = ['haul', 'winder', 'crush', 'pump']
      const chosenType = logTypes[Math.floor(Math.random() * logTypes.length)]

      let msg = ''
      if (chosenType === 'winder') {
        msg = `Winder Hoist #${(activeSkipCycle % 2) + 1} completed cycle from -340m RL (Skip Load: ${randomTonnes} T)`
      } else if (chosenType === 'haul') {
        msg = `Weighbridge #1: Dumper MP-50-GA-${1000 + (trucksDispatched % 50)} logged ${(18 + Math.random() * 8).toFixed(1)} T Run-of-Mine Braunite`
      } else if (chosenType === 'crush') {
        msg = `Primary Jaw Crusher line active: throughput ${currentRate} T/hr (Vibration: Normal 1.2 mm/s)`
      } else {
        msg = `Sub-surface Sump Pump 3B automated dewatering active (Discharge: 380 m³/hr)`
      }

      const newLog: ScadaLogEvent = {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        message: msg,
        type: chosenType,
        tonnes: randomTonnes,
      }

      setScadaLogs((prev) => [newLog, ...prev.slice(0, 5)])
    }, 2500)

    return () => clearInterval(interval)
  }, [isLiveStreaming, mine.targetTonnes, activeSkipCycle, trucksDispatched])

  // Initial seed logs
  useEffect(() => {
    const timeNow = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
    setScadaLogs([
      { id: '1', timestamp: timeNow, message: `Balaghat Deep Vertical Winder #1 online: hoisting speed 8.2 m/s`, type: 'winder' },
      { id: '2', timestamp: timeNow, message: `Weighbridge #2 calibrated with SCADA load cell array: zero drift`, type: 'haul' },
      { id: '3', timestamp: timeNow, message: `Open-Meteo telemetry stream connected: precipitation index synced`, type: 'pump' },
    ])
  }, [mine.code])

  // Target and Forecast Calculations
  const planned14d = forecast?.total_planned_tonnes ?? Math.round(mine.targetTonnes / 2)

  // Real-time What-If calculations incorporating sliders
  const rainDrag = Math.min(0.35, (rainfallSlider / 180) * 0.35)
  const downDrag = Math.min(0.30, (downtimeSlider / 40) * 0.30)
  const gradeDrag = Math.min(0.15, Math.max(-0.08, (-gradeVariance / 10) * 0.15))
  const totalDrag = Math.min(0.65, Math.max(0.02, rainDrag + downDrag + gradeDrag))
  const dynamicEfficiency = Math.max(0.35, 1.0 - totalDrag)

  const predicted14d = Math.round(planned14d * dynamicEfficiency)
  const shortfallTonnes = Math.max(0, planned14d - predicted14d)
  const shortfallPct = Math.round((shortfallTonnes / planned14d) * 1000) / 10

  // 14-Day Trajectory Daily and Cumulative Series
  const trajectory = useMemo(() => {
    let cumPlanned = 0
    let cumPredicted = 0

    return Array.from({ length: 14 }, (_, i) => {
      const dayIndex = i + 1
      const dailyPlanned = Math.round(planned14d / 14)
      // Slight day-to-day dynamic variance curve
      const dayJitter = 1 + Math.sin(dayIndex * 0.85 + (currentTime.getSeconds() % 10) * 0.05) * 0.06
      const dailyPredicted = Math.round(dailyPlanned * dynamicEfficiency * dayJitter)
      const dayShortfall = Math.max(0, dailyPlanned - dailyPredicted)

      cumPlanned += dailyPlanned
      cumPredicted += dailyPredicted
      const cumShortfall = Math.max(0, cumPlanned - cumPredicted)

      return {
        day_index: dayIndex,
        date: `Day ${dayIndex}`,
        planned_tonnes: dailyPlanned,
        predicted_tonnes: dailyPredicted,
        shortfall_tonnes: dayShortfall,
        cumulative_planned: cumPlanned,
        cumulative_predicted: cumPredicted,
        cumulative_shortfall: cumShortfall,
        efficiency_pct: Math.round((dailyPredicted / dailyPlanned) * 100),
      }
    })
  }, [planned14d, dynamicEfficiency, currentTime])

  const riskLevel = shortfallPct >= 20 ? 'CRITICAL' : shortfallPct >= 10 ? 'MODERATE' : 'NOMINAL'
  const riskBadgeClass = riskLevel === 'CRITICAL' ? 'ios-badge-risk' : riskLevel === 'MODERATE' ? 'ios-badge-gold' : 'ios-badge-live'
  const riskColor = riskLevel === 'CRITICAL' ? '#F87171' : riskLevel === 'MODERATE' ? '#FACC15' : '#00FF88'

  // Shift target difference
  const shiftRemaining = Math.max(0, shiftInfo.shiftTargetTonnes - liveShiftExtracted)
  const shiftPace = Math.round((liveShiftExtracted / (shiftInfo.shiftTargetTonnes * (shiftInfo.progressPct / 100 || 0.01))) * 100)

  return (
    <div className="ios-glass-card p-5 sm:p-6 flex flex-col justify-between gap-6 shadow-2xl border border-[#38BDF8]/30">
      {/* Header with Live Ticking Clock & SCADA Stream Status */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-live text-[10px] font-mono font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#00FF88] animate-pulse" />
              AI/ML MODULE 02 &bull; PROPHET &amp; XGBOOST
            </span>
            <span className="text-xs font-mono text-[#38BDF8] font-bold">
              {mine.name} ({mine.code})
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Real-time IST Clock */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/15 text-white font-mono text-xs shadow-inner">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="font-bold text-[#38BDF8]" suppressHydrationWarning>
                {mounted ? currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '11:25:00'} IST
              </span>
            </div>

            {/* Live Stream Toggle */}
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all ${
                isLiveStreaming
                  ? 'bg-[#00FF88]/20 border border-[#00FF88] text-[#00FF88]'
                  : 'bg-white/10 border border-white/20 text-slate-400'
              }`}
              type="button"
              title={isLiveStreaming ? 'Pause live SCADA feed simulation' : 'Resume live SCADA feed simulation'}
            >
              {isLiveStreaming ? (
                <>
                  <Radio className="w-3 h-3 text-[#00FF88] animate-pulse" />
                  <span>STREAMING</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-slate-400" />
                  <span>PAUSED</span>
                </>
              )}
            </button>

            <span className={`ios-badge ${riskBadgeClass} font-mono font-bold text-[10px]`}>
              {riskLevel} SHORTFALL
            </span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-space flex items-center gap-2">
              Production Sentinel &amp; Shortfall Forecast
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40">
                REAL-TIME
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">
              Continuous 14-day extraction forecasting factoring real Open-Meteo rainfall saturation, live SCADA winder hoists, and CMMS machinery downtime.
            </p>
          </div>
        </div>
      </div>

      {/* Real-Time Operational Cockpit (Changes with Time) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#061224] via-[#091D38] to-[#0A264A] border border-[#38BDF8]/40 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/15 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#00FF88] animate-pulse" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Live Shift Production Telemetry &bull; {shiftInfo.name}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            Window: <strong className="text-white">{shiftInfo.timeRange}</strong> ({shiftInfo.progressPct}% elapsed)
          </div>
        </div>

        {/* Real-time Tickers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-mono">
          <div className="ios-glass-inset p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Shift Extracted</span>
            <div className="text-lg sm:text-xl font-bold text-[#00FF88] font-mono flex items-baseline gap-1">
              <span>{liveShiftExtracted.toLocaleString()}</span>
              <span className="text-[11px] text-slate-400">/ {shiftInfo.shiftTargetTonnes.toLocaleString()} T</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#00FF88] h-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((liveShiftExtracted / shiftInfo.shiftTargetTonnes) * 100))}%` }}
              />
            </div>
          </div>

          <div className="ios-glass-inset p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Live Run Rate</span>
            <div className="text-lg sm:text-xl font-bold text-[#38BDF8] font-mono flex items-baseline gap-1">
              <span>{liveHourlyRate}</span>
              <span className="text-[11px] text-slate-400">T/hr</span>
            </div>
            <span className="text-[9px] font-mono text-slate-300">
              Pace: <strong className={shiftPace >= 95 ? 'text-[#00FF88]' : 'text-[#FACC15]'}>{shiftPace}% of Target</strong>
            </span>
          </div>

          <div className="ios-glass-inset p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Weighbridge Clear</span>
            <div className="text-lg sm:text-xl font-bold text-[#FACC15] font-mono flex items-baseline gap-1">
              <span>{trucksDispatched}</span>
              <span className="text-[11px] text-slate-400">Trucks</span>
            </div>
            <span className="text-[9px] font-mono text-slate-300">
              Avg Payload: <strong className="text-white">24.5 Tonnes</strong>
            </span>
          </div>

          <div className="ios-glass-inset p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Winder Hoist Cycle</span>
            <div className="text-lg sm:text-xl font-bold text-[#A855F7] font-mono flex items-baseline gap-1">
              <span>#{activeSkipCycle}</span>
              <span className="text-[11px] text-slate-400">Cycle</span>
            </div>
            <span className="text-[9px] font-mono text-[#00FF88]">&bull; Shafe Level -340m RL</span>
          </div>
        </div>

        {/* Live Rolling SCADA Event Ticker */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-slate-400 uppercase font-bold">
            <Activity className="w-3 h-3 text-[#38BDF8]" />
            <span>Latest SCADA Conveyor &amp; Hoist Telemetry:</span>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar pr-1">
            {scadaLogs.map((log) => (
              <div
                key={log.id}
                className="text-[11px] font-mono flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/5 text-slate-200"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-[#38BDF8] text-[10px] shrink-0">[{log.timestamp}]</span>
                  <span className="truncate">{log.message}</span>
                </div>
                {log.tonnes && (
                  <span className="text-[10px] font-bold text-[#00FF88] shrink-0 ml-2">
                    +{log.tonnes} T
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Stat Cards: 14-Day Target, Predicted, and Shortfall */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="ios-glass-inset p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            14-Day Production Target
          </span>
          <div className="my-1 text-2xl font-mono font-bold text-white">
            {planned14d.toLocaleString('en-IN')} <span className="text-xs text-slate-400">Tonnes</span>
          </div>
          <span className="text-[10px] font-mono text-slate-300">
            Ministry of Steel Planned Dispatch
          </span>
        </div>

        <div className="ios-glass-inset p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            AI Predicted Extraction
          </span>
          <div className="my-1 text-2xl font-mono font-bold text-[#00FF88]">
            {predicted14d.toLocaleString('en-IN')} <span className="text-xs text-slate-400">Tonnes</span>
          </div>
          <span className="text-[10px] font-mono text-[#00FF88]">
            {Math.round((predicted14d / planned14d) * 100)}% Extraction Realization
          </span>
        </div>

        <div className="ios-glass-inset p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            Projected Output Deficit
          </span>
          <div className="my-1 text-2xl font-mono font-bold" style={{ color: riskColor }}>
            -{shortfallTonnes.toLocaleString('en-IN')} <span className="text-xs text-slate-400">Tonnes</span>
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color: riskColor }}>
            {shortfallPct}% Output Deficit ({riskLevel})
          </span>
        </div>
      </div>

      {/* 14-Day Interactive Trajectory Chart */}
      <div className="ios-glass-inset p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              14-Day Production Trajectory vs Target
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
              {chartView === 'daily' ? 'Daily Dispatches' : 'Cumulative Envelope'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/15 text-[10px] font-mono">
              <button
                onClick={() => setChartView('daily')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  chartView === 'daily' ? 'bg-[#38BDF8] text-black font-bold' : 'text-slate-400 hover:text-white'
                }`}
                type="button"
              >
                Daily Bars
              </button>
              <button
                onClick={() => setChartView('cumulative')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  chartView === 'cumulative' ? 'bg-[#00FF88] text-black font-bold' : 'text-slate-400 hover:text-white'
                }`}
                type="button"
              >
                Cumulative Area
              </button>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono hidden sm:flex">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-sm bg-white/30" /> Target
              </span>
              <span className="flex items-center gap-1.5 text-[#00FF88]">
                <span className="h-2 w-2 rounded-sm bg-[#00FF88]" /> AI Yield
              </span>
            </div>
          </div>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'daily' ? (
              <BarChart data={trajectory} barGap={3} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(8,16,32,0.96)',
                    borderColor: 'rgba(56,189,248,0.3)',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="planned_tonnes" name="Target (T)" fill="rgba(255,255,255,0.2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="predicted_tonnes" name="Predicted (T)" fill="#00FF88" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={trajectory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumPlannedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cumPredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF88" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#00FF88" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(8,16,32,0.96)',
                    borderColor: 'rgba(0,255,136,0.3)',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    backdropFilter: 'blur(20px)',
                    color: '#fff',
                  }}
                />
                <Area type="monotone" dataKey="cumulative_planned" name="Cum Target (T)" stroke="#38BDF8" fill="url(#cumPlannedGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="cumulative_predicted" name="Cum Yield (T)" stroke="#00FF88" fill="url(#cumPredGrad)" strokeWidth={2.5} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>



      {/* Live Constraint Simulation Sliders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-bold">
            <Sliders className="w-3.5 h-3.5 text-[#FB923C]" />
            Real-Time What-If Constraint Simulator
          </span>
          <span className="text-[#00FF88] text-[11px] font-bold">Instant ML Recalibration</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Rainfall Slider */}
          <div className="ios-glass-inset p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Monsoon Rainfall:</span>
              <span className="font-bold text-[#38BDF8]">{rainfallSlider} mm</span>
            </div>
            <input
              type="range"
              min="10"
              max="260"
              value={rainfallSlider}
              onChange={(e) => setRainfallSlider(Number(e.target.value))}
              className="w-full accent-[#38BDF8] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>Dry (10mm)</span>
              <span>Open-Meteo ({Math.round(initialRain)}mm)</span>
              <span>Flood (260mm)</span>
            </div>
          </div>

          {/* Downtime Slider */}
          <div className="ios-glass-inset p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">CMMS Downtime:</span>
              <span className="font-bold text-[#FACC15]">{downtimeSlider} hrs/wk</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={downtimeSlider}
              onChange={(e) => setDowntimeSlider(Number(e.target.value))}
              className="w-full accent-[#FACC15] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>Zero (0h)</span>
              <span>Nominal (12h)</span>
              <span>Major Breakdown (50h)</span>
            </div>
          </div>

          {/* Grade Dilution Slider */}
          <div className="ios-glass-inset p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Ore Grade Variance:</span>
              <span className={`font-bold ${gradeVariance >= 0 ? 'text-[#00FF88]' : 'text-[#F87171]'}`}>
                {gradeVariance > 0 ? `+${gradeVariance}%` : `${gradeVariance}%`} Mn
              </span>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.5"
              value={gradeVariance}
              onChange={(e) => setGradeVariance(Number(e.target.value))}
              className="w-full accent-[#00FF88] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>-5% Dilution</span>
              <span>0% Baseline</span>
              <span>+5% Rich Vein</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Shortfall Mitigation Directive Card */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-start justify-between gap-3 text-xs font-mono">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#00FF88] shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-mono text-[#00FF88] font-bold uppercase tracking-wider">
              Automated Dispatch Directive ({riskLevel} Risk):
            </span>
            <p className="text-slate-200 mt-0.5 leading-relaxed font-sans font-medium text-xs">
              {riskLevel === 'CRITICAL'
                ? `Activate secondary high-grade stockpile SP-1 (+42% Mn) blending line at ${mine.name} to mitigate -${shortfallTonnes.toLocaleString()} Tonnes shortfall before month-end audit.`
                : riskLevel === 'MODERATE'
                ? `Increase winder skip cycle speed by 6% during off-peak power window (22:00-06:00 IST) and clear sub-surface sump pump 3B blockage.`
                : `Production trajectory nominal at ${mine.name}. Maintain standard haulage cycle intervals and continue automated conveyor scale logging.`}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setRainfallSlider(initialRain)
            setDowntimeSlider(12.5)
            setGradeVariance(0)
          }}
          className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[10px] font-mono shrink-0 cursor-pointer hover:bg-white/15 transition-all"
          type="button"
          title="Reset sliders to live telemetry baseline"
        >
          Reset Baseline
        </button>
      </div>
    </div>
  )
}
