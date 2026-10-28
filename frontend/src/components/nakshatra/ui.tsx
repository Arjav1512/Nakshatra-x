'use client'

import type React from 'react'
import { clsx } from 'clsx'

/**
 * The auth screens' card. The name is historical: this was a translucent
 * "glass" card with glowing accent corner brackets. It is now the design
 * reference's flat card (.mcard: a tone step, a 1px line, r22), so the sign-in
 * flow reads as the same product as everything else. The API is unchanged.
 */

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div
      className={clsx('relative rounded-2xl border border-border-default bg-surface-1 p-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}
