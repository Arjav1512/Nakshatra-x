'use client'

import Link from 'next/link'

export default function SolarCyberLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer select-none">
      {/* 3D Animating Solar Type Logo in Cyber Blue + Cyber Red */}
      <div className="relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center perspective-800 transition-transform duration-300 ease-out group-hover:scale-105">
        {/* Outer Solar Corona Rays (Cyber Blue & Cyber Red Gradient) */}
        <div className="absolute inset-[-4px] animate-corona-spin pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity duration-300">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="cyberCoronaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#FF3366" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            {/* 8 Solar Spicule Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <line
                key={i}
                x1="50"
                y1="50"
                x2={50 + 44 * Math.cos((angle * Math.PI) / 180)}
                y2={50 + 44 * Math.sin((angle * Math.PI) / 180)}
                stroke="url(#cyberCoronaGradient)"
                strokeWidth={i % 2 === 0 ? "1.8" : "1.2"}
                strokeDasharray={i % 2 === 0 ? "4, 6" : "2, 4"}
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>

        {/* 3D Gyro Orbit Ring 1 (Cyber Blue #00D2FF) */}
        <div className="absolute inset-0 flex items-center justify-center transform-style-3d animate-solar-orbit-1 pointer-events-none">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-[#00D2FF]/60 border-t-[#00D2FF] border-r-transparent relative">
            {/* Orbiting Solar Blue Plasma Node */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00D2FF]" />
          </div>
        </div>

        {/* 3D Gyro Orbit Ring 2 (Cyber Red #FF3366 matching -X) */}
        <div className="absolute inset-0 flex items-center justify-center transform-style-3d animate-solar-orbit-2 pointer-events-none">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-[#FF3366]/70 border-b-[#FF3366] border-l-transparent relative">
            {/* Orbiting Cyber Red Flare Node */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#FF3366]" />
          </div>
        </div>

        {/* 3D Gyro Orbit Ring 3 (Deep Flux Accent) */}
        <div className="absolute inset-0 flex items-center justify-center transform-style-3d animate-solar-orbit-3 pointer-events-none opacity-60 group-hover:opacity-90 transition-opacity duration-300">
          <div className="w-10 h-10 rounded-full border border-dashed border-[#FF3366]/40 group-hover:border-[#FF3366]/80 transition-colors duration-300" />
        </div>

        {/* Central Pulsating Dual Blue-Red Solar Core */}
        <div className="relative w-4 h-4 md:w-4.5 md:h-4.5 rounded-full bg-radial from-white via-[#00D2FF] to-[#FF3366] animate-solar-pulse z-10 flex items-center justify-center">
          {/* White-Hot Core Focus */}
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>

      {/* HyperText Cyber Typography with Matching Liquid Red -X Locked on Same Line */}
      <div className="flex items-center flex-nowrap whitespace-nowrap shrink-0 leading-none">
        <span className="font-3d-cyber text-lg md:text-xl font-bold tracking-[0.24em] uppercase text-white group-hover:text-white transition-colors duration-300 leading-none">
          NAKSHATRA
        </span>
        <span className="font-3d-cyber text-lg md:text-xl font-bold tracking-[0.24em] text-cyber-liquid-red ml-0.5 group-hover:brightness-125 transition-all duration-300 leading-none inline-block">
          -X
        </span>
      </div>
    </Link>
  )
}

