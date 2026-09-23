'use client'

import Link from 'next/link'
import {
  Info,
  Building2,
  Layers,
  Sparkles,
  Target,
  FileText,
  ArrowLeft,
  Heart,
  CheckCircle2,
  ShieldCheck,
  Globe2,
} from 'lucide-react'

export default function AboutPage() {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden font-sans">
      {/* Ambient Space Dust & Cosmic Radial Sheen */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#FF2E63]/15 via-[#00FF88]/10 to-[#38BDF8]/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto space-y-10 z-10">
        {/* Header Capsule */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF2E63]/20 via-[#38BDF8]/20 to-[#00FF88]/20 border border-[#FF2E63]/40 shadow-[0_0_20px_rgba(255,46,99,0.3)]">
            <Info size={14} className="text-[#FF2E63] " />
            <span className="text-xs font-mono font-black tracking-widest text-white uppercase">
              ABOUT NAKSHATRA-X &bull; SIH 2026 PROBLEM STATEMENT
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-space tracking-tight text-white max-w-4xl leading-tight">
            Using <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#00FF88] to-[#FACC15]">AI/ML and Space Technology</span> to Identify Manganese Reserves and Overcome Production Shortfalls
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
            Autonomous Space-Geological Decision Support Platform created for Ministry of Steel &amp; MOIL Ltd.
          </p>
        </div>

        {/* Key Attributes Meta Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="ios-glass-card p-4 rounded-2xl bg-[#081022]/70 border border-[#38BDF8]/40 flex flex-col justify-between shadow-[0_0_20px_rgba(56,189,248,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Organization</span>
              <Building2 size={16} className="text-[#38BDF8]" />
            </div>
            <div className="text-base font-bold font-space text-white">Ministry of Steel</div>
            <div className="text-[11px] font-mono text-[#38BDF8]">Govt. of India</div>
          </div>

          <div className="ios-glass-card p-4 rounded-2xl bg-[#081022]/70 border border-[#00FF88]/40 flex flex-col justify-between shadow-[0_0_20px_rgba(0,255,136,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Department</span>
              <ShieldCheck size={16} className="text-[#00FF88]" />
            </div>
            <div className="text-base font-bold font-space text-white">MOIL Ltd.</div>
            <div className="text-[11px] font-mono text-[#00FF88]">Largest Producer in India</div>
          </div>

          <div className="ios-glass-card p-4 rounded-2xl bg-[#081022]/70 border border-[#FB923C]/40 flex flex-col justify-between shadow-[0_0_20px_rgba(251,146,60,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Category</span>
              <Layers size={16} className="text-[#FB923C]" />
            </div>
            <div className="text-base font-bold font-space text-white">Software</div>
            <div className="text-[11px] font-mono text-[#FB923C]">AI/ML &amp; Analytics</div>
          </div>

          <div className="ios-glass-card p-4 rounded-2xl bg-[#081022]/70 border border-[#FF2E63]/40 flex flex-col justify-between shadow-[0_0_20px_rgba(255,46,99,0.15)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Theme</span>
              <Globe2 size={16} className="text-[#FF2E63]" />
            </div>
            <div className="text-base font-bold font-space text-white">Space Technology</div>
            <div className="text-[11px] font-mono text-[#FF2E63]">ISRO MOSDAC / Bhuvan</div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-8">
          {/* Background Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-3xl bg-[#081022]/80 border border-white/15 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-[#38BDF8]">
              <FileText size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-space text-white uppercase tracking-wider">
                Background
              </h2>
            </div>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              <strong className="text-white font-semibold">MOIL Limited</strong> is the largest producer of Manganese Ore in India. To meet future demand, it is important to accurately identify available reserves and avoid production shortfalls. At present, reserve estimation and production planning are mainly based on manual surveys, drilling results, and production records. These methods are time-consuming and sometimes lead to a mismatch between expected and actual ore production.
            </p>
          </div>

          {/* Detailed Description Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-3xl bg-[#081022]/80 border border-[#00FF88]/30 shadow-2xl space-y-6">
            <div className="flex items-center gap-2.5 text-[#00FF88]">
              <Target size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-space text-white uppercase tracking-wider">
                Detailed Description
              </h2>
            </div>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              The challenge is to develop an AI/ML-based solution that uses geological data, historical production, equipment performance, and satellite/space technology inputs (such as rainfall, soil moisture, vegetation index, and land temperature) to:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-[#00FF88]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#00FF88]/15 flex items-center justify-center text-[#00FF88] font-bold">
                  1
                </div>
                <h3 className="text-sm font-bold font-space text-white">Identify &amp; Map Reserves</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Identify and map manganese reserves more accurately using surface and sub-surface indicators.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-[#38BDF8]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/15 flex items-center justify-center text-[#38BDF8] font-bold">
                  2
                </div>
                <h3 className="text-sm font-bold font-space text-white">Predict Shortfalls</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Predict shortfalls in production by analysing constraints like equipment downtime, weather conditions, or blasting delays.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 hover:border-[#FB923C]/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[#FB923C]/15 flex items-center justify-center text-[#FB923C] font-bold">
                  3
                </div>
                <h3 className="text-sm font-bold font-space text-white">Suggest Corrective Actions</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Suggest corrective actions such as adjusting mine schedules, optimizing blasting, or re-deploying equipment to ensure continuous ore availability.
                </p>
              </div>
            </div>
          </div>

          {/* Expected Solution Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-3xl bg-[#081022]/80 border border-[#38BDF8]/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-[#38BDF8]">
              <Sparkles size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-space text-white uppercase tracking-wider">
                Expected Solution
              </h2>
            </div>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              The expected solution is a user-friendly dashboard that shows predicted reserves, production trends, possible risks of shortfall, and recommended corrective steps.
            </p>
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#00FF88]/10 via-[#38BDF8]/10 to-transparent border border-[#00FF88]/30 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-[#00FF88] shrink-0" />
              <span className="text-xs sm:text-sm font-mono text-slate-200">
                This will help MOIL improve planning, reduce losses, and ensure steady ore supply to customers.
              </span>
            </div>
          </div>
        </div>

        {/* Footer / Made with Love */}
        <div className="pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Return to Mission Control</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>Theme: Space Technology</span>
            <span className="text-slate-600">&bull;</span>
            <span className="flex items-center gap-1.5 text-[#FF2E63] font-bold">
              (made with love <Heart size={14} className="fill-[#FF2E63] " />)
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
