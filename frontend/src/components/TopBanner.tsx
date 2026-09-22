'use client'

import SolarCyberLogo from './SolarCyberLogo'
import TopNavMenu from './TopNavMenu'
import { UserNav } from '@/components/auth/UserNav'
import { Bot } from 'lucide-react'

export default function TopBanner() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full h-16 md:h-20 liquid-glass-banner flex items-center justify-between px-2 sm:px-4 md:px-6 pointer-events-auto select-none gap-1.5"
      style={{ transform: 'none' }}
      aria-label="Top Navigation Barrier"
    >
      {/* Left zone: 3D Animating Solar Type Logo + 'NAKSHATRA-X' (Shifted slightly left for max visibility) */}
      <div className="flex items-center shrink-0 z-20 pl-1 sm:pl-2 md:pl-3" id="top-banner-logo-slot">
        <SolarCyberLogo />
      </div>

      {/* Center zone: Cyber Theme Menu Section */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-1 overflow-hidden shrink z-10" id="top-banner-menu-slot">
        <TopNavMenu />
      </div>

      {/* Right zone: Robot Avatar Logo & Always Fully Visible AI-X Action Button */}
      <div className="flex items-center justify-end gap-2 shrink-0 z-20 whitespace-nowrap pr-1 sm:pr-2" id="top-banner-actions-slot">
        {/* Robot Avatar Logo User Button */}
        <UserNav />

        {/* AI-X Always Fully Visible Capsule Action Button */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-aix-copilot'))
          }}
          className="h-9 md:h-10 px-3.5 sm:px-4 rounded-full bg-[#081022]/95 border border-[#FF3366]/70 hover:border-[#FF3366] text-white flex items-center justify-center gap-1.5 transition-all shadow-[0_0_16px_rgba(255,51,102,0.4)] hover:shadow-[0_0_24px_rgba(255,51,102,0.7)] cursor-pointer shrink-0 whitespace-nowrap flex-nowrap"
          type="button"
          title="Launch AI-X Intelligent Platform Assistant"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <Bot size={15} className="text-[#00FF88] drop-shadow-[0_0_8px_#00FF88]" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FF3366] animate-ping" />
          </div>
          <span className="font-mono text-xs font-black tracking-wider uppercase flex items-center font-space shrink-0 whitespace-nowrap leading-none">
            <span className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]">AI</span>
            <span className="font-3d-cyber text-cyber-liquid-red ml-0.5 inline-block font-black text-sm">
              -X
            </span>
          </span>
        </button>
      </div>
    </header>
  )
}
