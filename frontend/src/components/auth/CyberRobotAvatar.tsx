'use client'

import { User } from 'lucide-react'

export interface CyberRobotAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * A user's avatar in the admin registry.
 *
 * It was a "cyber robot": two counter-rotating rings, a spinning core and a
 * pulsing scan line, all infinite — four of the looping decorations the motion
 * policy bans (DESIGN_SYSTEM.md §7.2), drawn once per row of a user table. It
 * is now the design reference's quiet icon chip: a tone step and a glyph, no
 * motion. The name keeps the two call sites unchanged.
 */
export function CyberRobotAvatar({ size = 'md', className = '' }: CyberRobotAvatarProps) {
  const dimensions = {
    sm: 'h-7 w-7',
    md: 'h-11 w-11',
    lg: 'h-24 w-24',
  }[size]
  const glyph = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-10 w-10' }[size]

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 text-text-secondary ${dimensions} ${className}`}
    >
      <User className={glyph} />
    </div>
  )
}
