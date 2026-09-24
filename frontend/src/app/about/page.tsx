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
    <main className="relative min-h-screen bg-[var(--color-surface-0)] text-text-primary pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden font-sans">
      {/* Ambient Space Dust & Cosmic Radial Sheen */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-status-critical/15 via-accent/10 to-accent/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto space-y-10 z-10">
        {/* Header Capsule */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-status-critical/20 via-accent/20 to-accent/20 border border-status-critical/40">
            <Info size={14} className="text-status-critical " />
            <span className="text-xs font-mono font-semibold tracking-widest text-text-primary uppercase">
              ABOUT NAKSHATRA-X &bull; SIH 2026 PROBLEM STATEMENT
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold font-sans tracking-tight text-text-primary max-w-4xl leading-tight">
            Using <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent to-status-caution">AI/ML and Space Technology</span> to Identify Manganese Reserves and Overcome Production Shortfalls
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-2xl font-normal leading-relaxed">
            Autonomous Space-Geological Decision Support Platform created for Ministry of Steel &amp; MOIL Ltd.
          </p>
        </div>

        {/* Key Attributes Meta Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="ios-glass-card p-4 rounded-md bg-surface-1/70 border border-accent/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-text-secondary uppercase">Organization</span>
              <Building2 size={16} className="text-accent" />
            </div>
            <div className="text-base font-bold font-sans text-text-primary">Ministry of Steel</div>
            <div className="text-xs font-mono text-accent">Govt. of India</div>
          </div>

          <div className="ios-glass-card p-4 rounded-md bg-surface-1/70 border border-accent/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-text-secondary uppercase">Department</span>
              <ShieldCheck size={16} className="text-accent" />
            </div>
            <div className="text-base font-bold font-sans text-text-primary">MOIL Ltd.</div>
            <div className="text-xs font-mono text-accent">Largest Producer in India</div>
          </div>

          <div className="ios-glass-card p-4 rounded-md bg-surface-1/70 border border-status-caution/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-text-secondary uppercase">Category</span>
              <Layers size={16} className="text-status-caution" />
            </div>
            <div className="text-base font-bold font-sans text-text-primary">Software</div>
            <div className="text-xs font-mono text-status-caution">AI/ML &amp; Analytics</div>
          </div>

          <div className="ios-glass-card p-4 rounded-md bg-surface-1/70 border border-status-critical/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-text-secondary uppercase">Theme</span>
              <Globe2 size={16} className="text-status-critical" />
            </div>
            <div className="text-base font-bold font-sans text-text-primary">Space Technology</div>
            <div className="text-xs font-mono text-status-critical">ISRO MOSDAC / Bhuvan</div>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-8">
          {/* Background Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-md bg-surface-1/80 border border-border-default shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-accent">
              <FileText size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-sans text-text-primary uppercase tracking-wider">
                Background
              </h2>
            </div>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-normal">
              <strong className="text-text-primary font-semibold">MOIL Limited</strong> is the largest producer of Manganese Ore in India. To meet future demand, it is important to accurately identify available reserves and avoid production shortfalls. At present, reserve estimation and production planning are mainly based on manual surveys, drilling results, and production records. These methods are time-consuming and sometimes lead to a mismatch between expected and actual ore production.
            </p>
          </div>

          {/* Detailed Description Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-md bg-surface-1/80 border border-accent/30 shadow-2xl space-y-6">
            <div className="flex items-center gap-2.5 text-accent">
              <Target size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-sans text-text-primary uppercase tracking-wider">
                Detailed Description
              </h2>
            </div>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-normal">
              The challenge is to develop an AI/ML-based solution that uses geological data, historical production, equipment performance, and satellite/space technology inputs (such as rainfall, soil moisture, vegetation index, and land temperature) to:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-5 rounded-md bg-surface-2 border border-border-default space-y-2 hover:border-accent/50 transition-colors">
                <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center text-accent font-bold">
                  1
                </div>
                <h3 className="text-sm font-bold font-sans text-text-primary">Identify &amp; Map Reserves</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Identify and map manganese reserves more accurately using surface and sub-surface indicators.
                </p>
              </div>

              <div className="p-5 rounded-md bg-surface-2 border border-border-default space-y-2 hover:border-accent/50 transition-colors">
                <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center text-accent font-bold">
                  2
                </div>
                <h3 className="text-sm font-bold font-sans text-text-primary">Predict Shortfalls</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Predict shortfalls in production by analysing constraints like equipment downtime, weather conditions, or blasting delays.
                </p>
              </div>

              <div className="p-5 rounded-md bg-surface-2 border border-border-default space-y-2 hover:border-status-caution/50 transition-colors">
                <div className="w-8 h-8 rounded-md bg-status-caution/15 flex items-center justify-center text-status-caution font-bold">
                  3
                </div>
                <h3 className="text-sm font-bold font-sans text-text-primary">Suggest Corrective Actions</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Suggest corrective actions such as adjusting mine schedules, optimizing blasting, or re-deploying equipment to ensure continuous ore availability.
                </p>
              </div>
            </div>
          </div>

          {/* Expected Solution Card */}
          <div className="ios-glass-card p-6 sm:p-8 rounded-md bg-surface-1/80 border border-accent/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-accent">
              <Sparkles size={20} />
              <h2 className="text-lg sm:text-xl font-bold font-sans text-text-primary uppercase tracking-wider">
                Expected Solution
              </h2>
            </div>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-normal">
              The expected solution is a user-friendly dashboard that shows predicted reserves, production trends, possible risks of shortfall, and recommended corrective steps.
            </p>
            <div className="p-4 rounded-md bg-gradient-to-r from-accent/10 via-accent/10 to-transparent border border-accent/30 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-accent shrink-0" />
              <span className="text-xs sm:text-sm font-mono text-text-primary">
                This will help MOIL improve planning, reduce losses, and ensure steady ore supply to customers.
              </span>
            </div>
          </div>
        </div>

        {/* Footer / Made with Love */}
        <div className="pt-8 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-md bg-surface-3 hover:bg-white/20 border border-border-interactive text-text-primary font-mono text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Return to Mission Control</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
            <span>Theme: Space Technology</span>
            <span className="text-text-tertiary">&bull;</span>
            <span className="flex items-center gap-1.5 text-status-critical font-bold">
              (made with love <Heart size={14} className="fill-status-critical " />)
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
