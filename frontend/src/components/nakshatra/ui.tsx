'use client'

import type React from 'react'
import { clsx } from 'clsx'

/**
 * The auth screens' card and button. The names are historical: these were a
 * translucent "glass" card with glowing accent corner brackets and a mono,
 * uppercase, bold button. They are now the design reference's flat card
 * (.mcard: a tone step, a 1px line, r22) and its .btn variants, so the sign-in
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

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
}

export function GlassButton({
  children,
  variant = 'primary',
  className,
  ...props
}: GlassButtonProps) {
  const baseStyles =
    'relative inline-flex h-[42px] items-center justify-center gap-2 rounded-md px-4 text-base tracking-[0.044em] ' +
    'transition-[background-color,color,scale] duration-[180ms] ease-out active:scale-[.97] select-none ' +
    'disabled:cursor-not-allowed disabled:opacity-35'

  const variants = {
    primary: 'bg-inverse-bg text-inverse-fg hover:bg-inverse-hover',
    ghost: 'bg-surface-2 text-text-primary hover:bg-surface-3',
    danger: 'bg-surface-2 text-status-critical hover:bg-surface-3',
  }

  return (
    <button type="button" className={clsx(baseStyles, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
