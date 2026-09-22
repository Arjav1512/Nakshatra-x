'use client'

import { useState, useEffect, } from 'react'

type MineData = {
  id: string
  name: string
  code: string
  state: string
  lat: number
  lng: number
  zone: string
  confidence: number
  risk: 'LOW' | 'WATCH' | 'ELEVATED'
  ndvi: number
  soilMoisture: number
  landTemp: number
  rainfall14d: number
  production: number
  target: number
  equipmentUptime: number
  blastReady: boolean
  stockpileDays: number
  lastObservation: string
  source: string
  cloudCover: number
  dataQuality: 'high' | 'medium' | 'low'
  freshness: 'fresh' | 'stale' | 'expired'
  weatherUpdatedAt: string
  opsUpdatedAt: string
  satelliteUpdatedAt: string
}

function jitter(base: number, range: number) {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10
}

function refreshMine(m: MineData): MineData {
  return {
    ...m,
    ndvi: jitter(m.ndvi, 0.04),
    soilMoisture: Math.round(jitter(m.soilMoisture, 3)),
    landTemp: jitter(m.landTemp, 1.5),
    rainfall14d: Math.round(jitter(m.rainfall14d, 8)),
    production: Math.round(jitter(m.production, 200)),
    equipmentUptime: Math.round(Math.min(100, Math.max(60, jitter(m.equipmentUptime, 4)))),
    weatherUpdatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
    opsUpdatedAt: new Date(Date.now() - Math.random() * 300000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
    freshness: Math.random() > 0.7 ? 'stale' : 'fresh',
  }
}

const BASE_MINES: MineData[] = [
  { id: 'balaghat', name: 'Balaghat', code: 'MOIL-MP-001', state: 'MP', lat: 21.83, lng: 80.19, zone: 'Central India', confidence: 87, risk: 'ELEVATED', ndvi: 0.72, soilMoisture: 42, landTemp: 34.2, rainfall14d: 118, production: 16800, target: 18000, equipmentUptime: 91, blastReady: true, stockpileDays: 6, lastObservation: '2026-08-28T14:30:00Z', source: 'Sentinel-2', cloudCover: 8, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:55:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'bharweli', name: 'Bharweli', code: 'MOIL-MP-002', state: 'MP', lat: 21.86, lng: 80.26, zone: 'Central India', confidence: 74, risk: 'WATCH', ndvi: 0.68, soilMoisture: 38, landTemp: 33.8, rainfall14d: 95, production: 12200, target: 14500, equipmentUptime: 86, blastReady: true, stockpileDays: 8, lastObservation: '2026-08-28T14:30:00Z', source: 'Landsat-8', cloudCover: 12, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:52:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'ukwa', name: 'Ukwa', code: 'MOIL-MP-003', state: 'MP', lat: 21.93, lng: 80.52, zone: 'Central India', confidence: 62, risk: 'WATCH', ndvi: 0.64, soilMoisture: 35, landTemp: 35.1, rainfall14d: 78, production: 8900, target: 9800, equipmentUptime: 94, blastReady: false, stockpileDays: 5, lastObservation: '2026-08-27T14:30:00Z', source: 'Sentinel-2', cloudCover: 22, dataQuality: 'medium', freshness: 'stale', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:48:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'tirodi', name: 'Tirodi', code: 'MOIL-MP-004', state: 'MP', lat: 22.16, lng: 79.68, zone: 'Central India', confidence: 71, risk: 'WATCH', ndvi: 0.69, soilMoisture: 40, landTemp: 33.5, rainfall14d: 105, production: 10100, target: 11200, equipmentUptime: 88, blastReady: true, stockpileDays: 7, lastObservation: '2026-08-28T14:30:00Z', source: 'Sentinel-2', cloudCover: 5, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:50:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'dongri-buzurg', name: 'Dongri Buzurg', code: 'MOIL-MH-001', state: 'MH', lat: 20.99, lng: 79.34, zone: 'Western Belt', confidence: 58, risk: 'LOW', ndvi: 0.61, soilMoisture: 33, landTemp: 36.4, rainfall14d: 62, production: 11200, target: 12000, equipmentUptime: 92, blastReady: true, stockpileDays: 9, lastObservation: '2026-08-27T14:30:00Z', source: 'Landsat-8', cloudCover: 18, dataQuality: 'medium', freshness: 'stale', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:45:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'chikla', name: 'Chikla', code: 'MOIL-MH-002', state: 'MH', lat: 21.3, lng: 79.66, zone: 'Western Belt', confidence: 66, risk: 'WATCH', ndvi: 0.65, soilMoisture: 37, landTemp: 35.8, rainfall14d: 88, production: 9800, target: 10800, equipmentUptime: 90, blastReady: true, stockpileDays: 6, lastObservation: '2026-08-28T14:30:00Z', source: 'Sentinel-2', cloudCover: 14, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:53:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'mansar', name: 'Mansar', code: 'MOIL-MH-003', state: 'MH', lat: 21.44, lng: 79.25, zone: 'Western Belt', confidence: 78, risk: 'WATCH', ndvi: 0.71, soilMoisture: 41, landTemp: 34.0, rainfall14d: 112, production: 11800, target: 12500, equipmentUptime: 85, blastReady: false, stockpileDays: 5, lastObservation: '2026-08-28T14:30:00Z', source: 'Sentinel-2', cloudCover: 6, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:51:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'kandri', name: 'Kandri', code: 'MOIL-MH-004', state: 'MH', lat: 21.38, lng: 79.32, zone: 'Western Belt', confidence: 55, risk: 'LOW', ndvi: 0.59, soilMoisture: 31, landTemp: 36.8, rainfall14d: 54, production: 8400, target: 9300, equipmentUptime: 93, blastReady: true, stockpileDays: 10, lastObservation: '2026-08-26T14:30:00Z', source: 'Landsat-8', cloudCover: 28, dataQuality: 'low', freshness: 'expired', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:47:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'gumgaon', name: 'Gumgaon', code: 'MOIL-MH-005', state: 'MH', lat: 21.33, lng: 79.03, zone: 'Western Belt', confidence: 69, risk: 'WATCH', ndvi: 0.66, soilMoisture: 36, landTemp: 35.5, rainfall14d: 92, production: 9600, target: 10200, equipmentUptime: 89, blastReady: true, stockpileDays: 7, lastObservation: '2026-08-28T14:30:00Z', source: 'Sentinel-2', cloudCover: 10, dataQuality: 'high', freshness: 'fresh', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:54:00', satelliteUpdatedAt: '14:30:00' },
  { id: 'beldongri', name: 'Beldongri', code: 'MOIL-MH-006', state: 'MH', lat: 21.16, lng: 79.18, zone: 'Western Belt', confidence: 48, risk: 'LOW', ndvi: 0.56, soilMoisture: 29, landTemp: 37.2, rainfall14d: 48, production: 7800, target: 8600, equipmentUptime: 96, blastReady: true, stockpileDays: 12, lastObservation: '2026-08-27T14:30:00Z', source: 'Landsat-8', cloudCover: 32, dataQuality: 'medium', freshness: 'stale', weatherUpdatedAt: '08:00:00', opsUpdatedAt: '07:46:00', satelliteUpdatedAt: '14:30:00' },
]

function riskColor(r: string) {
  if (r === 'ELEVATED') return '#D9584A'
  if (r === 'WATCH') return '#D99A3A'
  return '#3FAE7A'
}

function fmtT(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`liquid-panel ${className}`}>{children}</div>
}

function FreshnessBadge({ freshness, time }: { freshness: string; time: string }) {
  const cls = freshness === 'fresh' ? 'status-live' : freshness === 'stale' ? 'status-watch' : 'status-risk'
  return (
    <div className="flex items-center gap-2">
      <span className={cls}>{freshness === 'fresh' ? 'FRESH' : freshness === 'stale' ? 'STALE' : 'EXPIRED'}</span>
      <span className="data-freshness">{time}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="liquid-inset p-4">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8FA4B5]">{label}</div>
      <div className="text-[20px] font-semibold tracking-tight" style={{ color: color || '#E8F0F2' }}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-[#8FA4B5]">{sub}</div>}
    </div>
  )
}

export default function MissionControl() {
  const [mines, setMines] = useState<MineData[]>(BASE_MINES)
  const [selectedMineId, setSelectedMineId] = useState('balaghat')
  const [activeTab, setActiveTab] = useState<'overview' | 'reserve' | 'production' | 'risk' | 'actions' | 'causal' | 'audit'>('overview')
  const [selectedGlobeMine, setSelectedGlobeMine] = useState<any>(null)
  const [now, setNow] = useState(new Date())

  const selectedMine = mines.find(m => m.id === selectedMineId) || mines[0]

  // Simulated live updates
  useEffect(() => {
    const weatherInterval = setInterval(() => {
      setMines(prev => prev.map(m => refreshMine(m)))
    }, 6000) // Weather: every 6s (simulated 6hrs)

    const opsInterval = setInterval(() => {
      setMines(prev => prev.map(m => ({
        ...m,
        equipmentUptime: Math.round(Math.min(100, Math.max(60, jitter(m.equipmentUptime, 2)))),
        production: Math.round(jitter(m.production, 100)),
        opsUpdatedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
      })))
    }, 5000) // Ops: every 5s (simulated 5min)

    const clockInterval = setInterval(() => setNow(new Date()), 1000)

    return () => {
      clearInterval(weatherInterval)
      clearInterval(opsInterval)
      clearInterval(clockInterval)
    }
  }, [])

  // Listen for globe clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setSelectedGlobeMine(detail)
      if (detail?.id) setSelectedMineId(detail.id)
    }
    window.addEventListener('mine-selected', handler)
    return () => window.removeEventListener('mine-selected', handler)
  }, [])

  const totalProd = mines.reduce((s, m) => s + m.production, 0)
  const totalTarget = mines.reduce((s, m) => s + m.target, 0)
  const avgConf = Math.round(mines.reduce((s, m) => s + m.confidence, 0) / mines.length)
  const elevated = mines.filter(m => m.risk === 'ELEVATED').length
  const watch = mines.filter(m => m.risk === 'WATCH').length
  const freshCount = mines.filter(m => m.freshness === 'fresh').length

  const tabs = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'reserve', label: 'RESERVE INTEL' },
    { key: 'production', label: 'PRODUCTION' },
    { key: 'risk', label: 'RISK' },
    { key: 'actions', label: 'ACTIONS' },
    { key: 'causal', label: 'CAUSAL MAP' },
    { key: 'audit', label: 'AUDIT' },
  ] as const

  const { IndiaMineGlobe, ProductionChart, RiskTrendChart, DowntimeBar, CausalMindMap, HotspotEvidence } = (() => {
    try { return require('@/components/globe/IndiaMineGlobe') } catch { return { IndiaMineGlobe: null } }
  })()
  // Lazy load charts to avoid bundling issues
  const [charts, setCharts] = useState<any>({})
  useEffect(() => {
    Promise.all([
      import('@/components/globe/Charts'),
      import('@/components/globe/CausalMindMap'),
      import('@/components/globe/HotspotEvidence'),
    ]).then(([c, cm, he]) => setCharts({ ProductionChart: c.ProductionChart, RiskTrendChart: c.RiskTrendChart, DowntimeBar: c.DowntimeBar, CausalMindMap: cm.default, HotspotEvidence: he.default }))
  }, [])

  return (
    <section id="mission-control" className="command-surface relative z-10">
      <div className="mx-auto max-w-[1600px] px-6 py-16">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8FA4B5]">Mission Control</span>
              <span className="status-live flex items-center gap-1.5"><span className="pulse-dot" /> LIVE</span>
            </div>
            <h2 className="text-[clamp(24px,3.5vw,42px)] font-semibold tracking-[-0.02em] text-[#E8F0F2]">
              MOIL Space Intelligence Command Center
            </h2>
            <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-[#8FA4B5]">
              Decision-support prototype. Satellite-derived surface indicators + operational data — not geological proof. Requires drilling validation by MOIL geologists.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="liquid-inset flex items-center gap-2 px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8FA4B5]">FRESH DATA</span>
              <span className="text-[14px] font-semibold text-[#3FAE7A]">{freshCount}/{mines.length}</span>
            </div>
            <div className="liquid-inset px-4 py-2 text-[11px] font-medium text-[#E8F0F2]">
              {now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
            </div>
          </div>
        </div>

        {/* Top Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard label="Active Mines" value={`${mines.length}`} sub="MP · MH" />
          <MetricCard label="Production" value={`${fmtT(totalProd)} T`} sub={`of ${fmtT(totalTarget)} T`} color="#E5C76B" />
          <MetricCard label="Avg Confidence" value={`${avgConf}%`} />
          <MetricCard label="Critical" value={`${elevated}`} sub="Elevated risk" color="#D9584A" />
          <MetricCard label="Watch" value={`${watch}`} sub="Monitor closely" color="#D99A3A" />
          <MetricCard label="Fresh Scenes" value={`${freshCount}`} sub="Cloud-filtered" color="#3FAE7A" />
        </div>

        {/* Tab Bar */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[rgba(198,106,61,0.15)] text-[#C66A3D] border border-[rgba(198,106,61,0.3)]'
                  : 'liquid-inset text-[#8FA4B5] hover:bg-[rgba(255,255,255,0.04)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">

          {/* Left Column */}
          <div className="space-y-5">

            {/* Globe */}
            <GlassPanel className="overflow-hidden p-0">
              <div className="h-[50vh] min-h-[400px]">
                {charts.CausalMindMap ? (
                  <div className="h-full w-full bg-[#080A0D]">
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#8FA4B5]">3D INDIA COMMAND GLOBE</div>
                        <div className="grid grid-cols-3 gap-3 px-8">
                          {mines.slice(0, 6).map(m => (
                            <button type="button"
                              key={m.id}
                              onClick={() => setSelectedMineId(m.id)}
                              className={`liquid-inset cursor-pointer p-3 text-left transition-all ${
                                selectedMineId === m.id ? 'border-[rgba(198,106,61,0.3)] bg-[rgba(198,106,61,0.08)]' : 'hover:bg-[rgba(255,255,255,0.04)]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: riskColor(m.risk) }} />
                                <span className="text-[11px] font-medium text-[#E8F0F2]">{m.name}</span>
                              </div>
                              <div className="mt-1 text-[9px] text-[#8FA4B5]">{m.state} · {m.confidence}%</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#080A0D]">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(198,106,61,0.3)] border-t-[#C66A3D]" />
                  </div>
                )}
              </div>
              <div className="border-t border-[rgba(186,214,221,0.1)] px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#E8F0F2]">{selectedMine.name} · {selectedMine.code}</span>
                  <FreshnessBadge freshness={selectedMine.freshness} time={selectedMine.weatherUpdatedAt} />
                </div>
              </div>
            </GlassPanel>

            {/* Reserve Intelligence */}
            {(activeTab === 'overview' || activeTab === 'reserve') && (
              <GlassPanel className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">01 / RESERVE INTELLIGENCE</div>
                    <div className="mt-1 text-[18px] font-semibold text-[#E8F0F2]">Prospect Confidence Zones</div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { color: '#E5C76B', label: 'PRIORITY' },
                      { color: '#D99A3A', label: 'INVESTIGATE' },
                      { color: '#3FAE7A', label: 'MONITOR' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[9px] uppercase tracking-[0.1em] text-[#8FA4B5]">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mines.map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMineId(m.id)}
                      className={`liquid-inset cursor-pointer p-3 transition-all ${
                        selectedMineId === m.id ? 'border-[rgba(198,106,61,0.3)] bg-[rgba(198,106,61,0.06)]' : 'hover:bg-[rgba(255,255,255,0.03)]'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[#E8F0F2]">{m.name}</span>
                        <span className="text-[9px] uppercase tracking-[0.1em]" style={{
                          color: m.confidence >= 75 ? '#E5C76B' : m.confidence >= 55 ? '#D99A3A' : '#8FA4B5',
                        }}>
                          {m.confidence >= 75 ? 'HIGH' : m.confidence >= 55 ? 'MED' : 'LOW'}
                        </span>
                      </div>
                      <div className="mb-1 grid grid-cols-2 gap-1 text-[10px]">
                        <div className="text-[#8FA4B5]">NDVI <span className="text-[#E8F0F2]">{m.ndvi}</span></div>
                        <div className="text-[#8FA4B5]">Soil <span className="text-[#E8F0F2]">{m.soilMoisture}%</span></div>
                        <div className="text-[#8FA4B5]">LST <span className="text-[#E8F0F2]">{m.landTemp}°C</span></div>
                        <div className="text-[#8FA4B5]">Rain <span className="text-[#E8F0F2]">{m.rainfall14d}mm</span></div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`h-1.5 w-1.5 rounded-full ${m.freshness === 'fresh' ? 'bg-[#3FAE7A]' : m.freshness === 'stale' ? 'bg-[#D99A3A]' : 'bg-[#D9584A]'}`} />
                        <span className="data-freshness">{m.source} · {m.cloudCover}% cloud</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}

            {/* Production Sentinel */}
            {(activeTab === 'overview' || activeTab === 'production') && (
              <GlassPanel className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">02 / PRODUCTION SENTINEL</div>
                    <div className="mt-1 text-[18px] font-semibold text-[#E8F0F2]">Planned vs Actual Ore</div>
                  </div>
                  <FreshnessBadge freshness="fresh" time={mines[0].opsUpdatedAt} />
                </div>
                {charts.ProductionChart ? <charts.ProductionChart /> : (
                  <div className="space-y-3">
                    {mines.map(m => {
                      const pct = Math.round((m.production / m.target) * 100)
                      const c = pct >= 90 ? '#3FAE7A' : pct >= 75 ? '#D99A3A' : '#D9584A'
                      return (
                        <div key={m.id} className="liquid-inset p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[12px] font-medium text-[#E8F0F2]">{m.name}</span>
                            <span className="text-[11px] font-medium" style={{ color: c }}>{fmtT(m.production)} / {fmtT(m.target)} T</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: c }} />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#8FA4B5]">
                            <span>Equipment: {m.equipmentUptime}%</span>
                            <span>Blast: {m.blastReady ? 'Ready' : 'Pending'}</span>
                            <span>Stockpile: {m.stockpileDays}d</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </GlassPanel>
            )}

            {/* Causal Mind Map */}
            {(activeTab === 'overview' || activeTab === 'causal') && charts.CausalMindMap && (
              <GlassPanel className="p-5">
                <div className="mb-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">CAUSAL MIND MAP</div>
                  <div className="mt-1 text-[18px] font-semibold text-[#E8F0F2]">Rainfall → Production → Shortfall</div>
                  <div className="text-[11px] text-[#8FA4B5]">Click nodes to see evidence. Arrows show causal chains.</div>
                </div>
                <charts.CausalMindMap />
              </GlassPanel>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-5">

            {/* Risk Cockpit */}
            {(activeTab === 'overview' || activeTab === 'risk') && (
              <GlassPanel className="p-5">
                <div className="mb-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">03 / RISK COCKPIT</div>
                  <div className="mt-1 text-[16px] font-semibold text-[#E8F0F2]">{selectedMine.name}</div>
                  <div className="text-[10px] text-[#8FA4B5]">{selectedMine.zone} · {selectedMine.state}</div>
                </div>
                <div className="mb-3 rounded-[12px] border p-3" style={{
                  borderColor: riskColor(selectedMine.risk) + '40',
                  backgroundColor: riskColor(selectedMine.risk) + '10',
                }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: riskColor(selectedMine.risk) }}>Risk Status</span>
                    <span className="text-[12px] font-semibold" style={{ color: riskColor(selectedMine.risk) }}>{selectedMine.risk}</span>
                  </div>
                </div>
                {[
                  { label: 'Rainfall Signal', score: Math.min(100, selectedMine.rainfall14d / 2.5) },
                  { label: 'Equipment Downtime', score: Math.max(0, 100 - selectedMine.equipmentUptime) },
                  { label: 'Blast Readiness', score: selectedMine.blastReady ? 5 : 65 },
                  { label: 'Stockpile Pressure', score: Math.max(0, 100 - selectedMine.stockpileDays * 10) },
                ].map(item => (
                  <div key={item.label} className="mb-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#8FA4B5]">{item.label}</span>
                      <span className="text-[11px] font-medium" style={{ color: item.score >= 50 ? '#D9584A' : item.score >= 25 ? '#D99A3A' : '#3FAE7A' }}>
                        {item.score.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: item.score >= 50 ? '#D9584A' : item.score >= 25 ? '#D99A3A' : '#3FAE7A' }} />
                    </div>
                  </div>
                ))}
                <div className="mt-3 liquid-inset p-3">
                  <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#8FA4B5]">Composite Risk Score</div>
                  <div className="mt-1 text-[24px] font-bold" style={{ color: riskColor(selectedMine.risk) }}>
                    {selectedMine.risk === 'ELEVATED' ? '72.4' : selectedMine.risk === 'WATCH' ? '48.6' : '22.1'}
                  </div>
                </div>
                {charts.RiskTrendChart && (
                  <div className="mt-3">
                    <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8FA4B5]">14-DAY TREND</div>
                    <charts.RiskTrendChart />
                  </div>
                )}
              </GlassPanel>
            )}

            {/* Hotspot Evidence */}
            {(activeTab === 'overview' || activeTab === 'reserve') && charts.HotspotEvidence && (
              <charts.HotspotEvidence mineId={selectedMineId} />
            )}

            {/* Action Center */}
            {(activeTab === 'overview' || activeTab === 'actions') && (
              <GlassPanel className="p-5">
                <div className="mb-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">04 / ACTION CENTER</div>
                  <div className="mt-1 text-[16px] font-semibold text-[#E8F0F2]">Recommended Actions</div>
                </div>
                {selectedMine.rainfall14d > 100 && (
                  <div className="liquid-inset mb-3 p-3">
                    <div className="text-[12px] font-medium text-[#E8F0F2]">Prioritize drainage inspection</div>
                    <div className="mt-1 text-[10px] text-[#8FA4B5]">14-day rainfall: {selectedMine.rainfall14d}mm exceeds threshold</div>
                    <div className="mt-1 text-[10px] font-medium text-[#C66A3D]">Prevents waterlogging delays</div>
                  </div>
                )}
                {selectedMine.equipmentUptime < 90 && (
                  <div className="liquid-inset mb-3 p-3">
                    <div className="text-[12px] font-medium text-[#E8F0F2]">Deploy standby equipment</div>
                    <div className="mt-1 text-[10px] text-[#8FA4B5]">Equipment uptime at {selectedMine.equipmentUptime}%</div>
                    <div className="mt-1 text-[10px] font-medium text-[#C66A3D]">Recovers ~200 T/day capacity</div>
                  </div>
                )}
                {!selectedMine.blastReady && (
                  <div className="liquid-inset mb-3 p-3">
                    <div className="text-[12px] font-medium text-[#E8F0F2]">Advance blast block schedule</div>
                    <div className="mt-1 text-[10px] text-[#8FA4B5]">Current blast not ready</div>
                    <div className="mt-1 text-[10px] font-medium text-[#C66A3D]">Unlocks 1,200 T ore access</div>
                  </div>
                )}
                {selectedMine.stockpileDays < 7 && (
                  <div className="liquid-inset mb-3 p-3">
                    <div className="text-[12px] font-medium text-[#E8F0F2]">Rebalance stockpile dispatch</div>
                    <div className="mt-1 text-[10px] text-[#8FA4B5]">Only {selectedMine.stockpileDays} days of stockpile remaining</div>
                    <div className="mt-1 text-[10px] font-medium text-[#C66A3D]">Maintains continuous feed</div>
                  </div>
                )}
                {selectedMine.risk === 'LOW' && selectedMine.equipmentUptime >= 90 && selectedMine.blastReady && (
                  <div className="rounded-[12px] border border-[rgba(63,174,122,0.2)] bg-[rgba(63,174,122,0.06)] p-3">
                    <div className="text-[12px] font-medium text-[#3FAE7A]">All clear</div>
                    <div className="mt-1 text-[10px] text-[#8FA4B5]">Continue planned operations with daily monitoring.</div>
                  </div>
                )}
                <div className="mt-3 text-[9px] text-[#6F7B86]">
                  Prototype decision-support output. Requires geological and operational validation.
                </div>
              </GlassPanel>
            )}

            {/* Data Sources */}
            <GlassPanel className="p-4">
              <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">DATA SOURCES & FRESHNESS</div>
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Weather (NASA POWER)', freq: 'Every 6 hours', color: '#3FAE7A' },
                  { label: 'Operations (CSV/API)', freq: 'Every 5 minutes', color: '#3FAE7A' },
                  { label: 'Satellite (Sentinel-2)', freq: 'Daily cloud-filtered', color: '#3FAE7A' },
                  { label: 'Satellite (Landsat)', freq: 'Daily cloud-filtered', color: '#3FAE7A' },
                ].map(src => (
                  <div key={src.label} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: src.color }} />
                      <span className="text-[#E8F0F2]">{src.label}</span>
                    </div>
                    <span className="text-[#8FA4B5]">{src.freq}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Audit Panel */}
            {(activeTab === 'audit') && (
              <GlassPanel className="p-5">
                <div className="mb-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8FA4B5]">05 / AUDIT PANEL</div>
                  <div className="mt-1 text-[16px] font-semibold text-[#E8F0F2]">Data Lineage</div>
                </div>
                <div className="space-y-2">
                  {mines.map(m => (
                    <div key={m.id} className="liquid-inset p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#E8F0F2]">{m.name}</span>
                        <span className="text-[9px] text-[#8FA4B5]">{m.source}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-[#8FA4B5]">
                        <span>Cloud: {m.cloudCover}%</span>
                        <span>Quality: <span style={{ color: m.dataQuality === 'high' ? '#3FAE7A' : m.dataQuality === 'medium' ? '#D99A3A' : '#D9584A' }}>{m.dataQuality}</span></span>
                        <span>Conf: {m.confidence}%</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[8px] text-[#6F7B86]">
                        <span>Weather: {m.weatherUpdatedAt}</span>
                        <span>Ops: {m.opsUpdatedAt}</span>
                        <span>Sat: {m.satelliteUpdatedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-10 border-t border-[rgba(186,214,221,0.1)] pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[10px] text-[#8FA4B5] max-w-[700px]">
              Decision-support prototype — not geological proof. Satellite imagery detects surface indicators (vegetation stress, moisture, temperature, land disturbance), not underground manganese. Requires drilling validation by MOIL geologists before operational use.
            </div>
            <div className="flex gap-3 text-[9px] text-[#6F7B86]">
              <span>Copernicus STAC</span>
              <span>NASA POWER</span>
              <span>USGS Landsat</span>
              <span>Sentinel-2 L2A</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
