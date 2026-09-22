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
      className={clsx(
        'relative rounded-2xl border border-[#38BDF8]/25 bg-[#050A18]/80 p-6 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] transition-all duration-300 hover:border-[#38BDF8]/50',
        className
      )}
      {...props}
    >
      {/* Corner decorative indicators */}
      <div className="pointer-events-none absolute -top-[1px] -left-[1px] h-3 w-3 border-t-2 border-l-2 border-[#00FF88]/70 rounded-tl-xl" />
      <div className="pointer-events-none absolute -bottom-[1px] -right-[1px] h-3 w-3 border-b-2 border-r-2 border-[#00FF88]/70 rounded-br-xl" />
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
    'relative inline-flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-wider uppercase rounded-xl px-5 py-3 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary:
      'bg-[#081329]/90 text-white border border-[#38BDF8]/50 hover:border-[#00FF88] hover:bg-[#00FF88]/15 hover:text-[#00FF88] shadow-[0_0_20px_rgba(56,189,248,0.2)] hover:shadow-[0_0_25px_rgba(0,255,136,0.35)] active:scale-[0.98]',
    ghost:
      'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30 active:scale-[0.98]',
    danger:
      'bg-[#2A080C]/80 text-[#F87171] border border-[#F87171]/40 hover:bg-[#F87171]/20 hover:border-[#F87171] shadow-[0_0_15px_rgba(248,113,113,0.2)] active:scale-[0.98]',
  }

  return (
    <button type="button" className={clsx(baseStyles, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
