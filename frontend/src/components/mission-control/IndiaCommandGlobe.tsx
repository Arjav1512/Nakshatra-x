'use client'

import { useRef, useEffect } from 'react'
import type { MineInfo } from './types'
import { MOIL_MINES } from './data'
import { Layers, MapPin } from 'lucide-react'

interface Props {
  selectedMine: MineInfo
  onSelectMine: (mine: MineInfo) => void
  activeLayer: 'ndvi' | 'moisture' | 'thermal' | 'geology'
  onChangeLayer: (layer: 'ndvi' | 'moisture' | 'thermal' | 'geology') => void
  timeHorizon: 'realtime' | '7d' | '14d' | '30d'
  onChangeTimeHorizon: (horizon: 'realtime' | '7d' | '14d' | '30d') => void
}

export default function IndiaCommandGlobe({
  selectedMine,
  onSelectMine,
  activeLayer,
  onChangeLayer,
  timeHorizon,
  onChangeTimeHorizon,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 3D Canvas Animation for Central & Western India Manganese Belt
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let angle = 0

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const radius = Math.min(cx, cy) * 0.75

      // Draw Globe Base Atmosphere
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.1)
      gradient.addColorStop(0, '#0A1218')
      gradient.addColorStop(0.7, '#070A0D')
      gradient.addColorStop(1, '#050607')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      // Atmospheric Glow Outer Ring
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
      ctx.stroke()

      // Draw Coordinate Grid Lines (Latitude / Longitude arcs)
      ctx.strokeStyle = 'rgba(186, 214, 221, 0.08)'
      ctx.lineWidth = 1

      for (let lat = -60; lat <= 60; lat += 30) {
        const y = cy + (lat / 90) * radius * 0.85
        ctx.beginPath()
        ctx.ellipse(cx, y, radius * Math.cos((lat * Math.PI) / 180), radius * 0.15, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (let lon = 0; lon < 180; lon += 45) {
        const offset = Math.sin((lon * Math.PI) / 180 + angle) * radius
        ctx.beginPath()
        ctx.ellipse(cx + offset * 0.3, cy, Math.abs(offset * 0.6), radius, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw Orbit Trajectory Satellite Arc
      ctx.strokeStyle = 'rgba(198, 106, 61, 0.4)'
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(cx, cy, radius * 1.08, radius * 0.5, -0.4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw MOIL Mine Sites on 3D Projection
      MOIL_MINES.forEach((m) => {
        // Project coordinates centered on Central India (Lat 21.5, Lng 79.5)
        const dLng = (m.lng - 79.5) * 18
        const dLat = -(m.lat - 21.5) * 22

        const mx = cx + dLng
        const my = cy + dLat

        const isSelected = selectedMine.id === m.id
        const isMP = m.state === 'MP'
        const color = isSelected ? '#00FF88' : isMP ? '#E5C76B' : '#C66A3D'

        // Pulsing Ring for Selected Mine
        if (isSelected) {
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(mx, my, 14 + Math.sin(angle * 4) * 4, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Mine Point
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(mx, my, isSelected ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fill()

        // Label
        ctx.fillStyle = isSelected ? '#E8F0F2' : '#8FA4B5'
        ctx.font = isSelected ? 'bold 11px monospace' : '9px monospace'
        ctx.fillText(m.name, mx + 8, my + 3)
      })

      angle += 0.005
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [selectedMine])

  const layers = [
    { key: 'ndvi' as const, label: 'NDVI Vegetation Proxy', color: '#3FAE7A' },
    { key: 'moisture' as const, label: 'Soil Moisture (10m)', color: '#3B82F6' },
    { key: 'thermal' as const, label: 'LST Thermal Anomaly', color: '#D9584A' },
    { key: 'geology' as const, label: 'Gondite Manganese Horizon', color: '#E5C76B' },
  ]

  const horizons = [
    { key: 'realtime' as const, label: 'LIVE ORBIT' },
    { key: '7d' as const, label: '7-DAY SYNTHESIS' },
    { key: '14d' as const, label: '14-DAY RISK COMPOSITE' },
    { key: '30d' as const, label: '30-DAY MONTHLY' },
  ]

  return (
    <div className="liquid-panel overflow-hidden p-0 relative">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#080C0F]/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-[#00FF88] animate-ping" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#00FF88] uppercase">
              3D ORBITAL COMMAND GLOBE &bull; MOIL MINING BELT
            </span>
          </div>
          <div className="text-sm font-semibold text-[#E8F0F2]">
            Central India (Balaghat Syncline) & Western Belt (Nagpur-Bhandara Horizon)
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
          {horizons.map((h) => (
            <button type="button"
              key={h.key}
              onClick={() => onChangeTimeHorizon(h.key)}
              className={`px-3 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                timeHorizon === h.key
                  ? 'bg-[#C66A3D] text-white shadow-sm'
                  : 'text-[#8FA4B5] hover:text-[#E8F0F2]'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="relative h-[480px] sm:h-[540px] w-full bg-[#050607] flex items-center justify-center">
        <canvas ref={canvasRef} width={1200} height={600} className="w-full h-full object-contain" />

        {/* Overlay Layer Selector (Top Left) */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 p-3 rounded-2xl bg-[#080C0F]/85 border border-white/10 backdrop-blur-xl">
          <span className="text-[10px] font-mono font-bold text-[#8FA4B5] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#C66A3D]" />
            Multi-Spectral Layer:
          </span>
          {layers.map((l) => (
            <button type="button"
              key={l.key}
              onClick={() => onChangeLayer(l.key)}
              className={`px-3 py-1.5 rounded-xl text-left text-xs font-mono transition-all flex items-center justify-between gap-3 cursor-pointer ${
                activeLayer === l.key
                  ? 'bg-white/10 text-[#E8F0F2] font-bold border border-white/20'
                  : 'text-[#8FA4B5] hover:text-[#E8F0F2] hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
              {activeLayer === l.key && <span className="text-[9px] text-[#00FF88]">ACTIVE</span>}
            </button>
          ))}
        </div>

        {/* Selected Mine Telemetry Card (Top Right) */}
        <div className="absolute top-4 right-4 p-4 rounded-2xl bg-[#080C0F]/90 border border-white/15 backdrop-blur-xl max-w-xs shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-[#00FF88] uppercase">
              {selectedMine.name} &bull; {selectedMine.code}
            </span>
            <span className="text-[10px] font-mono text-[#8FA4B5]">{selectedMine.state}</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-[#8FA4B5]">
              <span>Monthly Target:</span>
              <span className="text-[#E8F0F2] font-semibold">{selectedMine.targetTonnes.toLocaleString('en-IN')} T</span>
            </div>
            <div className="flex justify-between text-[#8FA4B5]">
              <span>Est. Daily Run:</span>
              <span className="text-[#E5C76B] font-semibold">~{Math.round(selectedMine.targetTonnes / 30)} T/day</span>
            </div>
            <div className="flex justify-between text-[#8FA4B5]">
              <span>Geo Zone:</span>
              <span className="text-[#E8F0F2]">{selectedMine.zone}</span>
            </div>
          </div>
        </div>

        {/* Mine Quick Switcher Strip (Bottom) */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 overflow-x-auto pb-1">
          {MOIL_MINES.map((m) => (
            <button type="button"
              key={m.id}
              onClick={() => onSelectMine(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedMine.id === m.id
                  ? 'bg-[#C66A3D] text-white font-bold shadow-[0_0_15px_rgba(198,106,61,0.5)]'
                  : 'bg-black/60 border border-white/10 text-[#8FA4B5] hover:text-[#E8F0F2] hover:bg-white/10'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {m.name} ({m.state})
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
