'use client'


export interface CyberRobotAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CyberRobotAvatar({ size = 'md', className = '' }: CyberRobotAvatarProps) {
  const dimensions = {
    sm: 'h-7 w-7',
    md: 'h-11 w-11',
    lg: 'h-24 w-24',
  }[size]

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-gradient-to-b from-[var(--color-surface-1)]/95 via-[var(--color-surface-0)]/98 to-surface-0 border-2 border-accent/60  overflow-hidden group select-none ${dimensions} ${className}`}
    >
      {/* Outer Rotating Cyber Energy Ring */}
      <svg
        className="absolute inset-0 h-full w-full animate-[spin_8s_linear_infinite] opacity-90"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="var(--color-status-nominal)"
          strokeWidth="2"
          strokeDasharray="14 8 20 8"
        />
        <circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeDasharray="4 10"
        />
      </svg>

      {/* Counter-Rotating Cute Star Particles Ring */}
      <svg
        className="absolute inset-0 h-full w-full animate-[spin_5s_linear_infinite_reverse] opacity-75"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.2"
          strokeDasharray="2 16"
        />
        {/* Orbiting Sparkles */}
        <circle cx="50" cy="14" r="2.5" fill="var(--color-status-nominal)" />
        <circle cx="86" cy="50" r="2" fill="var(--color-accent)" />
        <circle cx="50" cy="86" r="2.5" fill="var(--color-accent)" />
        <circle cx="14" cy="50" r="2" fill="var(--color-status-caution)" />
      </svg>

      {/* Rotating & Bobbing Cute Laughing Cyber Robot Face */}
      <div className="relative flex items-center justify-center h-[76%] w-[76%] animate-[spin_12s_linear_infinite]">
        <svg
          className="h-full w-full drop-"
          viewBox="0 0 100 100"
          fill="none"
        >
          <defs>
            {/* Cute Metallic Silver Head Gradient */}
            <linearGradient id="cuteBotSilver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-text-primary)" />
              <stop offset="40%" stopColor="var(--color-text-primary)" />
              <stop offset="85%" stopColor="var(--color-text-tertiary)" />
              <stop offset="100%" stopColor="var(--color-text-tertiary)" />
            </linearGradient>

            {/* Glowing Cyber Screen Gradient */}
            <linearGradient id="cyberScreen" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-surface-1)" />
              <stop offset="100%" stopColor="var(--color-surface-0)" />
            </linearGradient>

            {/* Cute Pink Blushing Cheek Gradient */}
            <radialGradient id="pinkBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Cute Robot Antenna with Wiggling Ball */}
          <path d="M50 20V8" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="7" r="4.5" fill="var(--color-status-nominal)" className="opacity-75" />
          <circle cx="50" cy="7" r="4" fill="var(--color-status-nominal)" />

          {/* Cute Bot Cat/Ears */}
          <path d="M22 26L10 18L18 34Z" fill="var(--color-accent)" stroke="var(--color-text-primary)" strokeWidth="1.5" />
          <path d="M78 26L90 18L82 34Z" fill="var(--color-accent)" stroke="var(--color-text-primary)" strokeWidth="1.5" />

          {/* Main Rounded Cute Robot Head Outer Shell */}
          <rect
            x="18"
            y="20"
            width="64"
            height="58"
            rx="28"
            fill="url(#cuteBotSilver)"
            stroke="var(--color-text-primary)"
            strokeWidth="2"
          />

          {/* Cute Dark Cyber Screen Face Screen */}
          <rect
            x="24"
            y="26"
            width="52"
            height="44"
            rx="20"
            fill="url(#cyberScreen)"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />

          {/* Cute Laughing Eyes (Joyful Happy Arcs ^ ^) */}
          <path
            d="M31 40C33 34 41 34 43 40"
            stroke="var(--color-status-nominal)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M57 40C59 34 67 34 69 40"
            stroke="var(--color-status-nominal)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Cute Blushing Cheeks */}
          <circle cx="31" cy="48" r="5" fill="url(#pinkBlush)" />
          <circle cx="69" cy="48" r="5" fill="url(#pinkBlush)" />

          {/* Open Laughing Happy Mouth (Big Cute Smile D ) */}
          <path
            d="M40 48C40 57 60 57 60 48Z"
            fill="var(--color-accent)"
            stroke="var(--color-status-nominal)"
            strokeWidth="1.5"
          />
          {/* Cute Bot Tongue / Smile Sparkle */}
          <path d="M44 52C47 55 53 55 56 52Z" fill="var(--color-accent)" />

          {/* Liquid Glass Forehead Highlight Flare */}
          <path
            d="M32 24C42 22 58 22 68 24C58 27 42 27 32 24Z"
            fill="rgba(255, 255, 255, 0.7)"
          />
        </svg>
      </div>

      {/* Cyber Glow Scanline Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/15 to-transparent animate-[pulse_1.5s_easeInOut_infinite] pointer-events-none" />
    </div>
  )
}
