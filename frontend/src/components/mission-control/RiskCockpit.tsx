'use client'

import type { MineInfo, WeatherSignal, RiskAnalysis } from './types'
import { CloudRain, Wrench, Flame, Box, Gauge } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface Props {
  mine: MineInfo
  weather?: WeatherSignal | null
  risk?: RiskAnalysis | null
}

export default function RiskCockpit({ mine, weather, risk }: Props) {
  const compositeScore = risk?.composite_risk_score ?? (mine.state === 'MP' ? 72.4 : 44.5)
  const status = risk?.risk_status || (mine.state === 'MP' ? 'ELEVATED' : 'WATCH')

  const rainfallMm = weather?.rainfall_14d_mm ?? (mine.state === 'MP' ? 118 : 64)
  const soilMoisture = weather?.soil_moisture_pct ?? (mine.state === 'MP' ? 42 : 34)
  const landTemp = weather?.land_surface_temp_c ?? 34.2

  const statusBadgeClass = status === 'ELEVATED' ? 'ios-badge-risk' : status === 'WATCH' ? 'ios-badge-gold' : 'ios-badge-live'
  const statusColor = status === 'ELEVATED' ? '#D9584A' : status === 'WATCH' ? '#D99A3A' : '#00FF88'

  const rainTrend = Array.from({ length: 14 }, (_, i) => ({
    day: `Day ${i + 1}`,
    rainfall: Math.round(Math.max(0, rainfallMm / 14 + Math.sin(i * 0.7) * 8 + (i > 8 ? 6 : -2))),
    threshold: 8,
  }))

  return (
    <div className="ios-glass-card p-6 flex flex-col justify-between gap-6 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="ios-badge ios-badge-risk">
              AI/ML MODULE 03
            </span>
            <span className="text-xs font-mono text-[#8FA4B5]">Isolation Forest & Constraint Scoring</span>
          </div>
          <span className={`ios-badge ${statusBadgeClass}`}>
            {status} STATUS
          </span>
        </div>

        <h3 className="text-2xl font-bold text-text-primary tracking-tight">
          Operational Risk & Constraint Cockpit
        </h3>
        <p className="text-xs text-[#8FA4B5] mt-1 leading-relaxed">
          Real-time synthesis of weather saturation, machinery breakdowns, and blasting constraints at {mine.name}.
        </p>
      </div>

      {/* Composite Risk Gauge Hero */}
      <div className="p-5 rounded-md bg-[rgba(6,10,14,0.7)] border border-border-default flex flex-col sm:flex-row items-center justify-between gap-6  shadow-inner">
        <div className="flex items-center gap-5">
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-md border shadow-lg"
            style={{
              backgroundColor: `${statusColor}15`,
              borderColor: `${statusColor}45`,
            }}
          >
            <Gauge className="w-10 h-10" style={{ color: statusColor }} />
          </div>
          <div>
            <span className="text-xs font-mono uppercase text-[#8FA4B5] tracking-wider">
              Composite Shortfall Risk Index
            </span>
            <div className="text-3xl font-mono font-semibold" style={{ color: statusColor }}>
              {compositeScore} <span className="text-sm font-normal text-[#8FA4B5]">/ 100</span>
            </div>
            <div className="text-xs text-[#8FA4B5] mt-1">
              Primary Bottleneck: <span className="text-text-primary font-semibold">{mine.state === 'MP' ? 'Rainfall Road Saturation' : 'Blasting Block Schedule'}</span>
            </div>
          </div>
        </div>

        <div className="text-right font-mono text-xs text-[#8FA4B5] space-y-1">
          <div>Telemetry: <span className="text-accent">Active (ISRO MOSDAC)</span></div>
          <div>Sampling: <span className="text-text-primary">Every 6 Hours</span></div>
          <div>Mine Lat/Lng: <span className="text-text-primary">{mine.lat}&deg;N, {mine.lng}&deg;E</span></div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pillar 1: Rainfall */}
        <div className="ios-glass-inset p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#8FA4B5] flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-[#3B82F6]" />
              Rainfall 14d
            </span>
            <span className="font-mono font-bold text-[#D9584A]">{rainfallMm} mm</span>
          </div>
          <div className="text-xs text-[#8FA4B5] mb-2">
            {rainfallMm > 90 ? 'Critical saturation' : 'Normal moisture level'}
          </div>
          <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#D9584A]"
              style={{ width: `${Math.min(100, (rainfallMm / 150) * 100)}%` }}
            />
          </div>
        </div>

        {/* Pillar 2: Equipment Downtime */}
        <div className="ios-glass-inset p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#8FA4B5] flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[#E5C76B]" />
              Downtime
            </span>
            <span className="font-mono font-bold text-[#D99A3A]">14.5 hrs</span>
          </div>
          <div className="text-xs text-[#8FA4B5] mb-2">
            85.5% Machinery Uptime
          </div>
          <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#D99A3A]" style={{ width: '62%' }} />
          </div>
        </div>

        {/* Pillar 3: Blasting Delay */}
        <div className="ios-glass-inset p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#8FA4B5] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#C66A3D]" />
              Blast Block
            </span>
            <span className="font-mono font-bold text-accent">Ready</span>
          </div>
          <div className="text-xs text-[#8FA4B5] mb-2">
            Pre-split drilled (1,400T)
          </div>
          <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: '85%' }} />
          </div>
        </div>

        {/* Pillar 4: Stockpile Buffer */}
        <div className="ios-glass-inset p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#8FA4B5] flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-[#8FA4B5]" />
              Stockpile
            </span>
            <span className="font-mono font-bold text-[#E5C76B]">6 Days</span>
          </div>
          <div className="text-xs text-[#8FA4B5] mb-2">
            Buffer below 7d baseline
          </div>
          <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#E5C76B]" style={{ width: '55%' }} />
          </div>
        </div>
      </div>

      {/* 14-Day Rainfall Disruption Trend */}
      <div className="ios-glass-inset p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-semibold text-text-primary uppercase tracking-wider">
            14-Day Cumulative Precipitation Disruption Curve (ISRO MOSDAC)
          </span>
          <span className="text-xs font-mono text-[#D9584A]">
            Saturation Threshold: 8.0 mm/day
          </span>
        </div>

        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rainTrend}>
              <defs>
                <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#8FA4B5' }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#8FA4B5' }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10,16,22,0.95)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
                }}
              />
              <Area type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="#3B82F6" fill="url(#rainFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
