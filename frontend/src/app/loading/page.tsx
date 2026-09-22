'use client'

import { useState, useEffect } from 'react'
import { Satellite, Activity, ChevronRight, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Starfield } from '@/components/nakshatra/sections'
import { GlassCard } from '@/components/nakshatra/ui'

export default function LoadingPreviewPage() {
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [subsystems, setSubsystems] = useState([
    { name: 'ORBITAL_RECEPTOR (14.8°N 79.2°E)', status: 'SYNCHRONIZING...', done: false },
    { name: 'MULTI-BAND SPECTRAL ANALYSIS', status: 'WAITING...', done: false },
    { name: '788-FRAME VOLUMETRIC STREAM', status: 'WAITING...', done: false },
    { name: 'NEURAL ORE BLEND MATRIX', status: 'WAITING...', done: false },
    { name: 'CRYPTOGRAPHIC SESSION VAULT', status: 'WAITING...', done: false },
  ])

  const runSimulation = () => {
    setProgress(0)
    setIsComplete(false)
    setSubsystems([
      { name: 'ORBITAL_RECEPTOR (14.8°N 79.2°E)', status: 'SYNCHRONIZING...', done: false },
      { name: 'MULTI-BAND SPECTRAL ANALYSIS', status: 'WAITING...', done: false },
      { name: '788-FRAME VOLUMETRIC STREAM', status: 'WAITING...', done: false },
      { name: 'NEURAL ORE BLEND MATRIX', status: 'WAITING...', done: false },
      { name: 'CRYPTOGRAPHIC SESSION VAULT', status: 'WAITING...', done: false },
    ])

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsComplete(true)
          return 100
        }
        const next = prev + Math.floor(Math.random() * 8) + 4
        return next > 100 ? 100 : next
      })
    }, 120)

    return () => clearInterval(interval)
  }

  useEffect(() => {
    return runSimulation()
  }, [])

  useEffect(() => {
    if (progress > 20) {
      setSubsystems((prev) => [
        { ...prev[0], status: 'LOCKED [OK]', done: true },
        { ...prev[1], status: 'CALIBRATING...', done: false },
        prev[2],
        prev[3],
        prev[4],
      ])
    }
    if (progress > 45) {
      setSubsystems((prev) => [
        prev[0],
        { ...prev[1], status: 'ACTIVE [OK]', done: true },
        { ...prev[2], status: 'STREAMING 788 FRAMES...', done: false },
        prev[3],
        prev[4],
      ])
    }
    if (progress > 70) {
      setSubsystems((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], status: 'BUFFERED 100%', done: true },
        { ...prev[3], status: 'OPTIMIZING...', done: false },
        prev[4],
      ])
    }
    if (progress >= 95) {
      setSubsystems((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: 'ONLINE [OK]', done: true },
        { ...prev[4], status: 'ENCLAVE SECURE', done: true },
      ])
    }
  }, [progress])

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-black text-white flex flex-col items-center justify-center px-4 py-20">
      <Starfield />

      {/* Cyber Grid */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Navigation Link */}
        <div className="mb-4 flex items-center justify-between text-xs font-mono">
          <Link href="/" className="text-slate-400 hover:text-[#00FF88] flex items-center gap-1">
            <ArrowLeft size={12} /> Return to Mission Console
          </Link>
          <span className="text-[#38BDF8]">CALIBRATION PREVIEW</span>
        </div>

        <GlassCard className="p-8 text-center border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.9)]">
          {/* Rotating Radar Rings */}
          <div className="relative mb-6 flex items-center justify-center mx-auto">
            <div className="h-28 w-28 rounded-full border border-[#00FF88]/30 border-t-[#00FF88] border-r-transparent animate-spin [animation-duration:2.5s]" />
            <div className="absolute h-20 w-20 rounded-full border border-[#38BDF8]/40 border-b-[#38BDF8] border-l-transparent animate-spin [animation-direction:reverse] [animation-duration:1.8s]" />
            <div className="absolute flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00FF88]/15 border border-[#00FF88]/50 shadow-[0_0_24px_rgba(0,255,136,0.6)]">
              <Satellite className="h-6 w-6 text-[#00FF88] animate-pulse" />
            </div>
          </div>

          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#38BDF8] flex items-center justify-center gap-1.5 mb-1.5">
            <Activity className="h-3.5 w-3.5 text-[#00FF88] animate-pulse" />
            NAKSHATRA-X DEEP SPACE TELEMETRY
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {isComplete ? 'TELEMETRY CALIBRATION COMPLETE' : 'INITIALIZING MISSION HUD'}
          </h1>

          {/* Real-time Subsystem List */}
          <div className="mt-5 w-full bg-white/[0.03] border border-white/10 rounded-xl p-3.5 font-mono text-[11px] text-slate-400 space-y-2 text-left">
            {subsystems.map((sub, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="truncate max-w-[240px]">{sub.name}:</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    sub.done ? 'text-[#00FF88]' : 'text-[#38BDF8]'
                  }`}
                >
                  {sub.done && <CheckCircle2 size={12} />}
                  {sub.status}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar & Percentage */}
          <div className="mt-5">
            <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
              <span>VOLUMETRIC STREAM:</span>
              <span className="text-[#00FF88] font-bold">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-[#00FF88] via-[#38BDF8] to-[#00FF88] rounded-full transition-all duration-150 shadow-[0_0_15px_#00FF88]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={runSimulation}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 hover:border-white/30 text-xs font-mono text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Re-run Calibration</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#00FF88]/20 border border-[#00FF88]/60 hover:bg-[#00FF88]/30 text-[#00FF88] font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,136,0.3)]"
            >
              <span>Launch Website</span>
              <ChevronRight size={14} />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#38BDF8]/20 border border-[#38BDF8]/50 hover:bg-[#38BDF8]/30 text-[#38BDF8] font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
            >
              <span>Mission Login</span>
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
