'use client'

import type React from 'react'
import Link from 'next/link'
import { FEATURES_DATA } from '@/data/featuresData'
import {
  Satellite,
  Brain,
  Map,
  Box,
  Layers,
  Activity,
  History,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sparkles,
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

export default function FeaturesHubPage() {
  return (
    <main className="relative min-h-screen bg-[#020408] text-[#E8F0F2] pt-24 md:pt-28 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background radial sheen */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(0,255,136,0.08)_0%,_transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        {/* Header Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
            <Link href="/" className="hover:underline flex items-center gap-1 text-[#94A3B8] hover:text-white">
              <ArrowLeft size={13} /> Home
            </Link>
            <span>/</span>
            <span className="text-[#00FF88] font-bold">Capabilities & Features</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#00FF88] bg-[#00FF88]/10 border border-[#00FF88]/30 px-3 py-1 rounded-full">
            <Sparkles size={13} />
            <span>8 DEDICATED FEATURE PAGES AVAILABLE</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto my-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8] text-xs font-mono font-bold uppercase tracking-wider mb-4">
            <Zap size={14} className="text-[#00FF88]" />
            ONE-BY-ONE FEATURE EXPLORER
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-space text-white tracking-tight leading-tight">
            NAKSHATRA-X <span className="text-[#00FF88]">Feature Capabilities</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            Select any feature below to launch its dedicated, full-screen interactive one-by-one page. Step through all 8 modules seamlessly.
          </p>

          {/* Quick One-by-One Selector Bar */}
          <div className="mt-8 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider mr-2 hidden sm:inline">
              Jump to Feature:
            </span>
            {FEATURES_DATA.map((feat) => (
              <Link
                key={feat.id}
                href={`/features/${feat.slug}`}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#00FF88] text-white hover:text-black font-mono text-xs font-bold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer border border-white/10 hover:border-[#00FF88]"
                title={feat.title}
              >
                <span className="text-[#38BDF8] group-hover:text-black">#{String(feat.number).padStart(2, '0')}</span>
                <span className="truncate max-w-[110px] sm:max-w-none">{feat.shortTitle}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {FEATURES_DATA.map((feature) => {
            const Icon = ICON_MAP[feature.iconName] || Satellite

            return (
              <div
                key={feature.id}
                className="group relative rounded-2xl bg-[#081022]/90 border border-white/10 hover:border-[#00FF88]/50 p-6 flex flex-col justify-between transition-colors duration-300 hover:shadow-[0_0_30px_rgba(0,255,136,0.15)] hover:-translate-y-1 overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div
                  className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none"
                  style={{ backgroundColor: feature.color }}
                />

                <div>
                  {/* Top Badge & Number */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-black text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 px-2.5 py-1 rounded-md">
                      FEATURE #{String(feature.number).padStart(2, '0')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 border border-white/15 text-slate-300">
                      {feature.badge}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 border border-white/15"
                    style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
                  >
                    <Icon size={24} />
                  </div>

                  <h2 className="text-lg font-bold font-space text-white group-hover:text-[#00FF88] transition-colors leading-snug mb-2">
                    {feature.title}
                  </h2>

                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-6 font-normal">
                    {feature.subtitle}
                  </p>
                </div>

                {/* Open Feature Button */}
                <Link
                  href={`/features/${feature.slug}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 group-hover:bg-[#00FF88] text-white group-hover:text-black font-mono text-xs font-bold flex items-center justify-between transition-colors border border-white/10 group-hover:border-[#00FF88] shadow-md cursor-pointer"
                >
                  <span>OPEN FEATURE #{String(feature.number).padStart(2, '0')}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
