'use client'

import type React from 'react'
import { clsx } from 'clsx'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div
      className={clsx( 'relative rounded-md border border-accent/25 bg-[var(--color-surface-0)]/80 p-6  transition-colors duration-300 hover:border-accent/50',
        className
      )}
      {...props}
    >
      {/* Corner decorative indicators */}
      <div className="pointer-events-none absolute -top-[1px] -left-[1px] h-3 w-3 border-t-2 border-l-2 border-accent/70 rounded-tl-xl" />
      <div className="pointer-events-none absolute -bottom-[1px] -right-[1px] h-3 w-3 border-b-2 border-r-2 border-accent/70 rounded-br-xl" />
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
  const baseStyles = 'relative inline-flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-wider uppercase rounded-md px-5 py-3 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'bg-[var(--color-surface-1)]/90 text-text-primary border border-accent/50 hover:border-accent hover:bg-accent/15 hover:text-accent hover: active:scale-[0.98]',
    ghost: 'bg-surface-2 text-text-secondary border border-border-default hover:bg-surface-3 hover:text-text-primary hover:border-border-interactive active:scale-[0.98]',
    danger: 'bg-[var(--color-surface-1)]/80 text-status-critical border border-status-critical/40 hover:bg-status-critical/20 hover:border-status-critical active:scale-[0.98]',
  }

  return (
    <button type="button" className={clsx(baseStyles, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
